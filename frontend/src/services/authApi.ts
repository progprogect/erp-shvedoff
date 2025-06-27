import axios from 'axios';
import { User } from '../stores/authStore';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface ApiError {
  error: {
    message: string;
    statusCode: number;
  };
}

class AuthApi {
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username,
      password
    });
    return response.data;
  }

  async refreshToken(token: string): Promise<LoginResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async getMe(token: string): Promise<{ success: boolean; user: User }> {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async logout(token: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }
}

export const authApi = new AuthApi(); 