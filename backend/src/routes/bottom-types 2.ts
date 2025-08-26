import express from 'express';
import { db } from '../db';
import { bottomTypes } from '../db/schema';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { eq } from 'drizzle-orm';

const router = express.Router();

// GET /api/bottom-types - Получить все типы низа ковра
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const types = await db.query.bottomTypes.findMany({
      orderBy: (bottomTypes, { asc }) => [asc(bottomTypes.id)]
    });

    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/bottom-types/:id - Получить тип по ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const type = await db.query.bottomTypes.findFirst({
      where: (bottomTypes, { eq }) => eq(bottomTypes.id, parseInt(id))
    });

    if (!type) {
      throw createError('Тип низа ковра не найден', 404);
    }

    res.json({
      success: true,
      data: type
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/bottom-types - Создать новый тип
router.post('/', authenticateToken, authorizeRoles('director'), async (req, res, next) => {
  try {
    const { code, name, description } = req.body;

    if (!code || !name) {
      throw createError('Код и название обязательны', 400);
    }

    const [newType] = await db.insert(bottomTypes).values({
      code,
      name,
      description: description || null,
      isSystem: false
    }).returning();

    res.status(201).json({
      success: true,
      data: newType,
      message: 'Тип низа ковра создан'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/bottom-types/:id - Обновить тип
router.put('/:id', authenticateToken, authorizeRoles('director'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, description } = req.body;

    if (!code || !name) {
      throw createError('Код и название обязательны', 400);
    }

    const [updatedType] = await db.update(bottomTypes)
      .set({
        code,
        name,
        description: description || null
      })
      .where(eq(bottomTypes.id, parseInt(id)))
      .returning();

    if (!updatedType) {
      throw createError('Тип низа ковра не найден', 404);
    }

    res.json({
      success: true,
      data: updatedType,
      message: 'Тип низа ковра обновлен'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/bottom-types/:id - Удалить тип
router.delete('/:id', authenticateToken, authorizeRoles('director'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [deletedType] = await db.delete(bottomTypes)
      .where(eq(bottomTypes.id, parseInt(id)))
      .returning();

    if (!deletedType) {
      throw createError('Тип низа ковра не найден', 404);
    }

    res.json({
      success: true,
      message: 'Тип низа ковра удален'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
