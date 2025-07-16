import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, or, sql } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { requirePermission, getUserPermissions, initializeDefaultPermissions } from '../middleware/permissions';

const router = Router();

// GET /api/permissions - получить все разрешения в системе (для директоров)
router.get('/', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const permissions = await db.query.permissions.findMany({
      orderBy: [schema.permissions.resource, schema.permissions.action]
    });

    // Группируем по ресурсам для удобства
    const groupedPermissions = permissions.reduce((acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    }, {} as Record<string, typeof permissions>);

    res.json({
      success: true,
      data: {
        permissions,
        grouped: groupedPermissions
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/permissions/roles - получить разрешения для всех ролей (для директоров)
router.get('/roles', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const rolePermissions = await db.query.rolePermissions.findMany({
      with: {
        permission: true
      }
    });

    // Группируем по ролям
    const permissionsByRole = rolePermissions.reduce((acc, rp) => {
      if (!acc[rp.role]) {
        acc[rp.role] = [];
      }
      acc[rp.role].push(rp.permission);
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      success: true,
      data: permissionsByRole
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/permissions/users/:userId - получить разрешения конкретного пользователя (для директоров)
router.get('/users/:userId', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return next(createError('Некорректный ID пользователя', 400));
    }

    const userPermissions = await getUserPermissions(userId);

    res.json({
      success: true,
      data: userPermissions
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/permissions/roles/:role - установить разрешения для роли (для директоров)
router.post('/roles/:role', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const role = req.params.role;
    const { permissionIds } = req.body;

    if (!permissionIds || !Array.isArray(permissionIds)) {
      return next(createError('Необходимо указать массив ID разрешений', 400));
    }

    // Проверяем что роль существует
    const validRoles = ['director', 'manager', 'production', 'warehouse'];
    if (!validRoles.includes(role)) {
      return next(createError('Некорректная роль', 400));
    }

    // Удаляем существующие разрешения роли
    await db.delete(schema.rolePermissions)
      .where(eq(schema.rolePermissions.role, role as any));

    // Добавляем новые разрешения
    if (permissionIds.length > 0) {
      const rolePermissionsData = permissionIds.map((permissionId: number) => ({
        role: role as any,
        permissionId
      }));

      await db.insert(schema.rolePermissions).values(rolePermissionsData);
    }

    res.json({
      success: true,
      message: `Разрешения для роли ${role} обновлены`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/permissions/users/:userId - установить индивидуальные разрешения пользователя (для директоров)
router.post('/users/:userId', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    const { permissions } = req.body;

    if (isNaN(userId)) {
      return next(createError('Некорректный ID пользователя', 400));
    }

    if (!permissions || !Array.isArray(permissions)) {
      return next(createError('Необходимо указать массив разрешений', 400));
    }

    // Проверяем что пользователь существует
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId)
    });

    if (!user) {
      return next(createError('Пользователь не найден', 404));
    }

    // Удаляем существующие индивидуальные разрешения
    await db.delete(schema.userPermissions)
      .where(eq(schema.userPermissions.userId, userId));

    // Добавляем новые разрешения
    if (permissions.length > 0) {
      const userPermissionsData = permissions.map((perm: { permissionId: number, granted: boolean }) => ({
        userId,
        permissionId: perm.permissionId,
        granted: perm.granted
      }));

      await db.insert(schema.userPermissions).values(userPermissionsData);
    }

    res.json({
      success: true,
      message: 'Индивидуальные разрешения пользователя обновлены'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/permissions/initialize - инициализация базовых разрешений (для директоров)
router.post('/initialize', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    await initializeDefaultPermissions();

    res.json({
      success: true,
      message: 'Базовые разрешения инициализированы'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/permissions/check - проверить разрешения текущего пользователя
router.get('/check', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userPermissions = await getUserPermissions(req.user!.id);

    res.json({
      success: true,
      data: userPermissions
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/permissions/check-specific - проверить конкретное разрешение
router.post('/check-specific', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { resource, action } = req.body;

    if (!resource || !action) {
      return next(createError('Необходимо указать resource и action', 400));
    }

    const { checkUserPermission } = await import('../middleware/permissions');
    const hasPermission = await checkUserPermission(req.user!.id, resource, action);

    res.json({
      success: true,
      data: {
        resource,
        action,
        granted: hasPermission
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/permissions/user-menu - получить разрешения для формирования меню
router.get('/user-menu', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { checkUserPermission } = await import('../middleware/permissions');
    const userId = req.user!.id;

    // Проверяем разрешения для основных разделов
    const menuPermissions = {
      catalog: await checkUserPermission(userId, 'catalog', 'view'),
      stock: await checkUserPermission(userId, 'stock', 'view'),
      orders: await checkUserPermission(userId, 'orders', 'view'),
      production: await checkUserPermission(userId, 'production', 'view'),
      cutting: await checkUserPermission(userId, 'cutting', 'view'),
      shipments: await checkUserPermission(userId, 'shipments', 'view'),
      users: await checkUserPermission(userId, 'users', 'view'),
      permissions: await checkUserPermission(userId, 'permissions', 'manage'),
      audit: await checkUserPermission(userId, 'audit', 'view'),
      
      // Детальные разрешения для действий
      actions: {
        catalog_create: await checkUserPermission(userId, 'catalog', 'create'),
        catalog_edit: await checkUserPermission(userId, 'catalog', 'edit'),
        catalog_delete: await checkUserPermission(userId, 'catalog', 'delete'),
        
        stock_edit: await checkUserPermission(userId, 'stock', 'edit'),
        stock_manage: await checkUserPermission(userId, 'stock', 'manage'),
        
        orders_create: await checkUserPermission(userId, 'orders', 'create'),
        orders_edit: await checkUserPermission(userId, 'orders', 'edit'),
        orders_delete: await checkUserPermission(userId, 'orders', 'delete'),
        
        production_create: await checkUserPermission(userId, 'production', 'create'),
        production_manage: await checkUserPermission(userId, 'production', 'manage'),
        
        cutting_create: await checkUserPermission(userId, 'cutting', 'create'),
        cutting_execute: await checkUserPermission(userId, 'cutting', 'execute'),
        
        shipments_create: await checkUserPermission(userId, 'shipments', 'create'),
        shipments_manage: await checkUserPermission(userId, 'shipments', 'manage'),
        
        users_manage: await checkUserPermission(userId, 'users', 'manage')
      }
    };

    res.json({
      success: true,
      data: menuPermissions
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/permissions/assign - Назначить разрешение роли
router.post('/assign', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const { role, permissionId } = req.body;
    const userId = req.user!.id;

    if (!role || !permissionId) {
      return next(createError('Роль и ID разрешения обязательны', 400));
    }

    // Проверяем валидность роли
    const validRoles = ['manager', 'director', 'production', 'warehouse'];
    if (!validRoles.includes(role)) {
      return next(createError('Недопустимая роль', 400));
    }

    // Проверяем существование разрешения
    const permission = await db.query.permissions.findFirst({
      where: eq(schema.permissions.id, permissionId)
    });

    if (!permission) {
      return next(createError('Разрешение не найдено', 404));
    }

    // Проверяем, не назначено ли уже это разрешение
    const existingAssignment = await db.query.rolePermissions.findFirst({
      where: and(
        eq(schema.rolePermissions.role, role as any),
        eq(schema.rolePermissions.permissionId, permissionId)
      )
    });

    if (existingAssignment) {
      return next(createError('Разрешение уже назначено этой роли', 400));
    }

    // Назначаем разрешение роли
    const [newAssignment] = await db.insert(schema.rolePermissions).values({
      role: role as any,
      permissionId
    }).returning();

    // Логируем назначение
    await db.insert(schema.auditLog).values({
      tableName: 'role_permissions',
      recordId: newAssignment.id,
      operation: 'INSERT',
      newValues: {
        role,
        permissionId,
        permissionResource: permission.resource,
        permissionAction: permission.action
      },
      userId
    });

    res.json({
      success: true,
      data: newAssignment,
      message: `Разрешение "${permission.resource}:${permission.action}" назначено роли "${role}"`
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/permissions/revoke - Отозвать разрешение у роли
router.delete('/revoke', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const { role, permissionId } = req.body;
    const userId = req.user!.id;

    if (!role || !permissionId) {
      return next(createError('Роль и ID разрешения обязательны', 400));
    }

    // Проверяем валидность роли
    const validRoles = ['manager', 'director', 'production', 'warehouse'];
    if (!validRoles.includes(role)) {
      return next(createError('Недопустимая роль', 400));
    }

    // Находим назначение разрешения
    const assignment = await db.query.rolePermissions.findFirst({
      where: and(
        eq(schema.rolePermissions.role, role as any),
        eq(schema.rolePermissions.permissionId, permissionId)
      ),
      with: {
        permission: true
      }
    });

    if (!assignment) {
      return next(createError('Разрешение не назначено этой роли', 404));
    }

    // Удаляем назначение
    await db.delete(schema.rolePermissions)
      .where(eq(schema.rolePermissions.id, assignment.id));

    // Логируем отзыв
    await db.insert(schema.auditLog).values({
      tableName: 'role_permissions',
      recordId: assignment.id,
      operation: 'DELETE',
      oldValues: {
        role,
        permissionId,
        permissionResource: assignment.permission.resource,
        permissionAction: assignment.permission.action
      },
      userId
    });

    res.json({
      success: true,
      message: `Разрешение "${assignment.permission.resource}:${assignment.permission.action}" отозвано у роли "${role}"`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/permissions/roles/:role/bulk-assign - Массовое назначение разрешений роли
router.post('/roles/:role/bulk-assign', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const { role } = req.params;
    const { permissionIds } = req.body;
    const userId = req.user!.id;

    if (!permissionIds || !Array.isArray(permissionIds)) {
      return next(createError('Список ID разрешений обязателен', 400));
    }

    // Проверяем валидность роли
    const validRoles = ['manager', 'director', 'production', 'warehouse'];
    if (!validRoles.includes(role)) {
      return next(createError('Недопустимая роль', 400));
    }

    // Проверяем существование всех разрешений
    const permissions = await db.query.permissions.findMany({
      where: sql`${schema.permissions.id} = ANY(${permissionIds})`
    });

    if (permissions.length !== permissionIds.length) {
      return next(createError('Некоторые разрешения не найдены', 404));
    }

    // Получаем уже назначенные разрешения
    const existingAssignments = await db.query.rolePermissions.findMany({
      where: and(
        eq(schema.rolePermissions.role, role as any),
        sql`${schema.rolePermissions.permissionId} = ANY(${permissionIds})`
      )
    });

    const existingPermissionIds = existingAssignments.map(a => a.permissionId);
    const newPermissionIds = permissionIds.filter(id => !existingPermissionIds.includes(id));

    if (newPermissionIds.length === 0) {
      return next(createError('Все указанные разрешения уже назначены', 400));
    }

    // Назначаем новые разрешения в транзакции
    const result = await db.transaction(async (tx) => {
      const assignments = [];
      
      for (const permissionId of newPermissionIds) {
        const [assignment] = await tx.insert(schema.rolePermissions).values({
          role: role as any,
          permissionId
        }).returning();
        assignments.push(assignment);

        // Логируем каждое назначение
        await tx.insert(schema.auditLog).values({
          tableName: 'role_permissions',
          recordId: assignment.id,
          operation: 'INSERT',
          newValues: {
            role,
            permissionId
          },
          userId
        });
      }

      return assignments;
    });

    res.json({
      success: true,
      data: result,
      message: `Назначено ${result.length} новых разрешений роли "${role}"`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/permissions/available-roles - Получить список доступных ролей
router.get('/available-roles', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const roles = [
      { value: 'manager', label: 'Менеджер', description: 'Управление заказами и клиентами' },
      { value: 'director', label: 'Директор', description: 'Полный доступ ко всем функциям' },
      { value: 'production', label: 'Производство', description: 'Управление производственными процессами' },
      { value: 'warehouse', label: 'Склад', description: 'Управление складскими операциями' }
    ];

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    next(error);
  }
});

export default router; 