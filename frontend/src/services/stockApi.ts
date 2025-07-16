import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export interface StockItem {
  id: number;
  productId: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  inProductionQuantity: number;
  updatedAt: string;
  productName: string;
  productArticle: string;
  categoryName: string;
  normStock: number;
  price: number;
}

export interface StockMovement {
  id: number;
  productId: number;
  movementType: 'incoming' | 'outgoing' | 'cutting_out' | 'cutting_in' | 'reservation' | 'release_reservation' | 'adjustment';
  quantity: number;
  referenceId?: number;
  referenceType?: string;
  comment?: string;
  userId: number;
  createdAt: string;
  productName: string;
  userName: string;
}

export interface StockFilters {
  status?: 'all' | 'critical' | 'low' | 'normal' | 'out_of_stock' | 'in_production' | 'negative';
  search?: string;
  categoryId?: number;
}

export interface StockAdjustment {
  productId: number;
  adjustment: number;
  comment: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class StockApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  async getStock(filters: StockFilters): Promise<ApiResponse<StockItem[]>> {
    const params = new URLSearchParams();
    
    if (filters.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    if (filters.categoryId) {
      params.append('categoryId', filters.categoryId.toString());
    }
    if (filters.search) {
      params.append('search', filters.search);
    }

    const response = await axios.get(
      `${API_BASE_URL}/stock?${params.toString()}`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async adjustStock(adjustment: StockAdjustment): Promise<ApiResponse<{ newStock: number }>> {
    const response = await axios.post(
      `${API_BASE_URL}/stock/adjust`,
      adjustment,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getStockMovements(productId: number): Promise<ApiResponse<StockMovement[]>> {
    const response = await axios.get(
      `${API_BASE_URL}/stock/movements/${productId}`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async reserveStock(productId: number, quantity: number, orderId: number): Promise<ApiResponse<void>> {
    const response = await axios.post(
      `${API_BASE_URL}/stock/reserve`,
      { productId, quantity, orderId },
      this.getAuthHeaders()
    );
    return response.data;
  }

  async releaseStock(productId: number, quantity: number, orderId: number): Promise<ApiResponse<void>> {
    const response = await axios.post(
      `${API_BASE_URL}/stock/release`,
      { productId, quantity, orderId },
      this.getAuthHeaders()
    );
    return response.data;
  }

  async fixIntegrity(): Promise<ApiResponse<any>> {
    const response = await axios.post(
      `${API_BASE_URL}/stock/fix-integrity`,
      {},
      this.getAuthHeaders()
    );
    return response.data;
  }

  async recalculateNeeds(): Promise<ApiResponse<any>> {
    const response = await axios.post(
      `${API_BASE_URL}/production/recalculate`,
      {},
      this.getAuthHeaders()
    );
    return response.data;
  }

  async syncProduction(): Promise<ApiResponse<any>> {
    const response = await axios.post(
      `${API_BASE_URL}/production/sync/orders`,
      {},
      this.getAuthHeaders()
    );
    return response.data;
  }
}

export const stockApi = new StockApi(); 