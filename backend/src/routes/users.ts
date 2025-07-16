import express from 'express';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db';
import { eq, sql, ilike, or, and } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// GET /api/users - Get all users (только для директоров)
router.get('/', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const { search, role, limit = 50, offset = 0 } = req.query;

    let whereConditions = [];

    if (search) {
      whereConditions.push(
        or(
          ilike(schema.users.username, `%${search}%`),
          ilike(schema.users.fullName, `%${search}%`),
          ilike(schema.users.email, `%${search}%`)
        )
      );
    }

    if (role) {
      whereConditions.push(eq(schema.users.role, role as any));
    }

    const users = await db.query.users.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      columns: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        sql`${schema.users.createdAt} DESC`
      ],
      limit: parseInt(limit as string) || 50,
      offset: parseInt(offset as string) || 0
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/list - Get basic user list for all authenticated users (для назначения задач и пр.)
router.get('/list', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const users = await db.query.users.findMany({
      where: eq(schema.users.isActive, true),
      columns: {
        id: true,
        username: true,
        fullName: true,
        role: true
      },
      orderBy: [
        sql`${schema.users.fullName} ASC`
      ]
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/statistics - Get user statistics (только для директоров)
router.get('/statistics', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    // Простая статистика пользователей
    const users = await db.query.users.findMany();
    
    const totalStats = {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
      directors: users.filter(u => u.role === 'director').length,
      managers: users.filter(u => u.role === 'manager').length,
      production: users.filter(u => u.role === 'production').length,
      warehouse: users.filter(u => u.role === 'warehouse').length
    };

    res.json({
      success: true,
      data: totalStats
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id - Get user details (только для директоров)
router.get('/:id', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const userId = parseInt(req.params.id) || 0;

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return next(createError('Пользователь не найден', 404));
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/users - Create new user (только для директоров)
router.post('/', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const { username, fullName, email, password, role } = req.body;
    const createdBy = req.user!.id;

    // Валидация обязательных полей
    if (!username || !password || !role) {
      return next(createError('Имя пользователя, пароль и роль обязательны', 400));
    }

    // Валидация роли
    const validRoles = ['director', 'manager', 'production', 'warehouse'];
    if (!validRoles.includes(role)) {
      return next(createError('Недопустимая роль пользователя', 400));
    }

    // Проверка уникальности имени пользователя
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.username, username)
    });

    if (existingUser) {
      return next(createError('Пользователь с таким именем уже существует', 400));
    }

    // Проверка уникальности email (если указан)
    if (email) {
      const existingEmailUser = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
      });

      if (existingEmailUser) {
        return next(createError('Пользователь с таким email уже существует', 400));
      }
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание пользователя
    const [newUser] = await db.insert(schema.users).values({
      username,
      fullName: fullName || null,
      email: email || null,
      passwordHash: hashedPassword,
      role: role as any,
      isActive: true
    }).returning({
      id: schema.users.id,
      username: schema.users.username,
      fullName: schema.users.fullName,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt
    });

    // Логирование создания пользователя
    await db.insert(schema.auditLog).values({
      tableName: 'users',
      recordId: newUser.id,
      operation: 'INSERT',
      newValues: {
        username: newUser.username,
        role: newUser.role,
        isActive: newUser.isActive
      },
      userId: createdBy
    });

    res.status(201).json({
      success: true,
      data: newUser,
      message: 'Пользователь создан'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id - Update user (только для директоров)
router.put('/:id', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const userId = parseInt(req.params.id) || 0;
    const { fullName, email, role, isActive } = req.body;
    const updatedBy = req.user!.id;

    // Проверка существования пользователя
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    if (!existingUser) {
      return next(createError('Пользователь не найден', 404));
    }

    // Запрет изменения собственной роли/активности
    if (userId === updatedBy) {
      if (role !== undefined && role !== existingUser.role) {
        return next(createError('Нельзя изменить собственную роль', 400));
      }
      if (isActive !== undefined && isActive !== existingUser.isActive) {
        return next(createError('Нельзя изменить собственную активность', 400));
      }
    }

    // Валидация роли
    if (role !== undefined) {
      const validRoles = ['director', 'manager', 'production', 'warehouse'];
      if (!validRoles.includes(role)) {
        return next(createError('Недопустимая роль пользователя', 400));
      }
    }

    // Проверка уникальности email (если указан и изменился)
    if (email && email !== existingUser.email) {
      const existingEmailUser = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
      });

      if (existingEmailUser) {
        return next(createError('Пользователь с таким email уже существует', 400));
      }
    }

    // Подготовка данных для обновления
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName || null;
    if (email !== undefined) updateData.email = email || null;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Обновление пользователя
    const [updatedUser] = await db.update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        username: schema.users.username,
        fullName: schema.users.fullName,
        email: schema.users.email,
        role: schema.users.role,
        isActive: schema.users.isActive,
        updatedAt: schema.users.updatedAt
      });

    // Логирование изменения пользователя
    await db.insert(schema.auditLog).values({
      tableName: 'users',
      recordId: userId,
      operation: 'UPDATE',
      oldValues: {
        fullName: existingUser.fullName,
        email: existingUser.email,
        role: existingUser.role,
        isActive: existingUser.isActive
      },
      newValues: {
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive
      },
      userId: updatedBy
    });

    res.json({
      success: true,
      data: updatedUser,
      message: 'Пользователь обновлен'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id/password - Change user password (только для директоров)
router.put('/:id/password', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const userId = parseInt(req.params.id) || 0;
    const { newPassword } = req.body;
    const changedBy = req.user!.id;

    if (!newPassword || newPassword.length < 6) {
      return next(createError('Пароль должен содержать минимум 6 символов', 400));
    }

    // Проверка существования пользователя
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.id, userId)
    });

    if (!existingUser) {
      return next(createError('Пользователь не найден', 404));
    }

    // Хеширование нового пароля
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Обновление пароля
    await db.update(schema.users)
      .set({
        passwordHash: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, userId));

    // Логирование изменения пароля
    await db.insert(schema.auditLog).values({
      tableName: 'users',
      recordId: userId,
      operation: 'UPDATE',
      oldValues: { password: 'hidden' },
      newValues: { password: 'changed' },
      userId: changedBy
    });

    res.json({
      success: true,
      message: 'Пароль изменен'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id - Deactivate user (только для директоров)
router.delete('/:id', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const userId = parseInt(req.params.id) || 0;
    const deactivatedBy = req.user!.id;

    // Запрет деактивации собственного аккаунта
    if (userId === deactivatedBy) {
      return next(createError('Нельзя деактивировать собственный аккаунт', 400));
    }

    // Проверка существования пользователя
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.id, userId)
    });

    if (!existingUser) {
      return next(createError('Пользователь не найден', 404));
    }

    if (!existingUser.isActive) {
      return next(createError('Пользователь уже деактивирован', 400));
    }

    // Деактивация пользователя
    await db.update(schema.users)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, userId));

    // Логирование деактивации
    await db.insert(schema.auditLog).values({
      tableName: 'users',
      recordId: userId,
      operation: 'UPDATE',
      oldValues: { isActive: true },
      newValues: { isActive: false },
      userId: deactivatedBy
    });

    res.json({
      success: true,
      message: 'Пользователь деактивирован'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id/activate - Activate user (только для директоров)
router.put('/:id/activate', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const userId = parseInt(req.params.id) || 0;
    const activatedBy = req.user!.id;

    // Проверка существования пользователя
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.id, userId)
    });

    if (!existingUser) {
      return next(createError('Пользователь не найден', 404));
    }

    if (existingUser.isActive) {
      return next(createError('Пользователь уже активен', 400));
    }

    // Активация пользователя
    await db.update(schema.users)
      .set({
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, userId));

    // Логирование активации
    await db.insert(schema.auditLog).values({
      tableName: 'users',
      recordId: userId,
      operation: 'UPDATE',
      oldValues: { isActive: false },
      newValues: { isActive: true },
      userId: activatedBy
    });

    res.json({
      success: true,
      message: 'Пользователь активирован'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 