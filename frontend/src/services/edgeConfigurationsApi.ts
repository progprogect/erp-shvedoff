import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface EdgeConfiguration {
  id: number;
  name: string;
  code: string;
  edgeType: 'puzzle' | 'straight';
  puzzleSides?: number; // количество сторон паззла (1, 2, 3, 4)
  puzzleTypeCode?: string; // код типа паззла
  description?: string;
  document: string;
  isSystem: boolean;
  createdAt: string;
  // Дополнительная информация о типе паззла
  puzzleTypeName?: string;
  puzzleTypeDescription?: string;
}

export interface CreateEdgeConfigurationRequest {
  name: string;
  code: string;
  edgeType: 'puzzle' | 'straight';
  puzzleSides?: number;
  puzzleTypeCode?: string;
  description?: string;
}

export interface UpdateEdgeConfigurationRequest {
  name?: string;
  code?: string;
  edgeType?: 'puzzle' | 'straight';
  puzzleSides?: number;
  puzzleTypeCode?: string;
  description?: string;
}

export interface EdgeConfigurationFilters {
  edgeType?: 'puzzle' | 'straight';
  puzzleSides?: number;
  puzzleTypeCode?: string;
}

class EdgeConfigurationsApi {
  private baseUrl = `${API_BASE_URL}/edge-configurations`;

  // Получить все конфигурации краёв
  async getEdgeConfigurations(token: string, filters?: EdgeConfigurationFilters): Promise<{
    success: boolean;
    data: EdgeConfiguration[];
    message?: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (filters?.edgeType) params.append('edgeType', filters.edgeType);
      if (filters?.puzzleSides) params.append('puzzleSides', filters.puzzleSides.toString());
      if (filters?.puzzleTypeCode) params.append('puzzleTypeCode', filters.puzzleTypeCode);

      const response = await axios.get(`${this.baseUrl}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return response.data;
    } catch (error: any) {
      console.error('Ошибка получения конфигураций краёв:', error);
      return {
        success: false,
        data: [],
        message: error.response?.data?.message || 'Ошибка получения конфигураций краёв'
      };
    }
  }

  // Получить конфигурацию края по ID
  async getEdgeConfiguration(token: string, id: number): Promise<{
    success: boolean;
    data?: EdgeConfiguration;
    message?: string;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return response.data;
    } catch (error: any) {
      console.error('Ошибка получения конфигурации края:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Ошибка получения конфигурации края'
      };
    }
  }

  // Создать новую конфигурацию края
  async createEdgeConfiguration(token: string, data: CreateEdgeConfigurationRequest): Promise<{
    success: boolean;
    data?: EdgeConfiguration;
    message?: string;
  }> {
    try {
      const response = await axios.post(this.baseUrl, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return response.data;
    } catch (error: any) {
      console.error('Ошибка создания конфигурации края:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Ошибка создания конфигурации края'
      };
    }
  }

  // Обновить конфигурацию края
  async updateEdgeConfiguration(token: string, id: number, data: UpdateEdgeConfigurationRequest): Promise<{
    success: boolean;
    data?: EdgeConfiguration;
    message?: string;
  }> {
    try {
      const response = await axios.put(`${this.baseUrl}/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return response.data;
    } catch (error: any) {
      console.error('Ошибка обновления конфигурации края:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Ошибка обновления конфигурации края'
      };
    }
  }

  // Удалить конфигурацию края
  async deleteEdgeConfiguration(token: string, id: number): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const response = await axios.delete(`${this.baseUrl}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return response.data;
    } catch (error: any) {
      console.error('Ошибка удаления конфигурации края:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Ошибка удаления конфигурации края'
      };
    }
  }

  // Получить конфигурации краёв для паззлов
  async getPuzzleEdgeConfigurations(token: string): Promise<{
    success: boolean;
    data: EdgeConfiguration[];
    message?: string;
  }> {
    return this.getEdgeConfigurations(token, { edgeType: 'puzzle' });
  }

  // Получить конфигурации краёв для прямых резов
  async getStraightEdgeConfigurations(token: string): Promise<{
    success: boolean;
    data: EdgeConfiguration[];
    message?: string;
  }> {
    return this.getEdgeConfigurations(token, { edgeType: 'straight' });
  }
}

export const edgeConfigurationsApi = new EdgeConfigurationsApi();
export default edgeConfigurationsApi;
