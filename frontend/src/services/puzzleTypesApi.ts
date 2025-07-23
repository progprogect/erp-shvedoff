import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface PuzzleType {
  id: number;
  name: string;
  code: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  productCount?: number;
}

export interface CreatePuzzleTypeRequest {
  name: string;
  code?: string;
  description?: string;
}

export interface UpdatePuzzleTypeRequest {
  name: string;
  code: string;
  description?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

class PuzzleTypesApi {
  private getAuthHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  async getPuzzleTypes(token: string): Promise<ApiResponse<PuzzleType[]>> {
    const response = await axios.get(
      `${API_BASE_URL}/puzzle-types`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async createPuzzleType(puzzleType: CreatePuzzleTypeRequest, token: string): Promise<ApiResponse<PuzzleType>> {
    const response = await axios.post(
      `${API_BASE_URL}/puzzle-types`,
      puzzleType,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async updatePuzzleType(id: number, puzzleType: UpdatePuzzleTypeRequest, token: string): Promise<ApiResponse<PuzzleType>> {
    const response = await axios.put(
      `${API_BASE_URL}/puzzle-types/${id}`,
      puzzleType,
      this.getAuthHeaders(token)
    );
    return response.data;
  }

  async deletePuzzleType(id: number, token: string): Promise<ApiResponse<void>> {
    const response = await axios.delete(
      `${API_BASE_URL}/puzzle-types/${id}`,
      this.getAuthHeaders(token)
    );
    return response.data;
  }
}

export const puzzleTypesApi = new PuzzleTypesApi(); 