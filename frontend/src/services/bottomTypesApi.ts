import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface BottomType {
  id: number;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
}

class BottomTypesApi {
  private baseURL = `${API_BASE_URL}/bottom-types`;

  async getBottomTypes(token: string): Promise<{ success: boolean; data: BottomType[]; message?: string }> {
    try {
      const response = await axios.get(this.baseURL, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Ошибка получения типов низа ковра:', error);
      return {
        success: false,
        data: [],
        message: error.response?.data?.message || 'Ошибка получения типов низа ковра'
      };
    }
  }

  async getBottomType(id: number, token: string): Promise<{ success: boolean; data: BottomType; message?: string }> {
    try {
      const response = await axios.get(`${this.baseURL}/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Ошибка получения типа низа ковра:', error);
      return {
        success: false,
        data: {} as BottomType,
        message: error.response?.data?.message || 'Ошибка получения типа низа ковра'
      };
    }
  }

  async createBottomType(data: { code: string; name: string; description?: string }, token: string): Promise<{ success: boolean; data: BottomType; message?: string }> {
    try {
      const response = await axios.post(this.baseURL, data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Ошибка создания типа низа ковра:', error);
      return {
        success: false,
        data: {} as BottomType,
        message: error.response?.data?.message || 'Ошибка создания типа низа ковра'
      };
    }
  }

  async updateBottomType(id: number, data: { code: string; name: string; description?: string }, token: string): Promise<{ success: boolean; data: BottomType; message?: string }> {
    try {
      const response = await axios.put(`${this.baseURL}/${id}`, data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Ошибка обновления типа низа ковра:', error);
      return {
        success: false,
        data: {} as BottomType,
        message: error.response?.data?.message || 'Ошибка обновления типа низа ковра'
      };
    }
  }

  async deleteBottomType(id: number, token: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await axios.delete(`${this.baseURL}/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Ошибка удаления типа низа ковра:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Ошибка удаления типа низа ковра'
      };
    }
  }
}

export default new BottomTypesApi();
