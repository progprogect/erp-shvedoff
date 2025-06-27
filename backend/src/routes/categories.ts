import express from 'express';
import { db, schema } from '../db';
import { eq, like, isNull, and, desc } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/categories - получить все категории в виде дерева
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const categories = await db.query.categories.findMany({
      orderBy: [schema.categories.sortOrder, schema.categories.name]
    });

    // Строим дерево категорий
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    // Создаем мапу всех категорий
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Строим дерево
    categories.forEach(cat => {
      const categoryWithChildren = categoryMap.get(cat.id);
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    res.json({
      success: true,
      data: rootCategories
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/flat - получить все категории плоским списком
router.get('/flat', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const categories = await db.query.categories.findMany({
      orderBy: [schema.categories.sortOrder, schema.categories.name]
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/:id - получить категорию по ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    const category = await db.query.categories.findFirst({
      where: eq(schema.categories.id, parseInt(id))
    });

    if (!category) {
      return next(createError('Категория не найдена', 404));
    }

    // Получаем количество товаров в категории
    const productsCount = await db.select().from(schema.products)
      .where(eq(schema.products.categoryId, category.id));

    res.json({
      success: true,
      data: {
        ...category,
        productsCount: productsCount.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/categories - создать новую категорию
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { name, parentId, description, sortOrder } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director' && req.user!.role !== 'manager') {
      return next(createError('Недостаточно прав для создания категории', 403));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название категории должно содержать минимум 2 символа', 400));
    }

    // Проверяем существование родительской категории
    if (parentId) {
      const parentCategory = await db.query.categories.findFirst({
        where: eq(schema.categories.id, parentId)
      });
      if (!parentCategory) {
        return next(createError('Родительская категория не найдена', 400));
      }
    }

    // Создаем категорию
    const [newCategory] = await db.insert(schema.categories).values({
      name: name.trim(),
      parentId: parentId || null,
      description: description?.trim() || null,
      sortOrder: sortOrder || 0,
      path: parentId ? null : name.trim(), // Путь будет обновлен после создания
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // Строим путь для категории
    let path = name.trim();
    if (parentId) {
      const parentCategory = await db.query.categories.findFirst({
        where: eq(schema.categories.id, parentId)
      });
      if (parentCategory && parentCategory.path) {
        path = `${parentCategory.path} / ${name.trim()}`;
      }
    }

    // Обновляем путь
    await db.update(schema.categories)
      .set({ path, updatedAt: new Date() })
      .where(eq(schema.categories.id, newCategory.id));

    // Логируем создание в audit_log
    await db.insert(schema.auditLog).values({
      tableName: 'categories',
      recordId: newCategory.id,
      operation: 'INSERT',
      newValues: { ...newCategory, path },
      userId,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: { ...newCategory, path },
      message: 'Категория успешно создана'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/categories/:id - обновить категорию
router.put('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, parentId, description, sortOrder } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director' && req.user!.role !== 'manager') {
      return next(createError('Недостаточно прав для редактирования категории', 403));
    }

    // Получаем текущую категорию
    const currentCategory = await db.query.categories.findFirst({
      where: eq(schema.categories.id, parseInt(id))
    });

    if (!currentCategory) {
      return next(createError('Категория не найдена', 404));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название категории должно содержать минимум 2 символа', 400));
    }

    // Проверяем, что категория не является родителем самой себя
    if (parentId && parseInt(id) === parentId) {
      return next(createError('Категория не может быть родителем самой себя', 400));
    }

    // Обновляем категорию
    const [updatedCategory] = await db.update(schema.categories)
      .set({
        name: name.trim(),
        parentId: parentId || null,
        description: description?.trim() || null,
        sortOrder: sortOrder || 0,
        updatedAt: new Date()
      })
      .where(eq(schema.categories.id, parseInt(id)))
      .returning();

    // Логируем изменение
    await db.insert(schema.auditLog).values({
      tableName: 'categories',
      recordId: parseInt(id),
      operation: 'UPDATE',
      oldValues: currentCategory,
      newValues: updatedCategory,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      data: updatedCategory,
      message: 'Категория успешно обновлена'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/categories/:id - удалить категорию
router.delete('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может удалять категории', 403));
    }

    // Получаем категорию
    const category = await db.query.categories.findFirst({
      where: eq(schema.categories.id, parseInt(id))
    });

    if (!category) {
      return next(createError('Категория не найдена', 404));
    }

    // Проверяем есть ли дочерние категории
    const childCategories = await db.query.categories.findMany({
      where: eq(schema.categories.parentId, parseInt(id))
    });

    if (childCategories.length > 0) {
      return next(createError('Нельзя удалить категорию, содержащую подкатегории', 400));
    }

    // Проверяем есть ли товары в категории
    const products = await db.query.products.findMany({
      where: eq(schema.products.categoryId, parseInt(id))
    });

    if (products.length > 0) {
      return next(createError('Нельзя удалить категорию, содержащую товары', 400));
    }

    // Удаляем категорию
    await db.delete(schema.categories)
      .where(eq(schema.categories.id, parseInt(id)));

    // Логируем удаление
    await db.insert(schema.auditLog).values({
      tableName: 'categories',
      recordId: parseInt(id),
      operation: 'DELETE',
      oldValues: category,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Категория успешно удалена'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 