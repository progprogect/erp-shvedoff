import axios from 'axios';
import { User } from '../stores/authStore';
import { API_BASE_URL } from '../config/api';

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
  // Логин пользователя - ПРАВИЛЬНЫЙ ПУТЬ!
  async login(username: string, password: string): Promise<LoginResponse> {
    console.log('🔐 Авторизация через:', '/api/auth/login');
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username,
      password
    });
    return response.data;
  }

  // Обновление токена - ПРАВИЛЬНЫЙ ПУТЬ!
  async refreshToken(token: string): Promise<LoginResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  // Получение данных пользователя - ПРАВИЛЬНЫЙ ПУТЬ!
  async getMe(token: string): Promise<{ success: boolean; user: User }> {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  // Выход из системы - ПРАВИЛЬНЫЙ ПУТЬ!
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