import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export interface ProductionQueueItem {
  id: number;
  orderId?: number;
  productId: number;
  quantity: number;
  priority: number;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  actualStartDate?: string;
  actualCompletionDate?: string;
  status: 'queued' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  product?: {
    id: number;
    name: string;
    article?: string;
    category?: {
      id: number;
      name: string;
    };
    stock?: {
      currentStock: number;
      reservedStock: number;
    };
  };
  order?: {
    id: number;
    orderNumber: string;
    customerName: string;
    status: string;
    priority: string;
    deliveryDate?: string;
    manager?: {
      id: number;
      username: string;
      fullName?: string;
    };
  };
}

export interface ProductionStats {
  byStatus: {
    status: string;
    count: number;
  }[];
  urgentItems: number;
  overdueItems: number;
}

export interface UpdateProductionStatusRequest {
  status: 'queued' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface CreateProductionItemRequest {
  productId: number;
  quantity: number;
  priority?: number;
  notes?: string;
}

export interface ProductionFilters {
  status?: string;
  priority?: number;
  limit?: number;
  offset?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class ProductionApiService {
  private getAuthHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async getProductionQueue(filters: ProductionFilters = {}, token: string): Promise<ApiResponse<ProductionQueueItem[]>> {
    try {
      const params = new URLSearchParams();
      
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await axios.get(`${API_BASE_URL}/production/queue?${params}`, {
        headers: this.getAuthHeaders(token)
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching production queue:', error);
      return {
        success: false,
        data: [],
        message: error.response?.data?.message || 'Ошибка загрузки очереди производства'
      };
    }
  }

  async getProductionItem(id: number, token: string): Promise<ApiResponse<ProductionQueueItem>> {
    try {
      const response = await axios.get(`${API_BASE_URL}/production/queue/${id}`, {
        headers: this.getAuthHeaders(token)
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching production item:', error);
      return {
        success: false,
        data: {} as ProductionQueueItem,
        message: error.response?.data?.message || 'Ошибка загрузки элемента производства'
      };
    }
  }

  async updateProductionStatus(id: number, data: UpdateProductionStatusRequest, token: string): Promise<ApiResponse<ProductionQueueItem>> {
    try {
      const response = await axios.put(`${API_BASE_URL}/production/queue/${id}/status`, data, {
        headers: this.getAuthHeaders(token)
      });

      return response.data;
    } catch (error: any) {
      console.error('Error updating production status:', error);
      return {
        success: false,
        data: {} as ProductionQueueItem,
        message: error.response?.data?.message || 'Ошибка обновления статуса производства'
      };
    }
  }

  async autoQueue(token: string): Promise<ApiResponse<ProductionQueueItem[]>> {
    try {
      const response = await axios.post(`${API_BASE_URL}/production/auto-queue`, {}, {
        headers: this.getAuthHeaders(token)
      });

      return response.data;
    } catch (error: any) {
      console.error('Error auto-queueing production:', error);
      return {
        success: false,
        data: [],
        message: error.response?.data?.message || 'Ошибка автоматической постановки в очередь'
      };
    }
  }

  async createProductionItem(data: CreateProductionItemRequest, token: string): Promise<ApiResponse<ProductionQueueItem>> {
    try {
      const response = await axios.post(`${API_BASE_URL}/production/queue`, data, {
        headers: this.getAuthHeaders(token)
      });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      console.error('Ошибка создания задания на производство:', error);
      return {
        success: false,
        data: null as any,
        message: error.response?.data?.message || 'Ошибка создания задания на производство'
      };
    }
  }

  async getProductionStats(token: string): Promise<ApiResponse<ProductionStats>> {
    try {
      const response = await axios.get(`${API_BASE_URL}/production/stats`, {
        headers: this.getAuthHeaders(token)
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching production stats:', error);
      return {
        success: false,
        data: {
          byStatus: [],
          urgentItems: 0,
          overdueItems: 0
        },
        message: error.response?.data?.message || 'Ошибка загрузки статистики производства'
      };
    }
  }
}

export const productionApi = new ProductionApiService(); 