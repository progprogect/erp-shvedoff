import express from 'express';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/surfaces - получить все поверхности
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const surfaces = await db.select({
      id: schema.productSurfaces.id,
      name: schema.productSurfaces.name,
      description: schema.productSurfaces.description,
      isSystem: schema.productSurfaces.isSystem,
      createdAt: schema.productSurfaces.createdAt,
      productCount: sql<number>`COUNT(${schema.products.id})`.as('productCount')
    })
    .from(schema.productSurfaces)
    .leftJoin(schema.products, eq(schema.productSurfaces.id, schema.products.surfaceId))
    .groupBy(
      schema.productSurfaces.id,
      schema.productSurfaces.name,
      schema.productSurfaces.description,
      schema.productSurfaces.isSystem,
      schema.productSurfaces.createdAt
    )
    .orderBy(sql`${schema.productSurfaces.isSystem} DESC, ${schema.productSurfaces.name}`);

    res.json({
      success: true,
      data: surfaces
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/surfaces - создать новую поверхность
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { name, description } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может создавать поверхности', 403));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название поверхности должно содержать минимум 2 символа', 400));
    }

    // Проверяем уникальность названия
    const existingSurface = await db.query.productSurfaces.findFirst({
      where: eq(schema.productSurfaces.name, name.trim())
    });

    if (existingSurface) {
      return next(createError('Поверхность с таким названием уже существует', 400));
    }

    // Создаем поверхность
    const [newSurface] = await db.insert(schema.productSurfaces).values({
      name: name.trim(),
      description: description?.trim() || null,
      isSystem: false,
      createdAt: new Date()
    }).returning();

    // Логируем создание
    await db.insert(schema.auditLog).values({
      tableName: 'product_surfaces',
      recordId: newSurface.id,
      operation: 'INSERT',
      newValues: newSurface,
      userId,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: newSurface,
      message: 'Поверхность успешно создана'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/surfaces/:id - обновить поверхность
router.put('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может редактировать поверхности', 403));
    }

    // Получаем текущую поверхность
    const currentSurface = await db.query.productSurfaces.findFirst({
      where: eq(schema.productSurfaces.id, parseInt(id))
    });

    if (!currentSurface) {
      return next(createError('Поверхность не найдена', 404));
    }

    // Проверяем, что это не системная поверхность
    if (currentSurface.isSystem) {
      return next(createError('Системные поверхности нельзя редактировать', 400));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название поверхности должно содержать минимум 2 символа', 400));
    }

    // Проверяем уникальность названия (исключая текущую поверхность)
    const existingSurface = await db.query.productSurfaces.findFirst({
      where: sql`${schema.productSurfaces.name} = ${name.trim()} AND ${schema.productSurfaces.id} != ${parseInt(id)}`
    });

    if (existingSurface) {
      return next(createError('Поверхность с таким названием уже существует', 400));
    }

    // Обновляем поверхность
    const [updatedSurface] = await db.update(schema.productSurfaces)
      .set({
        name: name.trim(),
        description: description?.trim() || null
      })
      .where(eq(schema.productSurfaces.id, parseInt(id)))
      .returning();

    // Логируем изменение
    await db.insert(schema.auditLog).values({
      tableName: 'product_surfaces',
      recordId: parseInt(id),
      operation: 'UPDATE',
      oldValues: currentSurface,
      newValues: updatedSurface,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      data: updatedSurface,
      message: 'Поверхность успешно обновлена'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/surfaces/:id - удалить поверхность
router.delete('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может удалять поверхности', 403));
    }

    // Получаем поверхность
    const surface = await db.query.productSurfaces.findFirst({
      where: eq(schema.productSurfaces.id, parseInt(id))
    });

    if (!surface) {
      return next(createError('Поверхность не найдена', 404));
    }

    // Проверяем, что это не системная поверхность
    if (surface.isSystem) {
      return next(createError('Системные поверхности нельзя удалять', 400));
    }

    // Проверяем, что поверхность не используется в товарах
    const productsCount = await db.select({ count: sql<number>`count(*)` })
      .from(schema.products)
      .where(eq(schema.products.surfaceId, parseInt(id)));

    if (productsCount[0].count > 0) {
      return next(createError(`Нельзя удалить поверхность. Она используется в ${productsCount[0].count} товарах`, 400));
    }

    // Удаляем поверхность
    await db.delete(schema.productSurfaces)
      .where(eq(schema.productSurfaces.id, parseInt(id)));

    // Логируем удаление
    await db.insert(schema.auditLog).values({
      tableName: 'product_surfaces',
      recordId: parseInt(id),
      operation: 'DELETE',
      oldValues: surface,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Поверхность успешно удалена'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 