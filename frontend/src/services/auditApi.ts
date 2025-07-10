import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export interface AuditLog {
  id: number;
  tableName: string;
  recordId: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues?: any;
  newValues?: any;
  createdAt: string;
  userName?: string;
  userRole?: string;
  userId: number;
  operationText: string;
  tableText: string;
  description: string;
}

export interface AuditStats {
  operations: Array<{ operation: string; count: number }>;
  tables: Array<{ tableName: string; count: number }>;
  users: Array<{ userId: number; userName: string; userRole: string; count: number }>;
  weeklyActivity: Array<{ date: string; count: number }>;
}

export interface AuditFilters {
  tableName?: string;
  operation?: string;
  userId?: number;
  recordId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
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

class AuditApiService {
  private getAuthHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async getAuditLogs(filters: AuditFilters = {}, token: string): Promise<ApiResponse<AuditLog[]>> {
    try {
      const params = new URLSearchParams();
      
      if (filters.tableName) params.append('tableName', filters.tableName);
      if (filters.operation) params.append('operation', filters.operation);
      if (filters.userId) params.append('userId', filters.userId.toString());
      if (filters.recordId) params.append('recordId', filters.recordId.toString());
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await axios.get(`${API_BASE_URL}/audit?${params}`, {
        headers: this.getAuthHeaders(token)
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      return {
        success: false,
        data: [],
        message: error.response?.data?.message || 'Ошибка загрузки логов аудита'
      };
    }
  }

  async getAuditStats(token: string): Promise<ApiResponse<AuditStats>> {
    try {
      const response = await axios.get(`${API_BASE_URL}/audit/stats`, {
        headers: this.getAuthHeaders(token)
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching audit stats:', error);
      return {
        success: false,
        data: {
          operations: [],
          tables: [],
          users: [],
          weeklyActivity: []
        },
        message: error.response?.data?.message || 'Ошибка загрузки статистики аудита'
      };
    }
  }
}

export const auditApi = new AuditApiService(); 