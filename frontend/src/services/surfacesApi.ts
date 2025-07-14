import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export interface Surface {
  id: number;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  productCount?: number;
}

export interface CreateSurfaceRequest {
  name: string;
  description?: string;
}

export interface UpdateSurfaceRequest {
  name: string;
  description?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class SurfacesApi {
  private getAuthHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  async getSurfaces(token: string): Promise<ApiResponse<Surface[]>> {
    const response = await axios.get(
      `${API_BASE_URL}/surfaces`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async createSurface(surface: CreateSurfaceRequest, token: string): Promise<ApiResponse<Surface>> {
    const response = await axios.post(
      `${API_BASE_URL}/surfaces`,
      surface,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async updateSurface(id: number, surface: UpdateSurfaceRequest, token: string): Promise<ApiResponse<Surface>> {
    const response = await axios.put(
      `${API_BASE_URL}/surfaces/${id}`,
      surface,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async deleteSurface(id: number, token: string): Promise<ApiResponse<void>> {
    const response = await axios.delete(
      `${API_BASE_URL}/surfaces/${id}`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }
}

export const surfacesApi = new SurfacesApi(); 