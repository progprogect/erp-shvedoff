import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

// Типы для дашборда
export interface OrderStats {
  new: number;
  confirmed: number;
  in_production: number;
  ready: number;
  shipped: number;
  delivered: number;
  total: number;
  totalAmount: number;
}

export interface StockStats {
  total: number;
  normal: number;
  low: number;
  critical: number;
}

export interface CriticalStockItem {
  productId: number;
  productName: string;
  article?: string;
  currentStock: number;
  reservedStock: number;
  normStock: number;
  availableStock: number;
  categoryName?: string;
}

export interface UrgentOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  priority: 'high' | 'urgent';
  status: string;
  deliveryDate?: string;
  totalAmount: number;
  managerName?: string;
  itemsCount: number;
}

export interface TodayShipment {
  id: number;
  shipmentNumber: string;
  status: string;
  actualDate?: string;
  plannedDate?: string;
  orderNumber?: string;
  customerName?: string;
}

export interface TotalMetrics {
  totalOrders: number;
  totalAmount: number;
  avgOrderAmount: number;
}

export interface DashboardData {
  orderStats: OrderStats;
  stockStats: StockStats;
  criticalStock: CriticalStockItem[];
  urgentOrders: UrgentOrder[];
  todayShipments: TodayShipment[];
  totalMetrics: TotalMetrics;
  lastUpdated: string;
}

export interface QuickStats {
  activeOrders: number;
  urgentOrders: number;
  criticalStock: number;
  lowStock: number;
  lastUpdated: string;
}

// API методы
class DashboardApi {
  private getAuthHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  // Получить все данные дашборда
  async getDashboardData(token: string): Promise<DashboardData> {
    const response = await axios.get<DashboardData>(
      `${API_BASE_URL}/dashboard`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  // Получить быструю статистику
  async getQuickStats(token: string): Promise<QuickStats> {
    const response = await axios.get<QuickStats>(
      `${API_BASE_URL}/dashboard/quick-stats`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }
}

export const dashboardApi = new DashboardApi();

export default dashboardApi; 