import { Request, Response, NextFunction } from 'express';
import { db, schema } from '../db';
import { eq, and, or } from 'drizzle-orm';
import { createError } from './errorHandler';
import { AuthRequest } from './auth';

export interface PermissionCheck {
  resource: string;
  action: string;
}

/**
 * Проверяет есть ли у пользователя определенное разрешение
 */
export async function checkUserPermission(userId: number, resource: string, action: string): Promise<boolean> {
  try {
    // Получаем роль пользователя
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { role: true, isActive: true }
    });

    if (!user || !user.isActive) {
      return false;
    }

    // Ищем разрешение в системе
    const permission = await db.query.permissions.findFirst({
      where: and(
        eq(schema.permissions.resource, resource),
        eq(schema.permissions.action, action)
      )
    });

    if (!permission) {
      // Если разрешения нет в системе, используем старую логику на основе ролей
      return checkLegacyRolePermission(user.role, resource, action);
    }

    // Проверяем индивидуальные разрешения пользователя (приоритет над ролью)
    const userPermission = await db.query.userPermissions.findFirst({
      where: and(
        eq(schema.userPermissions.userId, userId),
        eq(schema.userPermissions.permissionId, permission.id)
      )
    });

    if (userPermission) {
      return userPermission.granted;
    }

    // Проверяем разрешения роли
    const rolePermission = await db.query.rolePermissions.findFirst({
      where: and(
        eq(schema.rolePermissions.role, user.role),
        eq(schema.rolePermissions.permissionId, permission.id)
      )
    });

    if (rolePermission) {
      return true;
    }

    // По умолчанию - нет доступа
    return false;
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
}

/**
 * Старая логика проверки разрешений на основе ролей (для обратной совместимости)
 */
function checkLegacyRolePermission(role: string, resource: string, action: string): boolean {
  // Директор имеет доступ ко всему
  if (role === 'director') {
    return true;
  }

  // Специфичные разрешения по ролям
  const rolePermissions: Record<string, Record<string, string[]>> = {
    manager: {
      catalog: ['view', 'create', 'edit'],
      stock: ['view'],
      orders: ['view', 'create', 'edit', 'delete'],
      shipments: ['view', 'create', 'edit'],
      production: ['view'],
      cutting: ['view', 'create']
    },
    production: {
      catalog: ['view'],
      stock: ['view'],
      orders: ['view'],
      production: ['view', 'create', 'edit', 'delete'],
      cutting: ['view', 'edit', 'delete']
    },
    warehouse: {
      catalog: ['view'],
      stock: ['view', 'edit'],
      orders: ['view'],
      shipments: ['view', 'edit']
    }
  };

  const resourcePermissions = rolePermissions[role]?.[resource];
  return resourcePermissions?.includes(action) || false;
}

/**
 * Middleware для проверки разрешений
 */
