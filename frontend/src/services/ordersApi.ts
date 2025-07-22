import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL } from '../config/api';

export interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerContact?: string;
  status: 'new' | 'confirmed' | 'in_production' | 'ready' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  deliveryDate?: string;
  managerId: number;
  totalAmount: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  manager?: {
    id: number;
    username: string;
    fullName?: string;
    role: string;
  };
  items?: OrderItem[];
  messages?: OrderMessage[];
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  reservedQuantity: number;
  price: string;
  createdAt: string;
  product?: {
    id: number;
    name: string;
    article?: string;
    categoryName?: string;
    stock?: {
      currentStock: number;
      reservedStock: number;
      availableStock?: number;
      inProductionQuantity?: number;
    };
  };
}

export interface OrderMessage {
  id: number;
  orderId: number;
  userId: number;
  message: string;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    fullName?: string;
    role: string;
  };
}

export interface CreateOrderRequest {
  customerName: string;
  customerContact?: string;
  deliveryDate?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
  managerId?: number; // Добавляем поле для назначения менеджера
  items: {
    productId: number;
    quantity: number;
    price: number;
  }[];
}

export interface OrderFilters {
  status?: string;
  priority?: string;
  managerId?: number;
  limit?: number;
  offset?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  message?: string;
}

class OrdersApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async getOrders(filters: OrderFilters = {}): Promise<ApiResponse<Order[]>> {
    try {
      const params = new URLSearchParams();
      
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.managerId) params.append('managerId', filters.managerId.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await axios.get(`${API_BASE_URL}/orders?${params}`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      return {
        success: false,
        data: [],
        message: error.response?.data?.message || 'Ошибка загрузки заказов'
      };
    }
  }

  async getOrder(id: number): Promise<ApiResponse<Order>> {
    try {
      const response = await axios.get(`${API_BASE_URL}/orders/${id}`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching order:', error);
      return {
        success: false,
        data: {} as Order,
        message: error.response?.data?.message || 'Ошибка загрузки заказа'
      };
    }
  }

  async createOrder(orderData: CreateOrderRequest): Promise<ApiResponse<Order>> {
    try {
      const response = await axios.post(`${API_BASE_URL}/orders`, orderData, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error: any) {
      console.error('Error creating order:', error);
      return {
        success: false,
        data: {} as Order,
        message: error.response?.data?.message || 'Ошибка создания заказа'
      };
    }
  }

  async updateOrder(orderId: number, orderData: any): Promise<ApiResponse<Order>> {
    const response = await axios.put(`${API_BASE_URL}/orders/${orderId}`, orderData, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async updateOrderStatus(id: number, status: string, comment?: string): Promise<ApiResponse<Order>> {
    try {
      const response = await axios.put(`${API_BASE_URL}/orders/${id}/status`, 
        { status, comment },
        { headers: this.getAuthHeaders() }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error updating order status:', error);
      return {
        success: false,
        data: {} as Order,
        message: error.response?.data?.message || 'Ошибка обновления статуса заказа'
      };
    }
  }

  async addMessage(id: number, message: string): Promise<ApiResponse<OrderMessage>> {
    try {
      const response = await axios.post(`${API_BASE_URL}/orders/${id}/messages`, 
        { message },
        { headers: this.getAuthHeaders() }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error adding message:', error);
      return {
        success: false,
        data: {} as OrderMessage,
        message: error.response?.data?.message || 'Ошибка добавления сообщения'
      };
    }
  }

  async deleteOrder(id: number): Promise<ApiResponse<void>> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/orders/${id}`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error: any) {
      console.error('Error deleting order:', error);
      return {
        success: false,
        data: undefined as any,
        message: error.response?.data?.message || 'Ошибка удаления заказа'
      };
    }
  }
}

export const ordersApi = new OrdersApiService(); 

// Get orders by product
export const getOrdersByProduct = async (productId: number): Promise<ApiResponse<Order[]>> => {
  try {
    const { token } = useAuthStore.getState();
    const response = await fetch(`${API_BASE_URL}/orders/by-product/${productId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching orders by product:', error);
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Ошибка при получении заказов по товару'
    };
  }
}; 