import { useCallback } from 'react';
import { MenuPermissions } from '../services/permissionsApi';
import { useAuthStore } from '../stores/authStore';
import { usePermissionsContext } from '../contexts/PermissionsContext';

// Импортируем тип для правильной типизации
interface PermissionsContextType {
  invalidateAllPermissions: () => void;
  registerInvalidationCallback: (callback: () => void) => () => void;
}

/**
 * Хук для работы с разрешениями пользователя
 * Теперь использует глобальный контекст вместо локального состояния
 */
export const usePermissions = () => {
  // Используем глобальный контекст разрешений
  const context = usePermissionsContext();
  
  console.log('🔗 usePermissions использует ГЛОБАЛЬНЫЙ контекст:', {
    hasContext: !!context,
    permissions: context?.permissions,
    loading: context?.loading,
    error: context?.error
  });

  // Если контекст недоступен - используем legacy логику
  if (!context) {
    console.warn('❌ PermissionsContext недоступен, используем fallback');
    const { user } = useAuthStore();
    const fallbackPermissions = getLegacyPermissions(user?.role || '');
    
    return {
      permissions: fallbackPermissions,
      loading: false,
      error: null,
      hasPermission: (resource: string, action?: string) => {
        const resourceAccess = fallbackPermissions[resource as keyof MenuPermissions];
        if (!resourceAccess) return false;
        if (action && fallbackPermissions.actions) {
          const actionKey = `${resource}_${action}`;
          return fallbackPermissions.actions[actionKey as keyof typeof fallbackPermissions.actions] || false;
        }
        return true;
      },
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
      canView: () => false,
      canCreate: () => false,
      canEdit: () => false,
      canDelete: () => false,
      canManage: () => false,
      canExecute: () => false,
      refetch: () => Promise.resolve(),
      invalidate: () => {}
    };
  }

  // Используем данные из глобального контекста
  const { permissions, loading, error, hasPermission, invalidateAllPermissions } = context;

  // Проверка любого из разрешений (ИЛИ)
  const hasAnyPermission = useCallback((checks: Array<{resource: string, action?: string}>): boolean => {
    return checks.some(check => hasPermission(check.resource, check.action));
  }, [hasPermission]);

  // Проверка всех разрешений (И)
  const hasAllPermissions = useCallback((checks: Array<{resource: string, action?: string}>): boolean => {
    return checks.every(check => hasPermission(check.resource, check.action));
  }, [hasPermission]);

  // Удобные методы для частых проверок
  const canView = useCallback((resource: string) => hasPermission(resource, 'view'), [hasPermission]);
  const canCreate = useCallback((resource: string) => hasPermission(resource, 'create'), [hasPermission]);
  const canEdit = useCallback((resource: string) => hasPermission(resource, 'edit'), [hasPermission]);
  const canDelete = useCallback((resource: string) => hasPermission(resource, 'delete'), [hasPermission]);
  const canManage = useCallback((resource: string) => hasPermission(resource, 'manage'), [hasPermission]);
  const canExecute = useCallback((resource: string) => hasPermission(resource, 'execute'), [hasPermission]);

  return {
    permissions,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canManage,
    canExecute,
    refetch: () => Promise.resolve(), // Теперь через контекст
    invalidate: invalidateAllPermissions
  };
};

// Legacy функция для fallback логики
const getLegacyPermissions = (role: string): MenuPermissions => {
  const basePermissions = {
    catalog: true, stock: true, orders: true, production: true, cutting: true, shipments: true,
    users: false, permissions: false, audit: false,
      actions: {
        catalog_create: false, catalog_edit: false, catalog_delete: false,
        stock_edit: false, stock_manage: false,
        orders_create: false, orders_edit: false, orders_delete: false,
        production_create: false, production_manage: false,
        cutting_create: false, cutting_execute: false,
        shipments_create: false, shipments_edit: false, shipments_delete: false, shipments_manage: false,
        users_manage: false,
      }
  };

  if (role === 'director') {
    return { 
      ...basePermissions, 
      users: true, 
      permissions: true, 
      audit: true,
      actions: {
        catalog_create: true, catalog_edit: true, catalog_delete: true,
        stock_edit: true, stock_manage: true,
        orders_create: true, orders_edit: true, orders_delete: true,
        production_create: true, production_manage: true,
        cutting_create: true, cutting_execute: true,
        shipments_create: true, shipments_edit: true, shipments_delete: true, shipments_manage: true,
        users_manage: true,
      }
    };
  }

  // Исправляем legacy логику согласно реальным permissions из backend
  if (role === 'manager') {
    return {
      ...basePermissions,
      actions: {
        catalog_create: true, catalog_edit: true, catalog_delete: false,
        stock_edit: false, stock_manage: false,
        orders_create: true, orders_edit: true, orders_delete: true,
        production_create: false, production_manage: false,
        cutting_create: true, cutting_execute: false, // Менеджер может создавать операции резки
        shipments_create: true, shipments_edit: true, shipments_delete: true, shipments_manage: true,
        users_manage: false,
      }
    };
  }

  if (role === 'production') {
    return {
      ...basePermissions,
      actions: {
        catalog_create: false, catalog_edit: false, catalog_delete: false,
        stock_edit: false, stock_manage: false,
        orders_create: false, orders_edit: false, orders_delete: false,
        production_create: true, production_manage: true,
        cutting_create: false, cutting_execute: true, // Производство может выполнять операции резки
        shipments_create: false, shipments_edit: false, shipments_delete: false, shipments_manage: false,
        users_manage: false,
      }
    };
  }

  if (role === 'warehouse') {
    return {
      ...basePermissions,
      actions: {
        catalog_create: false, catalog_edit: false, catalog_delete: false,
        stock_edit: true, stock_manage: false,
        orders_create: false, orders_edit: false, orders_delete: false,
        production_create: false, production_manage: false,
        cutting_create: false, cutting_execute: false,
        shipments_create: true, shipments_edit: true, shipments_delete: true, shipments_manage: true,
        users_manage: false,
      }
    };
  }

  return basePermissions;
};

export default usePermissions;
      ...basePermissions,
      actions: {
        catalog_create: true, catalog_edit: true, catalog_delete: false,
        stock_edit: false, stock_manage: false,
        orders_create: true, orders_edit: true, orders_delete: true,
        production_create: false, production_manage: false,
        cutting_create: true, cutting_execute: false, // Менеджер может создавать операции резки
        shipments_create: true, shipments_edit: true, shipments_delete: true, shipments_manage: true,
        users_manage: false,
      }
    };
  }

  if (role === 'production') {
    return {
      ...basePermissions,
      actions: {
        catalog_create: false, catalog_edit: false, catalog_delete: false,
        stock_edit: false, stock_manage: false,
        orders_create: false, orders_edit: false, orders_delete: false,
        production_create: true, production_manage: true,
        cutting_create: false, cutting_execute: true, // Производство может выполнять операции резки
        shipments_create: false, shipments_edit: false, shipments_delete: false, shipments_manage: false,
        users_manage: false,
      }
    };
  }

  if (role === 'warehouse') {
    return {
      ...basePermissions,
      actions: {
        catalog_create: false, catalog_edit: false, catalog_delete: false,
        stock_edit: true, stock_manage: false,
        orders_create: false, orders_edit: false, orders_delete: false,
        production_create: false, production_manage: false,
        cutting_create: false, cutting_execute: false,
        shipments_create: true, shipments_edit: true, shipments_delete: true, shipments_manage: true,
        users_manage: false,
      }
    };
  }

  return basePermissions;
};

export default usePermissions;