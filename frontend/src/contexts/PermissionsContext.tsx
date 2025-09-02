import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { permissionsApi, MenuPermissions } from '../services/permissionsApi';
import { useAuthStore } from '../stores/authStore';

/**
 * Контекст для глобального управления разрешениями
 * Позволяет обновлять разрешения во всех компонентах при изменениях
 */
interface PermissionsContextType {
  /**
   * Текущие разрешения пользователя
   */
  permissions: MenuPermissions | null;
  
  /**
   * Состояние загрузки разрешений
   */
  loading: boolean;
  
  /**
   * Ошибка загрузки разрешений
   */
  error: string | null;
  
  /**
   * Принудительно обновляет разрешения во всех компонентах
   * Используется после изменения групповых или индивидуальных разрешений
   */
  invalidateAllPermissions: () => void;
  
  /**
   * Регистрирует компонент для получения уведомлений об обновлениях
   */
  registerInvalidationCallback: (callback: () => void) => () => void;
  
  /**
   * Проверка конкретного разрешения
   */
  hasPermission: (resource: string, action?: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isLoggingOut } = useAuthStore(); // 🔥 НОВОЕ: получаем logout и isLoggingOut
  const callbacksRef = useRef<Set<() => void>>(new Set());
  const logoutInProgressRef = useRef(false); // 🔥 НОВОЕ: дополнительная защита
  
  // Глобальное состояние разрешений
  const [permissions, setPermissions] = useState<MenuPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Флаг для предотвращения множественных запросов
  const isLoadingRef = useRef(false);

  // 🔥 НОВОЕ: Надежная обработка auth ошибок
  const handleAuthError = useCallback(async (error: any, context: string = 'unknown') => {
    // Защита от race conditions
    if (logoutInProgressRef.current || isLoggingOut) {
      console.log('🔒 Auth error handler: logout уже в процессе, пропускаем...', { context });
      return false; // Не auth ошибка для дальнейшей обработки
    }

    const isAuthError = error?.response?.status === 401 || error?.response?.status === 403;
    
    if (isAuthError) {
      logoutInProgressRef.current = true;
      
      // 🔥 РАСШИРЕННОЕ ЛОГИРОВАНИЕ
      console.warn('🚪 Автоматический logout из-за auth ошибки:', {
        context,
        status: error.response?.status,
        url: error.config?.url || error.request?.responseURL,
        message: error.response?.data?.message,
        user: user?.username,
        timestamp: new Date().toISOString(),
        headers: error.response?.headers
      });

      // 🔥 СОХРАНЯЕМ КОНТЕКСТ ДЛЯ DEBUGGING
      const errorContext = {
        reason: `Session expired in ${context}`,
        status: error.response?.status,
        url: error.config?.url || error.request?.responseURL,
        message: error.response?.data?.message,
        user: user?.username,
        timestamp: new Date().toISOString(),
        component: 'PermissionsProvider'
      };
      sessionStorage.setItem('lastAuthError', JSON.stringify(errorContext));

      try {
        await logout();
        console.log('✅ Auth error handler: logout завершен успешно');
      } catch (logoutError) {
        console.error('❌ Auth error handler: ошибка во время logout:', logoutError);
      } finally {
        logoutInProgressRef.current = false;
      }
      
      return true; // Была auth ошибка
    }
    
    return false; // Не auth ошибка
  }, [logout, user, isLoggingOut]);

