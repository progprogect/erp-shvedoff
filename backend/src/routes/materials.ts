import express from 'express';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/materials - получить все материалы
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const materials = await db.select({
      id: schema.productMaterials.id,
      name: schema.productMaterials.name,
      description: schema.productMaterials.description,
      isSystem: schema.productMaterials.isSystem,
      createdAt: schema.productMaterials.createdAt,
      productCount: sql<number>`COUNT(${schema.products.id})`.as('productCount')
    })
    .from(schema.productMaterials)
    .leftJoin(schema.products, eq(schema.productMaterials.id, schema.products.materialId))
    .groupBy(
      schema.productMaterials.id,
      schema.productMaterials.name,
      schema.productMaterials.description,
      schema.productMaterials.isSystem,
      schema.productMaterials.createdAt
    )
    .orderBy(sql`${schema.productMaterials.isSystem} DESC, ${schema.productMaterials.name}`);

    res.json({
      success: true,
      data: materials
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/materials - создать новый материал
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { name, description } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может создавать материалы', 403));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название материала должно содержать минимум 2 символа', 400));
    }

    // Проверяем уникальность названия
    const existingMaterial = await db.query.productMaterials.findFirst({
      where: eq(schema.productMaterials.name, name.trim())
    });

    if (existingMaterial) {
      return next(createError('Материал с таким названием уже существует', 400));
    }

    // Создаем материал
    const [newMaterial] = await db.insert(schema.productMaterials).values({
      name: name.trim(),
      description: description?.trim() || null,
      isSystem: false,
      createdAt: new Date()
    }).returning();

    // Логируем создание
    await db.insert(schema.auditLog).values({
      tableName: 'product_materials',
      recordId: newMaterial.id,
      operation: 'INSERT',
      newValues: newMaterial,
      userId,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: newMaterial,
      message: 'Материал успешно создан'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/materials/:id - обновить материал
router.put('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может редактировать материалы', 403));
    }

    // Получаем текущий материал
    const currentMaterial = await db.query.productMaterials.findFirst({
      where: eq(schema.productMaterials.id, parseInt(id))
    });

    if (!currentMaterial) {
      return next(createError('Материал не найден', 404));
    }

    // Проверяем, что это не системный материал
    if (currentMaterial.isSystem) {
      return next(createError('Системные материалы нельзя редактировать', 400));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название материала должно содержать минимум 2 символа', 400));
    }

    // Проверяем уникальность названия (исключая текущий материал)
    const existingMaterial = await db.query.productMaterials.findFirst({
      where: sql`${schema.productMaterials.name} = ${name.trim()} AND ${schema.productMaterials.id} != ${parseInt(id)}`
    });

    if (existingMaterial) {
      return next(createError('Материал с таким названием уже существует', 400));
    }

    // Обновляем материал
    const [updatedMaterial] = await db.update(schema.productMaterials)
      .set({
        name: name.trim(),
        description: description?.trim() || null
      })
      .where(eq(schema.productMaterials.id, parseInt(id)))
      .returning();

    // Логируем изменение
    await db.insert(schema.auditLog).values({
      tableName: 'product_materials',
      recordId: parseInt(id),
      operation: 'UPDATE',
      oldValues: currentMaterial,
      newValues: updatedMaterial,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      data: updatedMaterial,
      message: 'Материал успешно обновлен'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/materials/:id - удалить материал
router.delete('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может удалять материалы', 403));
    }

    // Получаем материал
    const material = await db.query.productMaterials.findFirst({
      where: eq(schema.productMaterials.id, parseInt(id))
    });

    if (!material) {
      return next(createError('Материал не найден', 404));
    }

    // Проверяем, что это не системный материал
    if (material.isSystem) {
      return next(createError('Системные материалы нельзя удалять', 400));
    }

    // Проверяем, что материал не используется в товарах
    const productsCount = await db.select({ count: sql<number>`count(*)` })
      .from(schema.products)
      .where(eq(schema.products.materialId, parseInt(id)));

    if (productsCount[0].count > 0) {
      return next(createError(`Нельзя удалить материал. Он используется в ${productsCount[0].count} товарах`, 400));
    }

    // Удаляем материал
    await db.delete(schema.productMaterials)
      .where(eq(schema.productMaterials.id, parseInt(id)));

    // Логируем удаление
    await db.insert(schema.auditLog).values({
      tableName: 'product_materials',
      recordId: parseInt(id),
      operation: 'DELETE',
      oldValues: material,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Материал успешно удален'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 