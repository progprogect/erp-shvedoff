import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface CuttingOperation {
  id: number;
  sourceProductId: number;
  targetProductId: number;
  sourceQuantity: number;
  targetQuantity: number;
  wasteQuantity: number;
  actualTargetQuantity?: number;
  actualSecondGradeQuantity?: number;
  actualDefectQuantity?: number;
  status: 'in_progress' | 'paused' | 'completed' | 'cancelled'; // Добавлен статус paused
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
  actualSecondGradeQuantity?: number;
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
      'paused': 'warning',
      'completed': 'success',
      'cancelled': 'error'
    };
    return statusColors[status] || 'default';
  }

  getStatusText(status: CuttingOperation['status']): string {
    const statusTexts: Record<CuttingOperation['status'], string> = {
      'in_progress': 'В процессе',
      'paused': 'На паузе',
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

  // Получить валидные следующие статусы для данного статуса
  getValidNextStatuses(currentStatus: CuttingOperation['status']): CuttingOperation['status'][] {
    const validTransitions: Record<CuttingOperation['status'], CuttingOperation['status'][]> = {
      'in_progress': ['paused', 'completed', 'cancelled'],
      'paused': ['in_progress', 'cancelled'],
      'completed': [], // Завершенные операции нельзя изменить
      'cancelled': ['in_progress'] // Можно возобновить отмененную операцию
    };
    return validTransitions[currentStatus] || [];
  }

  // Экспорт операций резки в Excel (Задача 9.2)
  async exportCuttingOperations(filters?: any): Promise<void> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/cutting/export`,
        { filters },
        {
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          responseType: 'blob' // Важно для получения файла
        }
      );

      // Создаем ссылку для скачивания файла
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Извлекаем имя файла из заголовков ответа
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'cutting-operations-export.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting cutting operations:', error);
      throw new Error('Ошибка при экспорте операций резки');
    }
  }
}

export const cuttingApi = new CuttingApiService();
export default cuttingApi; 