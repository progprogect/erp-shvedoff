import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface User {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  role: 'director' | 'manager' | 'production' | 'warehouse';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  username: string;
  fullName?: string;
  email?: string;
  password: string;
  role: string;
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

export interface ChangePasswordRequest {
  newPassword: string;
}

export interface UserStatistics {
  total: number;
  active: number;
  inactive: number;
  directors: number;
  managers: number;
  production: number;
  warehouse: number;
}

class UsersApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Получить всех пользователей
  async getUsers(params?: {
    search?: string;
    role?: string;
    limit?: number;
    offset?: number;
  }): Promise<User[]> {
    const response = await axios.get(`${API_BASE_URL}/users`, {
      headers: this.getAuthHeaders(),
      params
    });
    return response.data.data;
  }

  // Получить пользователя по ID
  async getUser(id: number): Promise<User> {
    const response = await axios.get(`${API_BASE_URL}/users/${id}`, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Создать нового пользователя
  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await axios.post(`${API_BASE_URL}/users`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Обновить пользователя
  async updateUser(id: number, data: UpdateUserRequest): Promise<User> {
    const response = await axios.put(`${API_BASE_URL}/users/${id}`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Изменить пароль пользователя
  async changePassword(id: number, data: ChangePasswordRequest): Promise<void> {
    await axios.put(`${API_BASE_URL}/users/${id}/password`, data, {
      headers: this.getAuthHeaders()
    });
  }

  // Деактивировать пользователя
  async deactivateUser(id: number): Promise<void> {
    await axios.delete(`${API_BASE_URL}/users/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Активировать пользователя
  async activateUser(id: number): Promise<void> {
    await axios.put(`${API_BASE_URL}/users/${id}/activate`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  // Получить статистику пользователей
  async getUserStatistics(): Promise<UserStatistics> {
    const response = await axios.get(`${API_BASE_URL}/users/statistics`, {
      headers: this.getAuthHeaders()
    });
    return response.data.data;
  }

  // Вспомогательные методы
  getRoleColor(role: User['role']): string {
    switch (role) {
      case 'director':
        return 'red';
      case 'manager':
        return 'blue';
      case 'production':
        return 'orange';
      case 'warehouse':
        return 'green';
      default:
        return 'gray';
    }
  }

  getRoleText(role: User['role']): string {
    switch (role) {
      case 'director':
        return 'Директор';
      case 'manager':
        return 'Менеджер';
      case 'production':
        return 'Производство';
      case 'warehouse':
        return 'Склад';
      default:
        return 'Неизвестно';
    }
  }

  getStatusColor(isActive: boolean): string {
    return isActive ? 'green' : 'red';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Активен' : 'Неактивен';
  }

  // Проверка прав доступа
  canManageUsers(userRole: string): boolean {
    return userRole === 'director';
  }

  canCreateUser(userRole: string): boolean {
    return userRole === 'director';
  }

  canEditUser(userRole: string): boolean {
    return userRole === 'director';
  }

  canChangePassword(userRole: string): boolean {
    return userRole === 'director';
  }

  canDeactivateUser(userRole: string): boolean {
    return userRole === 'director';
  }

  // Валидация
  validateUsername(username: string): string | null {
    if (!username || username.length < 3) {
      return 'Имя пользователя должно содержать минимум 3 символа';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return 'Имя пользователя может содержать только латинские буквы, цифры и подчеркивания';
    }
    return null;
  }

  validatePassword(password: string): string | null {
    if (!password || password.length < 6) {
      return 'Пароль должен содержать минимум 6 символов';
    }
    return null;
  }

  validateEmail(email: string): string | null {
    if (!email) return null; // email не обязателен
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Некорректный формат email';
    }
    return null;
  }

  // Фильтрация пользователей
  filterUsers(users: User[], filters: {
    search?: string;
    role?: string;
    isActive?: boolean;
  }): User[] {
    let filtered = [...users];

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(user =>
        user.username.toLowerCase().includes(search) ||
        (user.fullName && user.fullName.toLowerCase().includes(search)) ||
        (user.email && user.email.toLowerCase().includes(search))
      );
    }

    if (filters.role) {
      filtered = filtered.filter(user => user.role === filters.role);
    }

    if (filters.isActive !== undefined) {
      filtered = filtered.filter(user => user.isActive === filters.isActive);
    }

    return filtered;
  }

  // Сортировка пользователей
  sortUsers(users: User[], sortBy: 'username' | 'role' | 'createdAt' | 'isActive', order: 'asc' | 'desc' = 'asc'): User[] {
    const sorted = [...users].sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      if (sortBy === 'createdAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  // Группировка пользователей по ролям
  groupByRole(users: User[]): Record<string, User[]> {
    return users.reduce((groups, user) => {
      const role = user.role;
      if (!groups[role]) {
        groups[role] = [];
      }
      groups[role].push(user);
      return groups;
    }, {} as Record<string, User[]>);
  }

  // Получить список ролей
  getAvailableRoles(): Array<{ value: string; label: string }> {
    return [
      { value: 'director', label: 'Директор' },
      { value: 'manager', label: 'Менеджер по продажам' },
      { value: 'production', label: 'Производство' },
      { value: 'warehouse', label: 'Склад/Охрана' }
    ];
  }

  // Форматирование даты
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Генерация случайного пароля
  generateRandomPassword(length: number = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Проверка безопасности пароля
  checkPasswordStrength(password: string): {
    score: number; // 0-4
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) {
      score++;
    } else {
      feedback.push('Пароль должен содержать минимум 8 символов');
    }

    if (/[a-z]/.test(password)) {
      score++;
    } else {
      feedback.push('Добавьте строчные буквы');
    }

    if (/[A-Z]/.test(password)) {
      score++;
    } else {
      feedback.push('Добавьте заглавные буквы');
    }

    if (/[0-9]/.test(password)) {
      score++;
    } else {
      feedback.push('Добавьте цифры');
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      score++;
    } else {
      feedback.push('Добавьте специальные символы');
    }

    return { score, feedback };
  }
}

export const usersApi = new UsersApiService();
export default usersApi; 