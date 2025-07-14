import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export interface Material {
  id: number;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  productCount?: number;
}

export interface CreateMaterialRequest {
  name: string;
  description?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class MaterialsApi {
  private getAuthHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  async getMaterials(token: string): Promise<ApiResponse<Material[]>> {
    const response = await axios.get(
      `${API_BASE_URL}/materials`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async createMaterial(material: CreateMaterialRequest, token: string): Promise<ApiResponse<Material>> {
    const response = await axios.post(
      `${API_BASE_URL}/materials`,
      material,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async deleteMaterial(id: number, token: string): Promise<ApiResponse<void>> {
    const response = await axios.delete(
      `${API_BASE_URL}/materials/${id}`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }
}

export const materialsApi = new MaterialsApi(); 