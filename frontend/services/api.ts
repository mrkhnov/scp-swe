import { User, UserRole, Link, Product, Order, Complaint, ChatMessage } from '../types';

// API Configuration
const API_BASE_URL = 'http://localhost:8000';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Types for API requests
interface UserRegistration {
  email: string;
  password: string;
  role: UserRole;
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
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
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

  async createProduct(productData: Omit<Product, 'id' | 'supplier_id'>): Promise<Product> {
    return apiRequest<Product>('/products/', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  async updateProduct(productId: number, productData: Partial<Product>): Promise<Product> {
    return apiRequest<Product>(`/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
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

// Main API export (for backward compatibility)
export const api = {
  // Auth
  register: auth.register,
  login: auth.login,
  logout: auth.logout,
  
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
  
  // Chat
  getChatHistory: chat.getChatHistory,
  sendMessage: chat.sendMessage,
  getUnreadCounts: chat.getUnreadCounts,
  
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