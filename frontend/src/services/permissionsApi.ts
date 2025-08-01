import { useAuthStore } from '../stores/authStore';
import { API_PERMISSIONS_BASE as API_BASE } from '../config/api';

export interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description?: string;
  createdAt: string;
}

export interface UserPermission {
  id: number;
  name: string;
  resource: string;
  action: string;
  granted: boolean;
  source: 'role' | 'user';
}

export interface UserPermissions {
  role: string;
  permissions: UserPermission[];
}

export interface MenuPermissions {
  catalog: boolean;
  stock: boolean;
  orders: boolean;
  production: boolean;
  cutting: boolean;
  shipments: boolean;
  users: boolean;
  permissions: boolean;
  audit: boolean;
  actions: {
    catalog_create: boolean;
    catalog_edit: boolean;
    catalog_delete: boolean;
    stock_edit: boolean;
    stock_manage: boolean;
    orders_create: boolean;
    orders_edit: boolean;
    orders_delete: boolean;
    production_create: boolean;
    production_manage: boolean;
    cutting_create: boolean;
    cutting_execute: boolean;
    shipments_create: boolean;
    shipments_manage: boolean;
    users_manage: boolean;
  };
}

class PermissionsApi {
  private async fetch(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    const fullUrl = `${API_BASE}${url}`;
    
    console.log('🌐 PermissionsApi.fetch:', {
      url: fullUrl,
      token: token ? `${token.substring(0, 20)}...` : 'НЕТ ТОКЕНА',
      API_BASE
    });
    
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Network error' }));
        console.error('❌ API Error:', { status: response.status, error });
        throw new Error(error.message || 'Ошибка сети');
      }

      const data = await response.json();
      console.log('✅ API Success:', { url, data });
      return data;
    } catch (error) {
      console.error('❌ Fetch Error:', { url: fullUrl, error });
      throw error;
    }
  }

  // Получить все разрешения в системе
  async getPermissions(): Promise<{
    permissions: Permission[];
    grouped: Record<string, Permission[]>;
  }> {
    const response = await this.fetch('/');
    return response.data;
  }

  // Получить разрешения для всех ролей
  async getRolePermissions(): Promise<Record<string, Permission[]>> {
    const response = await this.fetch('/roles');
    return response.data;
  }

  // Получить разрешения конкретного пользователя
  async getUserPermissions(userId: number): Promise<UserPermissions> {
    const response = await this.fetch(`/users/${userId}`);
    return response.data;
  }

  // Установить разрешения для роли
  async setRolePermissions(role: string, permissionIds: number[]): Promise<void> {
    await this.fetch(`/roles/${role}`, {
      method: 'POST',
      body: JSON.stringify({ permissionIds })
    });
  }

  // Установить индивидуальные разрешения пользователя
  async setUserPermissions(userId: number, permissions: Array<{ permissionId: number; granted: boolean }>): Promise<void> {
    await this.fetch(`/users/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ permissions })
    });
  }

  // Инициализировать базовые разрешения
  async initializePermissions(): Promise<void> {
    await this.fetch('/initialize', {
      method: 'POST'
    });
  }

  // Получить разрешения текущего пользователя
  async getMyPermissions(): Promise<UserPermissions> {
    const response = await this.fetch('/check');
    return response.data;
  }

  // Проверить конкретное разрешение
  async checkPermission(resource: string, action: string): Promise<boolean> {
    const response = await this.fetch('/check-specific', {
      method: 'POST',
      body: JSON.stringify({ resource, action })
    });
    return response.data.granted;
  }

  // Получить разрешения для формирования меню
  async getMenuPermissions(): Promise<MenuPermissions> {
    const response = await this.fetch('/user-menu');
    return response.data;
  }

  // Получить права экспорта текущего пользователя (Задача 1: Система прав доступа)
  async getExportRights(): Promise<{
    catalog: boolean;
    orders: boolean;
    production: boolean;
    cutting: boolean;
    shipments: boolean;
  }> {
    const response = await this.fetch('/export-rights');
    return response.data;
  }
}

export const permissionsApi = new PermissionsApi(); 