  // Функция для генерации fallback разрешений
  const getLegacyPermissions = useCallback((role: string): MenuPermissions => {
    const basePermissions = {
      catalog: true, stock: true, orders: true, production: true, cutting: true, shipments: true,
      users: false, permissions: false, audit: false,
      actions: {
        catalog_create: false, catalog_edit: false, catalog_delete: false,
        stock_edit: false, stock_manage: false,
        orders_create: false, orders_edit: false, orders_delete: false,
        production_create: false, production_manage: false,
        cutting_create: false, cutting_execute: false,
        shipments_create: false, shipments_manage: false,
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
          shipments_create: true, shipments_manage: true,
          users_manage: true,
        }
      };
    }
    return basePermissions;
  }, []);

  // Загрузка разрешений (ТОЛЬКО ОДИН РАЗ ГЛОБАЛЬНО)
  const loadPermissions = useCallback(async () => {
    console.log('🌍 ГЛОБАЛЬНАЯ загрузка разрешений:', { 
      user: user?.username, 
      alreadyLoading: isLoadingRef.current,
      isLoggingOut,
      logoutInProgress: logoutInProgressRef.current
    });
    
    if (isLoadingRef.current || logoutInProgressRef.current || isLoggingOut) {
      console.log('⚠️ Глобальный запрос уже выполняется или logout в процессе');
      return;
    }
    
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);
      
      console.log('📡 Запрашиваем разрешения с сервера...');
      const userPermissions = await permissionsApi.getMenuPermissions();
      
      // Проверяем, что logout не произошел во время запроса
      if (logoutInProgressRef.current || isLoggingOut) {
        console.log('🔄 Logout произошел во время загрузки разрешений, отменяем результат');
        return;
      }
      
      console.log('✅ ГЛОБАЛЬНО получены разрешения:', userPermissions);
      console.log('🔍 ДЕТАЛИЗАЦИЯ разрешений:', {
        orders: userPermissions.orders,           // ← ЭТО orders+view
        production: userPermissions.production,   // ← ЭТО production+view  
        cutting: userPermissions.cutting,         // ← ЭТО cutting+view
        shipments: userPermissions.shipments,     // ← ЭТО shipments+view
        actions: {
          orders_create: userPermissions.actions?.orders_create,
          orders_edit: userPermissions.actions?.orders_edit,
          production_create: userPermissions.actions?.production_create,
          cutting_create: userPermissions.actions?.cutting_create,
          shipments_create: userPermissions.actions?.shipments_create
        }
      });
      setPermissions(userPermissions);
    } catch (err: any) {
      console.error('❌ ГЛОБАЛЬНАЯ ошибка загрузки разрешений:', {
        error: err,
        status: err?.response?.status,
        message: err?.response?.data?.message,
        url: err?.config?.url,
        user: user?.username
      });
      
      // 🔥 НОВОЕ: используем надежный обработчик auth ошибок
      const wasAuthError = await handleAuthError(err, 'loadPermissions');
      
      // Если не auth ошибка - обрабатываем как обычно
      if (!wasAuthError && !logoutInProgressRef.current) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки разрешений');
        console.log('🔄 Используем fallback разрешения для роли:', user.role);
        setPermissions(getLegacyPermissions(user.role));
      }
    } finally {
      if (!logoutInProgressRef.current) {
        setLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [user, getLegacyPermissions, handleAuthError, isLoggingOut]);
  
  // Загружаем разрешения при изменении пользователя
  useEffect(() => {
    console.log('📋 ГЛОБАЛЬНЫЙ useEffect для пользователя:', user?.username);
    loadPermissions();
  }, [user?.id]); // Убираем loadPermissions из зависимостей чтобы избежать циклов
  
  // Функция проверки разрешений
  const hasPermission = useCallback((resource: string, action?: string): boolean => {
    console.log('🎯 ГЛОБАЛЬНАЯ hasPermission:', {
      resource,
      action,
      permissions: permissions ? 'LOADED' : 'NULL',
      permissionsKeys: permissions ? Object.keys(permissions) : 'NO_KEYS'
    });
    
    if (!permissions) {
      console.log('❌ ГЛОБАЛЬНО: Нет разрешений');
      return false;
    }
    
    const resourceAccess = permissions[resource as keyof MenuPermissions];
    console.log('🔍 ГЛОБАЛЬНО доступ к ресурсу:', { resource, resourceAccess });
    
    if (!resourceAccess) {
      console.log('❌ ГЛОБАЛЬНО: Нет доступа к ресурсу');
      return false;
    }
    
    if (action) {
      // Для action='view' проверяем корневые свойства (orders, production, etc.)
      if (action === 'view') {
        const viewAccess = typeof resourceAccess === 'boolean' ? resourceAccess : false;
        console.log('🎯 ГЛОБАЛЬНО проверка VIEW:', { 
          resource, 
          viewAccess,
          resourceAccessValue: resourceAccess,
          resourceAccessType: typeof resourceAccess
        });
        return viewAccess;
      }
      
      // Для других действий (create, edit, delete, etc.) проверяем actions
      if (permissions.actions) {
        const actionKey = `${resource}_${action}`;
        const actionAccess = permissions.actions[actionKey as keyof typeof permissions.actions] || false;
        console.log('🎯 ГЛОБАЛЬНО проверка ДЕЙСТВИЯ:', { 
          actionKey, 
          actionAccess, 
          actionsKeys: Object.keys(permissions.actions),
          hasThisAction: actionKey in permissions.actions
        });
        return actionAccess;
      }
    }
    
    console.log('✅ ГЛОБАЛЬНО: Базовый доступ разрешен');
    return true;
  }, [permissions]);

  const registerInvalidationCallback = useCallback((callback: () => void) => {
    callbacksRef.current.add(callback);
    return () => { callbacksRef.current.delete(callback); };
  }, []);

  const invalidateAllPermissions = useCallback(() => {
    console.log('🔄 ГЛОБАЛЬНАЯ инвалидация разрешений');
    setPermissions(null);
    setError(null);
    isLoadingRef.current = false;
    loadPermissions();
    callbacksRef.current.forEach(callback => {
      try { callback(); } catch (error) { console.error('Ошибка при обновлении:', error); }
    });
  }, [loadPermissions]);

  return (
    <PermissionsContext.Provider value={{
      permissions, loading, error, hasPermission,
      invalidateAllPermissions, registerInvalidationCallback
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissionsContext = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissionsContext должен использоваться внутри PermissionsProvider');
  }
  return context;
};

export default PermissionsContext;