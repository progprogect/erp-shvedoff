import express from 'express';
import { db, schema } from '../db';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = express.Router();

// GET /api/audit - получить лог аудита с фильтрацией
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { 
      tableName, 
      operation, 
      userId, 
      recordId,
      dateFrom,
      dateTo,
      page = 1, 
      limit = 50 
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    // Строим условия фильтрации
    const conditions = [];

    if (tableName) {
      conditions.push(eq(schema.auditLog.tableName, tableName as string));
    }

    if (operation) {
      conditions.push(eq(schema.auditLog.operation, operation as any));
    }

    if (userId) {
      conditions.push(eq(schema.auditLog.userId, parseInt(userId as string)));
    }

    if (recordId) {
      conditions.push(eq(schema.auditLog.recordId, parseInt(recordId as string)));
    }

    if (dateFrom) {
      conditions.push(sql`${schema.auditLog.createdAt} >= ${new Date(dateFrom as string)}`);
    }

    if (dateTo) {
      conditions.push(sql`${schema.auditLog.createdAt} <= ${new Date(dateTo as string)}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Получаем записи аудита с информацией о пользователях
    const auditLogs = await db
      .select({
        id: schema.auditLog.id,
        tableName: schema.auditLog.tableName,
        recordId: schema.auditLog.recordId,
        operation: schema.auditLog.operation,
        oldValues: schema.auditLog.oldValues,
        newValues: schema.auditLog.newValues,
        createdAt: schema.auditLog.createdAt,
        userName: schema.users.fullName,
        userRole: schema.users.role,
        userId: schema.users.id
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.auditLog.userId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    // Получаем общее количество для пагинации
    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(schema.auditLog)
      .where(whereClause);

    // Форматируем данные для фронтенда
    const formattedLogs = auditLogs.map(log => {
      const operationText = {
        'INSERT': 'Создание',
        'UPDATE': 'Изменение', 
        'DELETE': 'Удаление'
      }[log.operation] || log.operation;

      const tableText = {
        'products': 'товара',
        'categories': 'категории',
        'orders': 'заказа',
        'users': 'пользователя',
        'stock': 'остатка'
      }[log.tableName] || log.tableName;

      return {
        ...log,
        operationText,
        tableText,
        description: `${operationText} ${tableText} #${log.recordId}`
      };
    });

    res.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count,
        pages: Math.ceil(count / parseInt(limit as string))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit/stats - получить статистику аудита
router.get('/stats', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    // Статистика по операциям
    const operationStats = await db
      .select({
        operation: schema.auditLog.operation,
        count: sql`count(*)`.mapWith(Number)
      })
      .from(schema.auditLog)
      .groupBy(schema.auditLog.operation);

    // Статистика по таблицам
    const tableStats = await db
      .select({
        tableName: schema.auditLog.tableName,
        count: sql`count(*)`.mapWith(Number)
      })
      .from(schema.auditLog)
      .groupBy(schema.auditLog.tableName);

    // Статистика по пользователям (топ-10)
    const userStats = await db
      .select({
        userId: schema.auditLog.userId,
        userName: schema.users.fullName,
        userRole: schema.users.role,
        count: sql`count(*)`.mapWith(Number)
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.auditLog.userId, schema.users.id))
      .groupBy(schema.auditLog.userId, schema.users.fullName, schema.users.role)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Активность за последние 7 дней
    const weeklyActivity = await db
      .select({
        date: sql`DATE(${schema.auditLog.createdAt})`,
        count: sql`count(*)`.mapWith(Number)
      })
      .from(schema.auditLog)
      .where(sql`${schema.auditLog.createdAt} >= CURRENT_DATE - INTERVAL '7 days'`)
      .groupBy(sql`DATE(${schema.auditLog.createdAt})`)
      .orderBy(sql`DATE(${schema.auditLog.createdAt})`);

    res.json({
      success: true,
      data: {
        operations: operationStats,
        tables: tableStats,
        users: userStats,
        weeklyActivity
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router; 