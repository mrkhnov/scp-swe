import { User, UserRole, Link, Product, Order, Complaint, ChatMessage, CompanyType } from '../types';

// API Configuration
export const API_BASE_URL = 'http://localhost:8000';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Types for API requests
interface UserRegistration {
  email: string;
  password: string;
  role: UserRole;
  company_name?: string;
  company_type?: CompanyType;
  company_id?: number | null;
}

interface UserLogin {
  email: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Helper function to get headers with auth token
function getHeaders(includeAuth: boolean = true): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (includeAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
}

// Token management
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// JWT token decoder (simple implementation)
function decodeJWTPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

export function resolveImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
}

function getUserFromToken(): User | null {
  const token = getAccessToken();
  if (!token) return null;
  
  const payload = decodeJWTPayload(token);
  if (!payload) return null;
  
  // Check if token is expired
  if (payload.exp && payload.exp < Date.now() / 1000) {
    clearTokens();
    return null;
  }
  
  return {
    id: payload.user_id,
    email: payload.email,
    role: payload.role,
    is_active: payload.is_active || true,
    company_id: payload.company_id || undefined
  };
}

// API error handling
class APIError extends Error {
  constructor(public status: number, public statusText: string, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders: HeadersInit = { ...getHeaders() };

  if (options.body instanceof FormData) {
    delete (defaultHeaders as Record<string, string>)['Content-Type'];
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch (e) {
      // If we can't parse the error response, use the default message
    }
    throw new APIError(response.status, response.statusText, errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Authentication API
export const auth = {
  async register(userData: UserRegistration): Promise<User> {
    return apiRequest<User>('/auth/register', {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify(userData),
    });
  },

  async login(credentials: UserLogin): Promise<{ access_token: string; refresh_token: string; token_type: string }> {
    const response = await apiRequest<{ access_token: string; refresh_token: string; token_type: string }>('/auth/token', {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify(credentials),
    });
    
    return response;
  },

  async logout(): Promise<void> {
    clearTokens();
  },

  // Team management (Owner only)
  async getCompanyUsers(): Promise<User[]> {
    return apiRequest<User[]>('/auth/company/users');
  },

  async addCompanyUser(userData: UserRegistration): Promise<User> {
    return apiRequest<User>('/auth/company/add-user', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async removeCompanyUser(userId: number): Promise<void> {
    return apiRequest<void>(`/auth/company/remove-user/${userId}`, {
      method: 'DELETE',
    });
  },

  // Get available chat partners (Sales Reps for Consumers, Consumers for Sales Reps)
  async getChatPartners(): Promise<User[]> {
    return apiRequest<User[]>('/auth/sales-reps');
  },

  async getCompanySettings(): Promise<any> {
    return apiRequest<any>('/auth/company/settings');
  },

  async updateCompanySettings(settings: { name?: string; kyb_status?: boolean; is_active?: boolean }): Promise<any> {
    return apiRequest<any>('/auth/company/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async deleteCompany(): Promise<void> {
    return apiRequest<void>('/auth/company', {
      method: 'DELETE',
    });
  },
};

// Links API
export const links = {
  async getMyLinks(): Promise<Link[]> {
    return apiRequest<Link[]>('/links/my-links');
  },

  async getAvailableSuppliers(): Promise<any[]> {
    return apiRequest<any[]>('/links/available-suppliers');
  },

  async requestLink(supplierId: number): Promise<Link> {
    return apiRequest<Link>('/links/request', {
      method: 'POST',
      body: JSON.stringify({ supplier_id: supplierId }),
    });
  },

  async updateLinkStatus(linkId: number, status: string): Promise<Link> {
    return apiRequest<Link>(`/links/${linkId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
};

// Products API
export const products = {
  async getProducts(supplierId?: number): Promise<Product[]> {
    const query = supplierId ? `?supplier_id=${supplierId}` : '';
    return apiRequest<Product[]>(`/products/catalog${query}`);
  },

  async createProduct(productData: {
    name: string;
    sku: string;
    price: number;
    stock_quantity: number;
    min_order_qty?: number;
    is_active?: boolean;
    image?: File | null;
  }): Promise<Product> {
    const formData = new FormData();
    formData.append('name', productData.name);
    formData.append('sku', productData.sku);
    formData.append('price', productData.price.toString());
    formData.append('stock_quantity', productData.stock_quantity.toString());
    formData.append('min_order_qty', (productData.min_order_qty ?? 1).toString());
    formData.append('is_active', String(productData.is_active ?? true));

    if (productData.image) {
      formData.append('image', productData.image);
    }

    return apiRequest<Product>('/products/', {
      method: 'POST',
      body: formData,
    });
  },

  async updateProduct(productId: number, productData: {
    name?: string;
    price?: number;
    stock_quantity?: number;
    min_order_qty?: number;
    is_active?: boolean;
    image?: File | null;
  }): Promise<Product> {
    const formData = new FormData();

    if (productData.name !== undefined) formData.append('name', productData.name);
    if (productData.price !== undefined) formData.append('price', productData.price.toString());
    if (productData.stock_quantity !== undefined) formData.append('stock_quantity', productData.stock_quantity.toString());
    if (productData.min_order_qty !== undefined) formData.append('min_order_qty', productData.min_order_qty.toString());
    if (productData.is_active !== undefined) formData.append('is_active', String(productData.is_active));
    if (productData.image) formData.append('image', productData.image);

    return apiRequest<Product>(`/products/${productId}`, {
      method: 'PUT',
      body: formData,
    });
  },

  async deleteProduct(productId: number): Promise<void> {
    return apiRequest<void>(`/products/${productId}`, {
      method: 'DELETE',
    });
  },
};

// Orders API
export const orders = {
  async getMyOrders(): Promise<Order[]> {
    return apiRequest<Order[]>('/orders/my-orders');
  },

  async createOrder(orderData: {
    supplier_id: number;
    items: { product_id: number; quantity: number }[];
  }): Promise<Order> {
    return apiRequest<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  async updateOrderStatus(orderId: number, status: string): Promise<Order> {
    return apiRequest<Order>(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
};

// Complaints API
export const complaints = {
  async getMyComplaints(): Promise<Complaint[]> {
    return apiRequest<Complaint[]>('/complaints');
  },

  async createComplaint(complaintData: {
    order_id: number;
    description: string;
  }): Promise<Complaint> {
    return apiRequest<Complaint>('/complaints', {
      method: 'POST',
      body: JSON.stringify(complaintData),
    });
  },

  async assignToMe(complaintId: number): Promise<Complaint> {
    return apiRequest<Complaint>(`/complaints/${complaintId}/assign`, {
      method: 'PUT',
    });
  },

  async resolve(complaintId: number): Promise<Complaint> {
    return apiRequest<Complaint>(`/complaints/${complaintId}/resolve`, {
      method: 'PUT',
    });
  },

  async escalate(complaintId: number): Promise<Complaint> {
    return apiRequest<Complaint>(`/complaints/${complaintId}/escalate`, {
      method: 'PUT',
      body: JSON.stringify({}),
    });
  },

  async updateComplaintStatus(complaintId: number, status: string): Promise<Complaint> {
    return apiRequest<Complaint>(`/complaints/${complaintId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
};

// Chat API
export const chat = {
  async getChatHistory(partnerId: number): Promise<ChatMessage[]> {
    return apiRequest<ChatMessage[]>(`/chat/history/${partnerId}`);
  },

  async sendMessage(partnerId: number, content: string): Promise<ChatMessage> {
    return apiRequest<ChatMessage>('/chat/send', {
      method: 'POST',
      body: JSON.stringify({
        partner_id: partnerId,
        content,
      }),
    });
  },

  async getUnreadCounts(): Promise<Record<number, number>> {
    return apiRequest<Record<number, number>>('/chat/unread-counts');
  },
};

// Connection Management API
export const connections = {
  async getConnections(): Promise<any[]> {
    return apiRequest<any[]>('/connections/');
  },

  async getBlacklist(): Promise<any[]> {
    return apiRequest<any[]>('/connections/blacklist');
  },

  async blockConsumer(consumerId: number, reason?: string): Promise<any> {
    return apiRequest<any>('/connections/block', {
      method: 'POST',
      body: JSON.stringify({ consumer_id: consumerId, reason }),
    });
  },

  async unblockConsumer(consumerId: number): Promise<any> {
    return apiRequest<any>(`/connections/unblock/${consumerId}`, {
      method: 'DELETE',
    });
  },

  async removeConnection(consumerId: number): Promise<any> {
    return apiRequest<any>(`/connections/remove/${consumerId}`, {
      method: 'DELETE',
    });
  },
};

// Main API export (for backward compatibility)
export const api = {
  // Auth
  register: auth.register,
  login: auth.login,
  logout: auth.logout,
  auth: auth, // Export the auth object for team management
  
  // Links
  getMyLinks: links.getMyLinks,
  getAvailableSuppliers: links.getAvailableSuppliers,
  requestLink: links.requestLink,
  updateLinkStatus: links.updateLinkStatus,
  
  // Products
  getProducts: products.getProducts,
  createProduct: products.createProduct,
  updateProduct: products.updateProduct,
  deleteProduct: products.deleteProduct,
  
  // Orders
  getMyOrders: orders.getMyOrders,
  createOrder: orders.createOrder,
  updateOrderStatus: orders.updateOrderStatus,
  
  // Complaints
  getMyComplaints: complaints.getMyComplaints,
  createComplaint: complaints.createComplaint,
  updateComplaintStatus: complaints.updateComplaintStatus,
  complaint: complaints, // Export the full complaints object for new methods
  
  // Chat
  getChatHistory: chat.getChatHistory,
  sendMessage: chat.sendMessage,
  getUnreadCounts: chat.getUnreadCounts,
  
  // Connection Management
  getConnections: connections.getConnections,
  getBlacklist: connections.getBlacklist,
  blockConsumer: connections.blockConsumer,
  unblockConsumer: connections.unblockConsumer,
  removeConnection: connections.removeConnection,
  
  // File upload (stub - not implemented in backend)
  async uploadFile(file: File): Promise<string> {
    // TODO: Implement file upload endpoint
    console.warn('File upload not implemented');
    return '';
  },
};

// Re-export auth functions for convenience
export { getUserFromToken };

export function logout(): void {
  clearTokens();
}