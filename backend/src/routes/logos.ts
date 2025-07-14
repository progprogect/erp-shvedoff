import express from 'express';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/logos - получить все логотипы
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const logos = await db.select({
      id: schema.productLogos.id,
      name: schema.productLogos.name,
      description: schema.productLogos.description,
      isSystem: schema.productLogos.isSystem,
      createdAt: schema.productLogos.createdAt,
      productCount: sql<number>`COUNT(${schema.products.id})`.as('productCount')
    })
    .from(schema.productLogos)
    .leftJoin(schema.products, eq(schema.productLogos.id, schema.products.logoId))
    .groupBy(
      schema.productLogos.id,
      schema.productLogos.name,
      schema.productLogos.description,
      schema.productLogos.isSystem,
      schema.productLogos.createdAt
    )
    .orderBy(sql`${schema.productLogos.isSystem} DESC, ${schema.productLogos.name}`);

    res.json({
      success: true,
      data: logos
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/logos - создать новый логотип
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { name, description } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может создавать логотипы', 403));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название логотипа должно содержать минимум 2 символа', 400));
    }

    // Проверяем уникальность названия
    const existingLogo = await db.query.productLogos.findFirst({
      where: eq(schema.productLogos.name, name.trim())
    });

    if (existingLogo) {
      return next(createError('Логотип с таким названием уже существует', 400));
    }

    // Создаем логотип
    const [newLogo] = await db.insert(schema.productLogos).values({
      name: name.trim(),
      description: description?.trim() || null,
      isSystem: false,
      createdAt: new Date()
    }).returning();

    // Логируем создание
    await db.insert(schema.auditLog).values({
      tableName: 'product_logos',
      recordId: newLogo.id,
      operation: 'INSERT',
      newValues: newLogo,
      userId,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: newLogo,
      message: 'Логотип успешно создан'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/logos/:id - обновить логотип
router.put('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может редактировать логотипы', 403));
    }

    // Получаем текущий логотип
    const currentLogo = await db.query.productLogos.findFirst({
      where: eq(schema.productLogos.id, parseInt(id))
    });

    if (!currentLogo) {
      return next(createError('Логотип не найден', 404));
    }

    // Проверяем, что это не системный логотип
    if (currentLogo.isSystem) {
      return next(createError('Системные логотипы нельзя редактировать', 400));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название логотипа должно содержать минимум 2 символа', 400));
    }

    // Проверяем уникальность названия (исключая текущий логотип)
    const existingLogo = await db.query.productLogos.findFirst({
      where: sql`${schema.productLogos.name} = ${name.trim()} AND ${schema.productLogos.id} != ${parseInt(id)}`
    });

    if (existingLogo) {
      return next(createError('Логотип с таким названием уже существует', 400));
    }

    // Обновляем логотип
    const [updatedLogo] = await db.update(schema.productLogos)
      .set({
        name: name.trim(),
        description: description?.trim() || null
      })
      .where(eq(schema.productLogos.id, parseInt(id)))
      .returning();

    // Логируем изменение
    await db.insert(schema.auditLog).values({
      tableName: 'product_logos',
      recordId: parseInt(id),
      operation: 'UPDATE',
      oldValues: currentLogo,
      newValues: updatedLogo,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      data: updatedLogo,
      message: 'Логотип успешно обновлен'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/logos/:id - удалить логотип
router.delete('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может удалять логотипы', 403));
    }

    // Получаем логотип
    const logo = await db.query.productLogos.findFirst({
      where: eq(schema.productLogos.id, parseInt(id))
    });

    if (!logo) {
      return next(createError('Логотип не найден', 404));
    }

    // Проверяем, что это не системный логотип
    if (logo.isSystem) {
      return next(createError('Системные логотипы нельзя удалять', 400));
    }

    // Проверяем, что логотип не используется в товарах
    const productsCount = await db.select({ count: sql<number>`count(*)` })
      .from(schema.products)
      .where(eq(schema.products.logoId, parseInt(id)));

    if (productsCount[0].count > 0) {
      return next(createError(`Нельзя удалить логотип. Он используется в ${productsCount[0].count} товарах`, 400));
    }

    // Удаляем логотип
    await db.delete(schema.productLogos)
      .where(eq(schema.productLogos.id, parseInt(id)));

    // Логируем удаление
    await db.insert(schema.auditLog).values({
      tableName: 'product_logos',
      recordId: parseInt(id),
      operation: 'DELETE',
      oldValues: logo,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Логотип успешно удален'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 