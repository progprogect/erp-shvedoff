import express from 'express';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/puzzle-types - получить все типы паззлов
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const puzzleTypes = await db.select({
      id: schema.puzzleTypes.id,
      name: schema.puzzleTypes.name,
      code: schema.puzzleTypes.code,
      description: schema.puzzleTypes.description,
      isSystem: schema.puzzleTypes.isSystem,
      createdAt: schema.puzzleTypes.createdAt,
      productCount: sql<number>`COUNT(CASE WHEN ${schema.products.puzzleOptions}->>'type' = ${schema.puzzleTypes.code} THEN 1 END)`.as('productCount')
    })
    .from(schema.puzzleTypes)
    .leftJoin(schema.products, sql`${schema.products.puzzleOptions}->>'type' = ${schema.puzzleTypes.code}`)
    .groupBy(
      schema.puzzleTypes.id,
      schema.puzzleTypes.name,
      schema.puzzleTypes.code,
      schema.puzzleTypes.description,
      schema.puzzleTypes.isSystem,
      schema.puzzleTypes.createdAt
    )
    .orderBy(sql`${schema.puzzleTypes.isSystem} DESC, ${schema.puzzleTypes.name}`);

    res.json({
      success: true,
      data: puzzleTypes
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/puzzle-types - создать новый тип паззла
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { name, code, description } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director' && req.user!.role !== 'manager') {
      return next(createError('Недостаточно прав для создания типов паззлов', 403));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название типа паззла должно содержать минимум 2 символа', 400));
    }

    // Генерируем код автоматически если не указан
    const finalCode = code?.trim() || name.trim().toLowerCase().replace(/[^a-zA-Z0-9а-яё]/g, '_').replace(/_{2,}/g, '_');

    if (finalCode.length < 2) {
      return next(createError('Код типа паззла должен содержать минимум 2 символа', 400));
    }

    // Проверяем уникальность названия
    const existingByName = await db.query.puzzleTypes.findFirst({
      where: eq(schema.puzzleTypes.name, name.trim())
    });

    if (existingByName) {
      return next(createError('Тип паззла с таким названием уже существует', 400));
    }

    // Проверяем уникальность кода
    const existingByCode = await db.query.puzzleTypes.findFirst({
      where: eq(schema.puzzleTypes.code, finalCode)
    });

    if (existingByCode) {
      return next(createError('Тип паззла с таким кодом уже существует', 400));
    }

    // Создаем тип паззла
    const [newPuzzleType] = await db.insert(schema.puzzleTypes).values({
      name: name.trim(),
      code: finalCode,
      description: description?.trim() || null,
      isSystem: false,
      createdAt: new Date()
    }).returning();

    // Логируем создание
    await db.insert(schema.auditLog).values({
      tableName: 'puzzle_types',
      recordId: newPuzzleType.id,
      operation: 'INSERT',
      newValues: newPuzzleType,
      userId,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: newPuzzleType,
      message: 'Тип паззла успешно создан'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/puzzle-types/:id - обновить тип паззла
router.put('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может редактировать типы паззлов', 403));
    }

    // Получаем текущий тип паззла
    const currentType = await db.query.puzzleTypes.findFirst({
      where: eq(schema.puzzleTypes.id, parseInt(id))
    });

    if (!currentType) {
      return next(createError('Тип паззла не найден', 404));
    }

    // Проверяем, что это не системный тип
    if (currentType.isSystem) {
      return next(createError('Системные типы паззлов нельзя редактировать', 400));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название типа паззла должно содержать минимум 2 символа', 400));
    }

    if (!code || code.trim().length < 2) {
      return next(createError('Код типа паззла должен содержать минимум 2 символа', 400));
    }

    // Проверяем уникальность названия (исключая текущий тип)
    const existingByName = await db.query.puzzleTypes.findFirst({
      where: sql`${schema.puzzleTypes.name} = ${name.trim()} AND ${schema.puzzleTypes.id} != ${parseInt(id)}`
    });

    if (existingByName) {
      return next(createError('Тип паззла с таким названием уже существует', 400));
    }

    // Проверяем уникальность кода (исключая текущий тип)
    const existingByCode = await db.query.puzzleTypes.findFirst({
      where: sql`${schema.puzzleTypes.code} = ${code.trim()} AND ${schema.puzzleTypes.id} != ${parseInt(id)}`
    });

    if (existingByCode) {
      return next(createError('Тип паззла с таким кодом уже существует', 400));
    }

    // Обновляем тип паззла
    const [updatedType] = await db.update(schema.puzzleTypes)
      .set({
        name: name.trim(),
        code: code.trim(),
        description: description?.trim() || null
      })
      .where(eq(schema.puzzleTypes.id, parseInt(id)))
      .returning();

    // Логируем изменение
    await db.insert(schema.auditLog).values({
      tableName: 'puzzle_types',
      recordId: parseInt(id),
      operation: 'UPDATE',
      oldValues: currentType,
      newValues: updatedType,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      data: updatedType,
      message: 'Тип паззла успешно обновлен'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/puzzle-types/:id - удалить тип паззла
router.delete('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может удалять типы паззлов', 403));
    }

    // Получаем тип паззла
    const puzzleType = await db.query.puzzleTypes.findFirst({
      where: eq(schema.puzzleTypes.id, parseInt(id))
    });

    if (!puzzleType) {
      return next(createError('Тип паззла не найден', 404));
    }

    // Проверяем, что это не системный тип
    if (puzzleType.isSystem) {
      return next(createError('Системные типы паззлов нельзя удалять', 400));
    }

    // Проверяем, что тип не используется в товарах
    const productsCount = await db.select({ count: sql<number>`count(*)` })
      .from(schema.products)
      .where(sql`${schema.products.puzzleOptions}->>'type' = ${puzzleType.code}`);

    if (productsCount[0].count > 0) {
      return next(createError(`Нельзя удалить тип паззла. Он используется в ${productsCount[0].count} товарах`, 400));
    }

    // Удаляем тип паззла
    await db.delete(schema.puzzleTypes)
      .where(eq(schema.puzzleTypes.id, parseInt(id)));

    // Логируем удаление
    await db.insert(schema.auditLog).values({
      tableName: 'puzzle_types',
      recordId: parseInt(id),
      operation: 'DELETE',
      oldValues: puzzleType,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Тип паззла успешно удален'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 