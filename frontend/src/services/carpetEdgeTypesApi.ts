import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface CarpetEdgeType {
  id: number;
  name: string;
  code: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
}

export interface CarpetEdgeTypesResponse {
  success: boolean;
  data: CarpetEdgeType[];
}

export interface CarpetEdgeTypeResponse {
  success: boolean;
  data: CarpetEdgeType;
}

class CarpetEdgeTypesApi {
  private baseURL = `${API_BASE_URL}/carpet-edge-types`;

  async getCarpetEdgeTypes(token: string): Promise<CarpetEdgeTypesResponse> {
    try {
      const response = await axios.get(this.baseURL, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка получения типов края ковра:', error);
      throw error;
    }
  }

  async getCarpetEdgeType(id: number, token: string): Promise<CarpetEdgeTypeResponse> {
    try {
      const response = await axios.get(`${this.baseURL}/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка получения типа края ковра:', error);
      throw error;
    }
  }
}

export default new CarpetEdgeTypesApi();
