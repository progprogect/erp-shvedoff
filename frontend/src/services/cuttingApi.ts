import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export interface CuttingOperation {
  id: number;
  sourceProductId: number;
  targetProductId: number;
  sourceQuantity: number;
  targetQuantity: number;
  wasteQuantity: number;
  status: 'in_progress' | 'completed' | 'cancelled'; // Упрощенные статусы без этапа утверждения
  operatorId?: number;
  plannedDate?: string;
  completedAt?: string;
  createdAt: string;
  sourceProduct: {
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
  targetProduct: {
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
  operator?: {
    id: number;
    username: string;
    fullName?: string;
  };
}

export interface CreateCuttingOperationRequest {
  sourceProductId: number;
  targetProductId: number;
  sourceQuantity: number;
  targetQuantity: number;
  plannedDate?: string;
  notes?: string;
  assignedTo?: number;
}

export interface CompleteCuttingOperationRequest {
  actualTargetQuantity: number;
  actualDefectQuantity?: number;
  notes?: string;
}

export interface CuttingOperationDetails extends CuttingOperation {
  movements: Array<{
    id: number;
    productId: number;
    movementType: string;
    quantity: number;
    comment?: string;
    createdAt: string;
    product: {
      id: number;
      name: string;
      article?: string;
    };
    user?: {
      id: number;
      username: string;
      fullName?: string;
    };
  }>;
}

class CuttingApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Получить все операции резки
  async getCuttingOperations(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<CuttingOperation[]> {
    const response = await axios.get(`${API_BASE_URL}/cutting`, {
      headers: this.getAuthHeaders(),
      params
    });
    return response.data.data;
  }

  // Получить детали операции резки
  async getCuttingOperation(id: number): Promise<CuttingOperationDetails> {
    const response = await axios.get(`${API_BASE_URL}/cutting/${id}`, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Создать новую заявку на резку
  async createCuttingOperation(data: CreateCuttingOperationRequest): Promise<CuttingOperation> {
    const response = await axios.post(`${API_BASE_URL}/cutting`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Обновить операцию резки (только до утверждения)
  async updateCuttingOperation(id: number, data: Partial<CreateCuttingOperationRequest>): Promise<CuttingOperation> {
    const response = await axios.put(`${API_BASE_URL}/cutting/${id}`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Завершить операцию резки
  async completeCuttingOperation(id: number, data: CompleteCuttingOperationRequest): Promise<CuttingOperationDetails> {
    const response = await axios.put(`${API_BASE_URL}/cutting/${id}/complete`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Изменить статус операции резки (новый метод)
  async changeOperationStatus(id: number, status: string): Promise<CuttingOperation> {
    const response = await axios.put(`${API_BASE_URL}/cutting/${id}/status`, { status }, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Отменить операцию резки
  async cancelCuttingOperation(id: number): Promise<void> {
    await axios.delete(`${API_BASE_URL}/cutting/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Получить статистику по операциям резки
  async getCuttingStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    thisMonth: number;
    totalWaste: number;
  }> {
    try {
      const operations = await this.getCuttingOperations();
      
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const stats = {
        total: operations.length,
        byStatus: {} as Record<string, number>,
        thisMonth: operations.filter(op => new Date(op.createdAt) >= thisMonth).length,
        totalWaste: operations
          .filter(op => op.status === 'completed')
          .reduce((sum, op) => sum + op.wasteQuantity, 0)
      };

      // Подсчет по статусам
      operations.forEach(op => {
        stats.byStatus[op.status] = (stats.byStatus[op.status] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error fetching cutting statistics:', error);
      return {
        total: 0,
        byStatus: {},
        thisMonth: 0,
        totalWaste: 0
      };
    }
  }

  // Статусы операций резки (упрощенные, без этапа утверждения)
  getStatusColor(status: CuttingOperation['status']): string {
    const statusColors: Record<CuttingOperation['status'], string> = {
      'in_progress': 'processing',
      'completed': 'success',
      'cancelled': 'error'
    };
    return statusColors[status] || 'default';
  }

  getStatusText(status: CuttingOperation['status']): string {
    const statusTexts: Record<CuttingOperation['status'], string> = {
      'in_progress': 'В процессе',
      'completed': 'Завершена',
      'cancelled': 'Отменена'
    };
    return statusTexts[status] || status;
  }

  // Проверка прав доступа
  canApprove(userRole: string): boolean {
    return userRole === 'director';
  }

  canStart(userRole: string): boolean {
    return ['production', 'director'].includes(userRole);
  }

  canComplete(userRole: string): boolean {
    return ['production', 'director'].includes(userRole);
  }

  canCancel(userRole: string): boolean {
    return ['production', 'director'].includes(userRole);
  }

  // DEPRECATED: Больше не используется
  /*
  async approveCuttingOperation(id: number): Promise<CuttingOperation> {
    const response = await axios.put(`${API_BASE_URL}/cutting/${id}/approve`, {}, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  async startCuttingOperation(id: number): Promise<CuttingOperation> {
    const response = await axios.put(`${API_BASE_URL}/cutting/${id}/start`, {}, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }
  */

  // Получить возможные следующие статусы
  getValidNextStatuses(currentStatus: CuttingOperation['status']): CuttingOperation['status'][] {
    const transitions: Record<CuttingOperation['status'], CuttingOperation['status'][]> = {
      'in_progress': ['completed', 'cancelled'],
      'completed': [], // Завершенные операции нельзя изменять
      'cancelled': ['in_progress'] // Можно вернуть отмененную обратно в процесс
    };

    return transitions[currentStatus] || [];
  }
}

export const cuttingApi = new CuttingApiService();
export default cuttingApi; 