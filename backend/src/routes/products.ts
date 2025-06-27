import express from 'express';
import { db, schema } from '../db';
import { eq, like, and, desc, sql, ilike } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/products - получить все товары с фильтрацией и поиском
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { 
      search, 
      categoryId, 
      page = 1, 
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    // Строим условия фильтрации
    const conditions = [];
    
    if (search && (search as string).length >= 3) {
      conditions.push(
        ilike(schema.products.name, `%${search}%`)
      );
    }

    if (categoryId) {
      conditions.push(
        eq(schema.products.categoryId, parseInt(categoryId as string))
      );
    }

    // Активные товары по умолчанию
    conditions.push(eq(schema.products.isActive, true));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Получаем товары с информацией о категории и остатках
    const products = await db.select({
      id: schema.products.id,
      name: schema.products.name,
      article: schema.products.article,
      categoryId: schema.products.categoryId,
      dimensions: schema.products.dimensions,
      characteristics: schema.products.characteristics,
      price: schema.products.price,
      costPrice: schema.products.costPrice,
      normStock: schema.products.normStock,
      notes: schema.products.notes,
      photos: schema.products.photos,
      isActive: schema.products.isActive,
      createdAt: schema.products.createdAt,
      updatedAt: schema.products.updatedAt,
      categoryName: schema.categories.name,
      categoryPath: schema.categories.path,
      currentStock: sql`COALESCE(${schema.stock.currentStock}, 0)`,
      reservedStock: sql`COALESCE(${schema.stock.reservedStock}, 0)`,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .leftJoin(schema.stock, eq(schema.products.id, schema.stock.productId))
    .where(whereClause)
    .limit(parseInt(limit as string))
    .offset(offset)
    .orderBy(
      sortOrder === 'desc' 
        ? desc(schema.products.name)
        : schema.products.name
    );

    // Получаем общее количество для пагинации
    const [{ count }] = await db.select({ 
      count: sql`count(*)`.mapWith(Number) 
    })
    .from(schema.products)
    .where(whereClause);

    // Вычисляем доступный остаток для каждого товара
    const productsWithStock = products.map(product => ({
      ...product,
      availableStock: (product.currentStock as number) - (product.reservedStock as number),
      stockStatus: getStockStatus(
        (product.currentStock as number) - (product.reservedStock as number),
        product.normStock || 0
      )
    }));

    res.json({
      success: true,
      data: productsWithStock,
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

// GET /api/products/search - быстрый поиск товаров (минимум 3 символа)
router.get('/search', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { q } = req.query;

    if (!q || (q as string).length < 3) {
      return res.json({
        success: true,
        data: [],
        message: 'Введите минимум 3 символа для поиска'
      });
    }

    const products = await db.select({
      id: schema.products.id,
      name: schema.products.name,
      article: schema.products.article,
      categoryName: schema.categories.name,
      price: schema.products.price,
      currentStock: sql`COALESCE(${schema.stock.currentStock}, 0)`,
      reservedStock: sql`COALESCE(${schema.stock.reservedStock}, 0)`,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .leftJoin(schema.stock, eq(schema.products.id, schema.stock.productId))
    .where(
      and(
        ilike(schema.products.name, `%${q}%`),
        eq(schema.products.isActive, true)
      )
    )
    .limit(10);

    const searchResults = products.map(product => ({
      ...product,
      availableStock: (product.currentStock as number) - (product.reservedStock as number)
    }));

    return res.json({
      success: true,
      data: searchResults
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/products/:id - получить товар по ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const [product] = await db.select({
      id: schema.products.id,
      name: schema.products.name,
      article: schema.products.article,
      categoryId: schema.products.categoryId,
      dimensions: schema.products.dimensions,
      characteristics: schema.products.characteristics,
      tags: schema.products.tags,
      price: schema.products.price,
      costPrice: schema.products.costPrice,
      normStock: schema.products.normStock,
      notes: schema.products.notes,
      photos: schema.products.photos,
      isActive: schema.products.isActive,
      createdAt: schema.products.createdAt,
      updatedAt: schema.products.updatedAt,
      categoryName: schema.categories.name,
      categoryPath: schema.categories.path,
      currentStock: sql`COALESCE(${schema.stock.currentStock}, 0)`,
      reservedStock: sql`COALESCE(${schema.stock.reservedStock}, 0)`,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .leftJoin(schema.stock, eq(schema.products.id, schema.stock.productId))
    .where(eq(schema.products.id, parseInt(id)));

    if (!product) {
      return next(createError('Товар не найден', 404));
    }

    const productWithStock = {
      ...product,
      availableStock: (product.currentStock as number) - (product.reservedStock as number),
      stockStatus: getStockStatus(
        (product.currentStock as number) - (product.reservedStock as number),
        product.normStock || 0
      )
    };

    res.json({
      success: true,
      data: productWithStock
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/products - создать новый товар
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const {
      name,
      article,
      categoryId,
      dimensions,
      characteristics,
      tags,
      price,
      costPrice,
      normStock,
      notes,
      photos
    } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director' && req.user!.role !== 'manager') {
      return next(createError('Недостаточно прав для создания товара', 403));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название товара должно содержать минимум 2 символа', 400));
    }

    if (!categoryId) {
      return next(createError('Выберите категорию товара', 400));
    }

    // Проверяем существование категории
    const category = await db.query.categories.findFirst({
      where: eq(schema.categories.id, categoryId)
    });

    if (!category) {
      return next(createError('Категория не найдена', 400));
    }

    // Проверяем уникальность артикула (если указан)
    if (article) {
      const existingProduct = await db.query.products.findFirst({
        where: eq(schema.products.article, article.trim())
      });

      if (existingProduct) {
        return next(createError('Товар с таким артикулом уже существует', 400));
      }
    }

    // Создаем товар
    const [newProduct] = await db.insert(schema.products).values([{
      name: name.trim(),
      article: article?.trim() || null,
      categoryId,
      dimensions: dimensions || null,
      characteristics: characteristics || null,
      tags: tags || null,
      price: price ? parseFloat(price).toString() : null,
      costPrice: costPrice ? parseFloat(costPrice).toString() : null,
      normStock: normStock ? parseInt(normStock) : 0,
      notes: notes?.trim() || null,
      photos: photos || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }]).returning();

    // Создаем запись в таблице остатков
    await db.insert(schema.stock).values({
      productId: newProduct.id,
      currentStock: 0,
      reservedStock: 0,
      updatedAt: new Date()
    }).onConflictDoNothing();

    // Логируем создание
    await db.insert(schema.auditLog).values({
      tableName: 'products',
      recordId: newProduct.id,
      operation: 'INSERT',
      newValues: newProduct,
      userId,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: newProduct,
      message: 'Товар успешно создан'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id - обновить товар
router.put('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      article,
      categoryId,
      dimensions,
      characteristics,
      tags,
      price,
      costPrice,
      normStock,
      notes,
      photos,
      isActive
    } = req.body;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director' && req.user!.role !== 'manager') {
      return next(createError('Недостаточно прав для редактирования товара', 403));
    }

    // Получаем текущий товар
    const currentProduct = await db.query.products.findFirst({
      where: eq(schema.products.id, parseInt(id))
    });

    if (!currentProduct) {
      return next(createError('Товар не найден', 404));
    }

    // Валидация
    if (!name || name.trim().length < 2) {
      return next(createError('Название товара должно содержать минимум 2 символа', 400));
    }

    // Обновляем товар
    const [updatedProduct] = await db.update(schema.products)
      .set({
        name: name.trim(),
        article: article?.trim() || null,
        categoryId: categoryId || currentProduct.categoryId,
        dimensions: dimensions || null,
        characteristics: characteristics || null,
        tags: tags || null,
        price: price ? parseFloat(price).toString() : null,
        costPrice: costPrice ? parseFloat(costPrice).toString() : null,
        normStock: normStock ? parseInt(normStock) : 0,
        notes: notes?.trim() || null,
        photos: photos || null,
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      })
      .where(eq(schema.products.id, parseInt(id)))
      .returning();

    // Логируем изменение
    await db.insert(schema.auditLog).values({
      tableName: 'products',
      recordId: parseInt(id),
      operation: 'UPDATE',
      oldValues: currentProduct,
      newValues: updatedProduct,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      data: updatedProduct,
      message: 'Товар успешно обновлен'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id - деактивировать товар (мягкое удаление)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Проверка прав доступа
    if (req.user!.role !== 'director') {
      return next(createError('Только директор может удалять товары', 403));
    }

    // Получаем товар
    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, parseInt(id))
    });

    if (!product) {
      return next(createError('Товар не найден', 404));
    }

    // Мягкое удаление (деактивация)
    const [updatedProduct] = await db.update(schema.products)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(schema.products.id, parseInt(id)))
      .returning();

    // Логируем деактивацию
    await db.insert(schema.auditLog).values({
      tableName: 'products',
      recordId: parseInt(id),
      operation: 'UPDATE',
      oldValues: product,
      newValues: updatedProduct,
      userId,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Товар деактивирован'
    });
  } catch (error) {
    next(error);
  }
});

// Вспомогательная функция для определения статуса остатков
function getStockStatus(available: number, norm: number) {
  if (available <= 0) return 'critical';
  if (available < norm * 0.5) return 'low';
  return 'normal';
}

export default router; 