import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export interface Logo {
  id: number;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  productCount?: number;
}

export interface CreateLogoRequest {
  name: string;
  description?: string;
}

export interface UpdateLogoRequest {
  name: string;
  description?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class LogosApi {
  private getAuthHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  async getLogos(token: string): Promise<ApiResponse<Logo[]>> {
    const response = await axios.get(
      `${API_BASE_URL}/logos`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async createLogo(logo: CreateLogoRequest, token: string): Promise<ApiResponse<Logo>> {
    const response = await axios.post(
      `${API_BASE_URL}/logos`,
      logo,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async updateLogo(id: number, logo: UpdateLogoRequest, token: string): Promise<ApiResponse<Logo>> {
    const response = await axios.put(
      `${API_BASE_URL}/logos/${id}`,
      logo,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async deleteLogo(id: number, token: string): Promise<ApiResponse<void>> {
    const response = await axios.delete(
      `${API_BASE_URL}/logos/${id}`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }
}

export const logosApi = new LogosApi(); 