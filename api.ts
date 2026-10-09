import { UserRole } from '../types';

export interface UserSessionProfile {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  dealerId?: string;
  orderTakerId?: string;
  active: boolean;
  subscriptionStatus?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: UserSessionProfile;
}

export interface SecurityTestResult {
  testNumber: number;
  name: string;
  description: string;
  expected: string;
  actual: string;
  passed: boolean;
  statusCode: number;
}

export interface SecurityAuditReport {
  success: boolean;
  allPassed: boolean;
  summary: string;
  tests: SecurityTestResult[];
}

const TOKEN_KEY = 'mysaleflo_auth_token';
const USER_KEY = 'mysaleflo_auth_user';

export const api = {
  getToken(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string, user: UserSessionProfile) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      // An order taker's own phone stays signed in, so the app opens even with no signal
      if (user.role === 'ORDER_TAKER') {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
    } catch (e) {
      console.warn('Storage failed:', e);
    }
  },

  clearToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.warn('Clear storage failed:', e);
    }
  },

  getCachedUser(): UserSessionProfile | null {
    try {
      const stored = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  async login(login: string, password: string): Promise<LoginResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed. Please verify credentials.');
    }

    this.setToken(data.token, data.user);
    return data;
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } finally {
      this.clearToken();
    }
  },

  async getMe(): Promise<UserSessionProfile | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        this.clearToken(); // really signed out (or deactivated)
        return null;
      }
      if (!res.ok) {
        return this.getCachedUser(); // server problem, not a logout
      }

      const data = await res.json();
      return data.user;
    } catch {
      return this.getCachedUser(); // no signal: keep working with this phone's saved sign-in
    }
  },

  async runSecurityTests(): Promise<SecurityAuditReport> {
    const res = await fetch('/api/security/run-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return data;
  },

  async testResourceAccess(resourceType: string, resourceId: string): Promise<{ authorized: boolean; status: number; message: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(`/api/dealer/resource/${resourceType}/${resourceId}`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });
      const data = await res.json();
      return {
        authorized: res.ok,
        status: res.status,
        message: data.error || (res.ok ? 'Access Authorized' : 'Access Denied'),
      };
    } catch (e: any) {
      return {
        authorized: false,
        status: 500,
        message: e.message || 'Request failed',
      };
    }
  },

  // --- Phase 2 Super Admin Dealer & Subscription APIs ---
  // ---- Phase 11: order taker accounts, order taker data and orders ----
  async authedJson(method: string, path: string, body?: unknown) {
    const res = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${this.getToken() || ''}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* not JSON */
    }
    if (!res.ok) {
      const err: any = new Error(json?.error || `Request failed (${res.status})`);
      err.status = res.status;
      err.code = json?.code;
      throw err;
    }
    return json;
  },

  createOrderTakerAccount(payload: any) {
    return this.authedJson('POST', '/api/dealer/order-takers', payload);
  },
  updateOrderTakerAccount(id: string, updates: any) {
    return this.authedJson('PUT', `/api/dealer/order-takers/${encodeURIComponent(id)}`, updates);
  },
  deleteOrderTakerAccount(id: string) {
    return this.authedJson('DELETE', `/api/dealer/order-takers/${encodeURIComponent(id)}`);
  },
  changePassword(currentPassword: string, newPassword: string) {
    return this.authedJson('POST', '/api/auth/change-password', { currentPassword, newPassword });
  },
  resetDealerPassword(dealerId: string, newPassword: string) {
    return this.authedJson('POST', `/api/superadmin/dealers/${encodeURIComponent(dealerId)}/reset-password`, { newPassword });
  },
  askAssistant(question: string) {
    return this.authedJson('POST', '/api/ai/ask', { question });
  },
  getOrderTakerData() {
    return this.authedJson('GET', '/api/order-taker/data');
  },
  createOrderTakerOrder(payload: any) {
    return this.authedJson('POST', '/api/order-taker/orders', payload);
  },

  async getSuperAdminDealers() {
    const token = this.getToken();
    const res = await fetch('/api/superadmin/dealers', {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to fetch dealers');
    }
    return res.json();
  },

  async createDealer(data: any) {
    const token = this.getToken();
    const res = await fetch('/api/superadmin/dealers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to create dealer');
    }
    return result;
  },

  async updateDealer(id: string, updates: any) {
    const token = this.getToken();
    const res = await fetch(`/api/superadmin/dealers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(updates),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to update dealer');
    }
    return result;
  },

  async updateDealerSubscription(id: string, data: any) {
    const token = this.getToken();
    const res = await fetch(`/api/superadmin/dealers/${id}/subscription`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to update subscription');
    }
    return result;
  },

  async toggleDealerStatus(id: string, active?: boolean) {
    const token = this.getToken();
    const res = await fetch(`/api/superadmin/dealers/${id}/toggle-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ active }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to toggle dealer status');
    }
    return result;
  },

  async checkDealerRecords(id: string) {
    const token = this.getToken();
    const res = await fetch(`/api/superadmin/dealers/${id}/check-records`, {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to check dealer records');
    }
    return result;
  },

  async deleteDealer(id: string) {
    const token = this.getToken();
    const res = await fetch(`/api/superadmin/dealers/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to delete dealer');
    }
    return result;
  },

  async runPhase2Tests() {
    const token = this.getToken();
    const res = await fetch('/api/superadmin/test-phase2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to run Phase 2 tests');
    }
    return result;
  },

  // --- Phase 3 Dealer Product & Stock APIs ---
  async getDealerProducts(includeArchived = false) {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/products?includeArchived=${includeArchived}`, {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch products');
    return data;
  },

  async createProduct(productData: any) {
    const token = this.getToken();
    const res = await fetch('/api/dealer/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(productData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create product');
    return data;
  },

  async updateProduct(id: string, updates: any) {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update product');
    return data;
  },

  async toggleProductStatus(id: string, status?: 'ACTIVE' | 'INACTIVE') {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/products/${id}/toggle-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to toggle product status');
    return data;
  },

  async adjustProductStock(id: string, quantityChange: number, type?: string, note?: string) {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/products/${id}/adjust-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ quantityChange, type, note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to adjust product stock');
    return data;
  },

  async checkProductRecords(id: string) {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/products/${id}/check-records`, {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to check product records');
    return data;
  },

  async deleteProduct(id: string) {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/products/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete product');
    return data;
  },

  async getDealerStockValuation() {
    const token = this.getToken();
    const res = await fetch('/api/dealer/stock/valuation', {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch inventory valuation');
    return data;
  },

  async getDealerStockTransactions() {
    const token = this.getToken();
    const res = await fetch('/api/dealer/stock/transactions', {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch stock movements');
    return data;
  },

  async getDealerCategories() {
    const token = this.getToken();
    const res = await fetch('/api/dealer/categories', {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch categories');
    return data;
  },

  async createOrder(payload: any) {
    const token = this.getToken();
    const res = await fetch('/api/dealer/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to confirm order');
    return data;
  },

  async processReturn(payload: any) {
    const token = this.getToken();
    const res = await fetch('/api/dealer/returns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to process return');
    return data;
  },

  async runPhase3Tests() {
    const res = await fetch('/api/dealer/test-phase3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to run Phase 3 tests');
    }
    return result;
  },

  async runPhase4Tests() {
    const res = await fetch('/api/dealer/test-phase4', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to run Phase 4 tests');
    }
    return result;
  },

  async runPhase5Tests() {
    const res = await fetch('/api/dealer/test-phase5', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to run Phase 5 tests');
    }
    return result;
  },

  async runPhase6Tests() {
    const res = await fetch('/api/dealer/test-phase6', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to run Phase 6 tests');
    }
    return result;
  },

  async getDealerOrders() {
    const token = this.getToken();
    const res = await fetch('/api/dealer/orders', {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch orders');
    return data;
  },

  async getDealerInvoices() {
    const token = this.getToken();
    const res = await fetch('/api/dealer/invoices', {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch invoices');
    return data;
  },

  async printInvoice(invoiceId: string) {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/invoices/${invoiceId}/print`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to log invoice print');
    return data;
  },

  async getDealerOrderTakers() {
    const token = this.getToken();
    const res = await fetch('/api/dealer/order-takers', {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch order takers');
    return data;
  },

  async updateOrderTakerLocation(coords: { latitude: number; longitude: number; accuracy?: number; addressLabel?: string }) {
    const token = this.getToken();
    const res = await fetch('/api/order-taker/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(coords),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to transmit location');
    return data;
  },

  async sendOrderTakerHeartbeat(status: 'ONLINE' | 'OFFLINE' = 'ONLINE') {
    const token = this.getToken();
    const res = await fetch('/api/order-taker/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send heartbeat');
    return data;
  },

  async getDealerPrinters() {
    const token = this.getToken();
    const res = await fetch('/api/dealer/printers', {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch printer profiles');
    return data;
  },

  async addPrinterSetting(payload: any) {
    const token = this.getToken();
    const res = await fetch('/api/dealer/printers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add printer profile');
    return data;
  },

  async updatePrinterSetting(printerId: string, payload: any) {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/printers/${printerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update printer profile');
    return data;
  },

  async setDefaultPrinter(printerId: string) {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/printers/${printerId}/default`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to set default printer');
    return data;
  },

  async deletePrinterSetting(printerId: string) {
    const token = this.getToken();
    const res = await fetch(`/api/dealer/printers/${printerId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete printer profile');
    return data;
  },

  async runPhase7Tests() {
    const res = await fetch('/api/dealer/test-phase7', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to run Phase 7 tests');
    }
    return result;
  },
};
