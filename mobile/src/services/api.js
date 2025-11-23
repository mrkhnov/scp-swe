import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Use localhost for web, local IP for mobile devices
const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  }
  // Replace this IP with your computer's local IP address
  return 'http://192.168.0.159:8000';
};

const API_URL = getApiUrl();

class ApiService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.onLogout = null;
  }

  setLogoutCallback(callback) {
    this.onLogout = callback;
  }

  getApiUrl() {
    return API_URL;
  }

  async setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    await AsyncStorage.setItem('access_token', accessToken);
    await AsyncStorage.setItem('refresh_token', refreshToken);
  }

  async loadTokens() {
    this.accessToken = await AsyncStorage.getItem('access_token');
    this.refreshToken = await AsyncStorage.getItem('refresh_token');
  }

  async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // If body is FormData, let fetch handle Content-Type (it needs to set boundary)
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    if (this.accessToken && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const config = {
      timeout: 20000, // 20 second timeout (increased for tunnel stability)
      ...options,
      headers,
    };

    const url = `${API_URL}${endpoint}`;
    console.log('API Request:', { url, method: config.method || 'GET' });

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('API Response:', { status: response.status, statusText: response.statusText });

      if (response.status === 401 && this.refreshToken && !options.skipRefresh) {
        // Try to refresh token
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry original request
          return this.request(endpoint, { ...options, skipRefresh: true });
        }
      }

      if (response.status === 401) {
        // If we are here, it means either:
        // 1. No refresh token available
        // 2. Refresh token failed
        // So we should logout
        if (this.onLogout) {
          this.onLogout();
        }
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        let errorMessage = error.detail || `HTTP ${response.status}`;
        
        if (typeof errorMessage === 'object') {
          errorMessage = JSON.stringify(errorMessage);
        }
        
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('API Request Timeout:', url);
        throw new Error('Network request timed out. Please check your connection and try again.');
      }

      console.error('API Request Error:', {
        url,
        error: error.message,
        type: error.name
      });

      if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
        throw new Error(`Cannot connect to server at ${API_URL}. Please check:\n1. Your internet connection\n2. That the backend server is running\n3. That your device is on the same network`);
      }

      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        await this.setTokens(data.access_token, data.refresh_token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  // Network connectivity test
  async testConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_URL}/docs`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('Connection test failed:', error.message);
      return false;
    }
  }

  // Auth
  async login(email, password) {
    const url = `${API_URL}/auth/token`;
    console.log('Login request to:', url);

    try {
      // Test connection first
      const connected = await this.testConnection();
      if (!connected) {
        throw new Error(`Cannot connect to server at ${API_URL}.\n\nPossible causes:\n1. The tunnel URL might have expired or changed.\n2. The backend server is not running.\n3. No internet connection.\n\nCurrent URL: ${API_URL}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15s for tunnel

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Login response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Login failed' }));
        throw new Error(error.detail || 'Invalid credentials');
      }

      const data = await response.json();
      await this.setTokens(data.access_token, data.refresh_token);
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Login request timed out. The tunnel connection might be slow or down. Please try again.');
      }
      throw error;
    }
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
      skipAuth: true,
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async logout() {
    await this.clearTokens();
  }

  // Products
  async getProducts(supplierId = null) {
    const params = supplierId ? `?supplier_id=${supplierId}` : '';
    return this.request(`/products/catalog${params}`);
  }

  async createProduct(productData) {
    return this.request('/products/', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  }

  async updateProduct(productId, productData) {
    return this.request(`/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  }

  // Orders
  async getMyOrders() {
    return this.request('/orders/my-orders');
  }

  async createOrder(orderData) {
    return this.request('/orders/', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async updateOrderStatus(orderId, status) {
    return this.request(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Complaints
  async getMyComplaints() {
    return this.request('/complaints/');
  }

  async createComplaint(complaintData) {
    return this.request('/complaints/', {
      method: 'POST',
      body: JSON.stringify(complaintData),
    });
  }

  async resolveComplaint(complaintId) {
    return this.request(`/complaints/${complaintId}/resolve`, {
      method: 'PUT',
    });
  }

  async escalateComplaint(complaintId) {
    return this.request(`/complaints/${complaintId}/escalate`, {
      method: 'PUT',
      body: JSON.stringify({}),
    });
  }

  async assignComplaint(complaintId) {
    return this.request(`/complaints/${complaintId}/assign`, {
      method: 'PUT',
    });
  }

  // Chat
  async getConversations() {
    try {
      // Use sales-reps endpoint to get potential chat partners
      const partners = await this.request('/auth/sales-reps');

      // Get unread counts for each partner - with better error handling
      let unreadCounts = {};
      try {
        unreadCounts = await this.getUnreadCounts();
      } catch (error) {
        console.warn('Failed to get unread counts:', error);
        // Continue without unread counts
      }

      // Transform to conversation format
      return partners.map(partner => ({
        id: partner.id,
        name: partner.email,
        company_name: partner.company_name || 'Unknown Company',
        last_message: null,
        last_message_at: null,
        unread_count: unreadCounts[partner.id] || 0,
      }));
    } catch (error) {
      console.error('Failed to get conversations:', error);
      return [];
    }
  }

  async getMessages(partnerId) {
    return this.request(`/chat/history/${partnerId}`);
  }

  async markMessagesAsRead(partnerId) {
    // The backend marks as read automatically when fetching history
    // This is just for explicit marking if needed
    return Promise.resolve();
  }

  async getChatPartners() {
    return this.request('/auth/sales-reps');
  }

  async getChatHistory(partnerId) {
    return this.request(`/chat/history/${partnerId}`);
  }

  async getUnreadCounts() {
    return this.request('/chat/unread-counts');
  }

  async sendMessage(recipientId, content) {
    return this.request('/chat/send', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: recipientId,
        content: content,
      }),
    });
  }

  async markAsRead(partnerId) {
    // Backend marks as read when fetching history
    return Promise.resolve();
  }

  async uploadFile(recipientId, file) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.mimeType || file.type || 'application/octet-stream',
      name: file.name ? encodeURIComponent(file.name) : 'upload.bin',
    });

    return this.request(`/chat/upload-file?recipient_id=${recipientId}`, {
      method: 'POST',
      body: formData,
    });
  }

  // Links/Connections
  async getMyLinks() {
    return this.request('/links/my-links');
  }

  async requestLink(supplierId) {
    return this.request('/links/request', {
      method: 'POST',
      body: JSON.stringify({ supplier_id: supplierId }),
    });
  }

  async updateLinkStatus(linkId, status) {
    return this.request(`/links/${linkId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Search
  async searchSuppliers(query) {
    // Get all available suppliers and filter client-side if query provided
    const suppliers = await this.request('/links/available-suppliers');
    if (!query) return suppliers;

    const searchLower = query.toLowerCase();
    return suppliers.filter(s => s.name.toLowerCase().includes(searchLower));
  }
}

export default new ApiService();
