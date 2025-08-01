import axios from 'axios';
import { 
  SHIPMENT_STATUS_LABELS, 
  SHIPMENT_STATUS_COLORS, 
  SHIPMENT_STATUS_TRANSITIONS,
  type ShipmentStatus 
} from '../constants/shipmentStatuses';
import { API_BASE_URL } from '../config/api';

export interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerContact?: string;
  status: string;
  priority: string;
  deliveryDate?: string;
  totalAmount?: string;
  notes?: string;
  createdAt: string;
  manager?: {
    id: number;
    username: string;
    fullName?: string;
  };
  items?: Array<{
    id: number;
    productId: number;
    quantity: number;
    reservedQuantity: number;
    price?: string;
    product: {
      id: number;
      name: string;
      article?: string;
    };
  }>;
}

export interface ShipmentItem {
  id: number;
  shipmentId: number;
  productId: number;
  plannedQuantity: number;
  actualQuantity?: number;
  createdAt: string;
  product: {
    id: number;
    name: string;
    article?: string;
  };
}

export interface Shipment {
  id: number;
  shipmentNumber: string;
  orderId?: number;
  plannedDate?: string;
  actualDate?: string;
  transportInfo?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'paused';
  documentsPhotos?: string[];
  createdBy: number;
  createdAt: string;
  order?: Order;
  createdByUser?: {
    id: number;
    username: string;
    fullName?: string;
  };
  items?: ShipmentItem[];
  relatedOrders?: Order[];
}

export interface CreateShipmentRequest {
  orderIds: number[];
  plannedDate?: string;
  transportInfo?: string;
  notes?: string;
}

export interface UpdateShipmentStatusRequest {
  status: string;
  actualQuantities?: Record<number, number>;
  transportInfo?: string;
  documentsPhotos?: string[];
}

export interface UpdateShipmentRequest {
  plannedDate?: string;
  transportInfo?: string;
  documentsPhotos?: string[];
}

export interface ShipmentStatistics {
  total: number;
  todayCount: number;
  thisMonthCount: number;
  pendingCount: number;
  completedCount: number;
  cancelledCount: number;
  pausedCount: number;
}

class ShipmentsApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Получить все отгрузки
  async getShipments(params?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Shipment[]> {
    const response = await axios.get(`${API_BASE_URL}/shipments`, {
      headers: this.getAuthHeaders(),
      params
    });
    return response.data.data;
  }

  // Получить готовые к отгрузке заказы
  async getReadyOrders(): Promise<Order[]> {
    const response = await axios.get(`${API_BASE_URL}/shipments/ready-orders`, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Получить детали отгрузки
  async getShipment(id: number): Promise<Shipment> {
    const response = await axios.get(`${API_BASE_URL}/shipments/${id}`, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Создать новую отгрузку
  async createShipment(data: CreateShipmentRequest): Promise<Shipment> {
    const response = await axios.post(`${API_BASE_URL}/shipments`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Обновить статус отгрузки
  async updateShipmentStatus(id: number, data: UpdateShipmentStatusRequest): Promise<Shipment> {
    const response = await axios.put(`${API_BASE_URL}/shipments/${id}/status`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Обновить детали отгрузки
  async updateShipment(id: number, data: UpdateShipmentRequest): Promise<Shipment> {
    const response = await axios.put(`${API_BASE_URL}/shipments/${id}`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Отменить отгрузку
  async cancelShipment(id: number): Promise<Shipment> {
    const response = await axios.delete(`${API_BASE_URL}/shipments/${id}`, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Получить статистику отгрузок
  async getShipmentStatistics(): Promise<ShipmentStatistics> {
    const response = await axios.get(`${API_BASE_URL}/shipments/statistics`, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Загрузить фото документов
  async uploadDocumentPhoto(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await axios.post(`${API_BASE_URL}/upload/shipment-documents`, formData, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data.url;
  }

  // Вспомогательные методы
  getStatusColor(status: Shipment['status']): string {
    return SHIPMENT_STATUS_COLORS[status as ShipmentStatus] || '#d9d9d9';
  }

  getStatusText(status: Shipment['status']): string {
    return SHIPMENT_STATUS_LABELS[status as ShipmentStatus] || `Неизвестный статус: ${status}`;
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'orange';
      case 'normal':
        return 'blue';
      case 'low':
        return 'gray';
      default:
        return 'gray';
    }
  }

  getPriorityText(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'Срочный';
      case 'high':
        return 'Высокий';
      case 'normal':
        return 'Обычный';
      case 'low':
        return 'Низкий';
      default:
        return 'Неизвестно';
    }
  }

  // Проверка прав доступа
  canCreate(userRole: string): boolean {
    return userRole === 'manager' || userRole === 'director';
  }

  canEdit(userRole: string): boolean {
    return userRole === 'manager' || userRole === 'director';
  }

  canUpdateStatus(userRole: string): boolean {
    return userRole === 'manager' || userRole === 'director' || userRole === 'warehouse';
  }

  canCancel(userRole: string): boolean {
    return userRole === 'manager' || userRole === 'director';
  }

  canViewAll(userRole: string): boolean {
    return true; // Все роли могут просматривать отгрузки
  }

  // Валидация статусных переходов
  getValidNextStatuses(currentStatus: Shipment['status']): Shipment['status'][] {
    return SHIPMENT_STATUS_TRANSITIONS[currentStatus as ShipmentStatus] || [];
  }

  canTransitionTo(currentStatus: Shipment['status'], newStatus: Shipment['status']): boolean {
    const validStatuses = this.getValidNextStatuses(currentStatus);
    return validStatuses.includes(newStatus);
  }

  // Расчет общего веса/объема отгрузки
  calculateShipmentSummary(shipment: Shipment): {
    totalItems: number;
    totalProducts: number;
    hasActualQuantities: boolean;
  } {
    if (!shipment.items) {
      return {
        totalItems: 0,
        totalProducts: 0,
        hasActualQuantities: false
      };
    }

    const totalItems = shipment.items.reduce((sum, item) => sum + item.plannedQuantity, 0);
    const totalProducts = shipment.items.length;
    const hasActualQuantities = shipment.items.some(item => item.actualQuantity !== null && item.actualQuantity !== undefined);

    return {
      totalItems,
      totalProducts,
      hasActualQuantities
    };
  }

  // Форматирование даты для отображения
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Проверка просроченности
  isOverdue(shipment: Shipment): boolean {
    if (!shipment.plannedDate || shipment.status === 'completed' || shipment.status === 'cancelled') {
      return false;
    }

    const today = new Date();
    const plannedDate = new Date(shipment.plannedDate);
    return plannedDate < today;
  }

  // Группировка отгрузок по статусам
  groupByStatus(shipments: Shipment[]): Record<string, Shipment[]> {
    return shipments.reduce((groups, shipment) => {
      const status = shipment.status;
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(shipment);
      return groups;
    }, {} as Record<string, Shipment[]>);
  }

  // Экспорт отгрузок в Excel (Задача 9.2)
  async exportShipments(filters?: any): Promise<void> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/shipments/export`,
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
      let filename = 'shipments-export.xlsx';
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
      console.error('Error exporting shipments:', error);
      throw new Error('Ошибка при экспорте отгрузок');
    }
  }
}

export const shipmentsApi = new ShipmentsApiService();
export default shipmentsApi; 