export function requirePermission(resource: string, action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(createError('Пользователь не авторизован', 401));
      }

      const hasPermission = await checkUserPermission(req.user.id, resource, action);
      
      if (!hasPermission) {
        return next(createError('Недостаточно прав доступа', 403));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware для проверки множественных разрешений (любое из)
 */
export function requireAnyPermission(permissions: PermissionCheck[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(createError('Пользователь не авторизован', 401));
      }

      // Проверяем каждое разрешение
      for (const permission of permissions) {
        const hasPermission = await checkUserPermission(
          req.user.id, 
          permission.resource, 
          permission.action
        );
        
        if (hasPermission) {
          next();
          return;
        }
      }

      return next(createError('Недостаточно прав доступа', 403));
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware для проверки множественных разрешений (все)
 */
export function requireAllPermissions(permissions: PermissionCheck[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(createError('Пользователь не авторизован', 401));
      }

      // Проверяем все разрешения
      for (const permission of permissions) {
        const hasPermission = await checkUserPermission(
          req.user.id, 
          permission.resource, 
          permission.action
        );
        
        if (!hasPermission) {
          return next(createError('Недостаточно прав доступа', 403));
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Получает все разрешения пользователя
 */
export async function getUserPermissions(userId: number): Promise<{
  role: string;
  permissions: Array<{
    id: number;
    name: string;
    resource: string;
    action: string;
    granted: boolean;
    source: 'role' | 'user';
  }>;
}> {
  try {
    // Получаем пользователя
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { role: true }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Получаем все разрешения
    const allPermissions = await db.query.permissions.findMany({
      orderBy: [schema.permissions.resource, schema.permissions.action]
    });

    // Получаем разрешения роли
    const rolePermissions = await db.query.rolePermissions.findMany({
      where: eq(schema.rolePermissions.role, user.role),
      with: {
        permission: true
      }
    });

    // Получаем индивидуальные разрешения пользователя
    const userPermissions = await db.query.userPermissions.findMany({
      where: eq(schema.userPermissions.userId, userId),
      with: {
        permission: true
      }
    });

    // Формируем результат
    const result = allPermissions.map(permission => {
      // Ищем индивидуальное разрешение пользователя
      const userPerm = userPermissions.find(up => up.permissionId === permission.id);
      if (userPerm) {
        return {
          id: permission.id,
          name: permission.name,
          resource: permission.resource,
          action: permission.action,
          granted: userPerm.granted,
          source: 'user' as const
        };
      }

      // Ищем разрешение роли
      const rolePerm = rolePermissions.find(rp => rp.permissionId === permission.id);
      return {
        id: permission.id,
        name: permission.name,
        resource: permission.resource,
        action: permission.action,
        granted: !!rolePerm,
        source: 'role' as const
      };
    });

    return {
      role: user.role,
      permissions: result
    };
  } catch (error) {
    console.error('Error getting user permissions:', error);
    throw error;
  }
}

/**
 * Инициализация базовых разрешений в системе
 */
export async function initializeDefaultPermissions() {
  try {
    const defaultPermissions = [
      // Каталог
      { name: 'Просмотр каталога', resource: 'catalog', action: 'view', description: 'Просмотр списка товаров и категорий' },
      { name: 'Создание товаров', resource: 'catalog', action: 'create', description: 'Создание новых товаров и категорий' },
      { name: 'Редактирование товаров', resource: 'catalog', action: 'edit', description: 'Изменение товаров и категорий' },
      { name: 'Удаление товаров', resource: 'catalog', action: 'delete', description: 'Удаление товаров и категорий' },
      
      // Остатки
      { name: 'Просмотр остатков', resource: 'stock', action: 'view', description: 'Просмотр остатков на складе' },
      { name: 'Корректировка остатков', resource: 'stock', action: 'edit', description: 'Изменение остатков товаров' },
      { name: 'Управление остатками', resource: 'stock', action: 'manage', description: 'Полное управление остатками' },
      
      // Заказы
      { name: 'Просмотр заказов', resource: 'orders', action: 'view', description: 'Просмотр списка заказов' },
      { name: 'Создание заказов', resource: 'orders', action: 'create', description: 'Создание новых заказов' },
      { name: 'Редактирование заказов', resource: 'orders', action: 'edit', description: 'Изменение заказов' },
      { name: 'Удаление заказов', resource: 'orders', action: 'delete', description: 'Удаление заказов' },
      
      // Производство
      { name: 'Просмотр производства', resource: 'production', action: 'view', description: 'Просмотр производственных заданий' },
      { name: 'Создание заданий', resource: 'production', action: 'create', description: 'Создание производственных заданий' },
      { name: 'Управление производством', resource: 'production', action: 'manage', description: 'Полное управление производством' },
      
      // Операции резки
      { name: 'Просмотр операций резки', resource: 'cutting', action: 'view', description: 'Просмотр операций резки' },
      { name: 'Создание операций резки', resource: 'cutting', action: 'create', description: 'Создание заявок на резку' },
      { name: 'Выполнение операций резки', resource: 'cutting', action: 'execute', description: 'Выполнение операций резки' },
      
      // Отгрузки
      { name: 'Просмотр отгрузок', resource: 'shipments', action: 'view', description: 'Просмотр отгрузок' },
      { name: 'Создание отгрузок', resource: 'shipments', action: 'create', description: 'Создание отгрузок' },
      { name: 'Управление отгрузками', resource: 'shipments', action: 'manage', description: 'Полное управление отгрузками' },
      
      // Пользователи
      { name: 'Просмотр пользователей', resource: 'users', action: 'view', description: 'Просмотр списка пользователей' },
      { name: 'Управление пользователями', resource: 'users', action: 'manage', description: 'Создание и редактирование пользователей' },
      
      // Разрешения
      { name: 'Управление разрешениями', resource: 'permissions', action: 'manage', description: 'Управление системой разрешений' },
      
      // Аудит
      { name: 'Просмотр аудита', resource: 'audit', action: 'view', description: 'Просмотр истории изменений' }
    ];

    // Создаем разрешения если их нет
    for (const perm of defaultPermissions) {
      await db.insert(schema.permissions)
        .values(perm)
        .onConflictDoNothing();
    }

    // Устанавливаем разрешения для ролей по умолчанию
    await setDefaultRolePermissions();

    console.log('✅ Default permissions initialized');
  } catch (error) {
    console.error('Error initializing default permissions:', error);
  }
}

/**
 * Устанавливает разрешения для ролей по умолчанию
 */
async function setDefaultRolePermissions() {
  try {
    // Получаем все разрешения
    const allPermissions = await db.query.permissions.findMany();
    
    const permissionMap = allPermissions.reduce((map, perm) => {
      map[`${perm.resource}:${perm.action}`] = perm.id;
      return map;
    }, {} as Record<string, number>);

    // Определяем разрешения для каждой роли
    const rolePermissionMappings = {
      director: Object.values(permissionMap), // директор имеет все разрешения
      manager: [
        permissionMap['catalog:view'],
        permissionMap['catalog:create'],
        permissionMap['catalog:edit'],
        permissionMap['stock:view'],
        permissionMap['orders:view'],
        permissionMap['orders:create'],
        permissionMap['orders:edit'],
        permissionMap['orders:delete'],
        permissionMap['production:view'],
        permissionMap['cutting:view'],
        permissionMap['cutting:create'],
        permissionMap['shipments:view'],
        permissionMap['shipments:create'],
        permissionMap['shipments:manage']
      ].filter(Boolean),
      production: [
        permissionMap['catalog:view'],
        permissionMap['stock:view'],
        permissionMap['orders:view'],
        permissionMap['production:view'],
        permissionMap['production:create'],
        permissionMap['production:manage'],
        permissionMap['cutting:view'],
        permissionMap['cutting:execute'],
        permissionMap['shipments:view']
      ].filter(Boolean),
      warehouse: [
        permissionMap['catalog:view'],
        permissionMap['stock:view'],
        permissionMap['stock:edit'],
        permissionMap['orders:view'],
        permissionMap['shipments:view'],
        permissionMap['shipments:manage']
      ].filter(Boolean)
    };

    // Создаем записи разрешений для ролей
    for (const [role, permissionIds] of Object.entries(rolePermissionMappings)) {
      for (const permissionId of permissionIds) {
        await db.insert(schema.rolePermissions)
          .values({
            role: role as any,
            permissionId
          })
          .onConflictDoNothing();
      }
    }

    console.log('✅ Default role permissions set');
  } catch (error) {
    console.error('Error setting default role permissions:', error);
  }
} 