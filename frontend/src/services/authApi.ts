import axios from 'axios';
import { User } from '../stores/authStore';

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
    const response = await axios.post('http://localhost:5001/api/auth/login', {
      username,
      password
    });
    return response.data;
  }

  // Обновление токена - ПРАВИЛЬНЫЙ ПУТЬ!
  async refreshToken(token: string): Promise<LoginResponse> {
    const response = await axios.post('http://localhost:5001/api/auth/refresh', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  // Получение данных пользователя - ПРАВИЛЬНЫЙ ПУТЬ!
  async getMe(token: string): Promise<{ success: boolean; user: User }> {
    const response = await axios.get('http://localhost:5001/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  // Выход из системы - ПРАВИЛЬНЫЙ ПУТЬ!
  async logout(token: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.post('http://localhost:5001/api/auth/logout', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }
}

export const authApi = new AuthApi(); 