import express from 'express';
import { db, schema } from '../db';
import { eq, like, and, desc, sql, ilike, inArray } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = express.Router();

// Helper function to calculate production quantity for a single product
async function getProductionQuantity(productId: number): Promise<number> {
  // Получаем количество из подтвержденных и активных производственных заданий
  const productionTasksResult = await db
    .select({
      quantity: sql<number>`
        COALESCE(SUM(
          CASE 
            WHEN ${schema.productionTasks.status} IN ('pending', 'in_progress') 
            THEN COALESCE(${schema.productionTasks.requestedQuantity}, 0)
            ELSE 0
          END
        ), 0)
      `.as('quantity')
    })
    .from(schema.productionTasks)
    .where(
      and(
        eq(schema.productionTasks.productId, productId),
        sql`${schema.productionTasks.status} IN ('pending', 'in_progress')`
      )
    );

  return productionTasksResult[0]?.quantity || 0;
}

// GET /api/products - получить все товары с фильтрацией и поиском
router.get('/', authenticateToken, requirePermission('products', 'view'), async (req: AuthRequest, res, next) => {
  try {
    const { 
      search, 
      categoryId, 
      page = 1, 
      limit = 1000, // Увеличен лимит для отображения всех товаров
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
      surfaceId: schema.products.surfaceId,
      logoId: schema.products.logoId,
      dimensions: schema.products.dimensions,
      characteristics: schema.products.characteristics,
      puzzleOptions: schema.products.puzzleOptions,
      matArea: schema.products.matArea,
      weight: schema.products.weight,
      grade: schema.products.grade,
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
      surfaceName: schema.productSurfaces.name,
      logoName: schema.productLogos.name,
      materialName: schema.productMaterials.name,
      currentStock: sql`COALESCE(${schema.stock.currentStock}, 0)`,
      reservedStock: sql`COALESCE(${schema.stock.reservedStock}, 0)`,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .leftJoin(schema.productSurfaces, eq(schema.products.surfaceId, schema.productSurfaces.id))
    .leftJoin(schema.productLogos, eq(schema.products.logoId, schema.productLogos.id))
    .leftJoin(schema.productMaterials, eq(schema.products.materialId, schema.productMaterials.id))
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
router.get('/search', authenticateToken, requirePermission('products', 'view'), async (req: AuthRequest, res, next) => {
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
router.get('/:id', authenticateToken, requirePermission('products', 'view'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const [product] = await db.select({
      id: schema.products.id,
      name: schema.products.name,
      article: schema.products.article,
      categoryId: schema.products.categoryId,
      surfaceId: schema.products.surfaceId,
      logoId: schema.products.logoId,
      dimensions: schema.products.dimensions,
      characteristics: schema.products.characteristics,
      puzzleOptions: schema.products.puzzleOptions,
      matArea: schema.products.matArea,
      weight: schema.products.weight,
      grade: schema.products.grade,
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
      surfaceName: schema.productSurfaces.name,
      logoName: schema.productLogos.name,
      materialName: schema.productMaterials.name,
      currentStock: sql`COALESCE(${schema.stock.currentStock}, 0)`,
      reservedStock: sql`COALESCE(${schema.stock.reservedStock}, 0)`,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .leftJoin(schema.productSurfaces, eq(schema.products.surfaceId, schema.productSurfaces.id))
    .leftJoin(schema.productLogos, eq(schema.products.logoId, schema.productLogos.id))
    .leftJoin(schema.productMaterials, eq(schema.products.materialId, schema.productMaterials.id))
    .leftJoin(schema.stock, eq(schema.products.id, schema.stock.productId))
    .where(eq(schema.products.id, parseInt(id)));

    if (!product) {
      return next(createError('Товар не найден', 404));
    }

    // Получаем количество к производству
    const inProductionQuantity = await getProductionQuantity(product.id);

    const productWithStock = {
      ...product,
      availableStock: (product.currentStock as number) - (product.reservedStock as number),
      inProductionQuantity,
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
router.post('/', authenticateToken, requirePermission('products', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const {
      name,
      article,
      categoryId,
      surfaceId,
      logoId,
      materialId,
      pressType,  // 🔥 ДОБАВЛЕНО: поле пресса
      dimensions,
      characteristics,
      puzzleOptions,
      matArea,
      weight,
      grade,
      tags,
      price,
      costPrice,
      normStock,
      initialStock,
      notes,
      photos,
      bottomTypeId,  // 🔥 ДОБАВЛЕНО: поле низа ковра
      // Новые поля для полной совместимости
      borderType,
      carpetEdgeType,
      carpetEdgeSides,
      carpetEdgeStrength,
      puzzleTypeId,
      puzzleSides,
      purNumber,
      surfaceIds  // множественные поверхности
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

    // Проверяем существование поверхности (если указана)
    if (surfaceId) {
      const surface = await db.query.productSurfaces.findFirst({
        where: eq(schema.productSurfaces.id, surfaceId)
      });

      if (!surface) {
        return next(createError('Поверхность не найдена', 400));
      }
    }

    // Проверяем существование логотипа (если указан)
    if (logoId) {
      const logo = await db.query.productLogos.findFirst({
        where: eq(schema.productLogos.id, logoId)
      });

      if (!logo) {
        return next(createError('Логотип не найден', 400));
      }
    }

    // Проверяем существование материала (если указан)
    if (materialId) {
      const material = await db.query.productMaterials.findFirst({
        where: eq(schema.productMaterials.id, materialId)
      });

      if (!material) {
        return next(createError('Материал не найден', 400));
      }
    }

    // Проверяем уникальность артикула (если указан) - проверка без учета регистра
    if (article) {
      const normalizedArticle = article.trim().toLowerCase();
      
      // Ищем существующий товар с таким же артикулом (игнорируя регистр)
      const existingProducts = await db.query.products.findMany({
        columns: {
          id: true,
          article: true,
          name: true
        }
      });
      
      const duplicateProduct = existingProducts.find(p => 
        p.article && p.article.toLowerCase() === normalizedArticle
      );

      if (duplicateProduct) {
        return next(createError(`Товар с таким артикулом уже существует. Выберите другой.`, 400));
      }
    }

    // Создаем товар
    const [newProduct] = await db.insert(schema.products).values([{
      name: name.trim(),
      article: article?.trim() || null,
      categoryId,
      surfaceId: surfaceId || null,
      logoId: logoId || null,
      materialId: materialId || null,
      pressType: pressType || 'not_selected',  // 🔥 ДОБАВЛЕНО: поле пресса
      dimensions: dimensions || null,
      characteristics: characteristics || null,
      puzzleOptions: puzzleOptions || null,
      matArea: matArea ? parseFloat(matArea).toString() : null,
      weight: weight ? parseFloat(weight).toString() : null,
      grade: grade || 'usual',
      tags: tags || null,
      price: price ? parseFloat(price).toString() : null,
      costPrice: costPrice ? parseFloat(costPrice).toString() : null,
      normStock: normStock ? parseInt(normStock) : 0,
      notes: notes?.trim() || null,
      photos: photos || null,
      bottomTypeId: bottomTypeId || null,  // 🔥 ДОБАВЛЕНО: поле низа ковра
      // Новые поля для полной совместимости
      borderType: borderType || null,
      carpetEdgeType: carpetEdgeType || 'straight_cut',
      carpetEdgeSides: carpetEdgeSides || 1,
      carpetEdgeStrength: carpetEdgeStrength || 'normal',
      puzzleTypeId: puzzleTypeId || null,
      puzzleSides: puzzleSides || null,
      purNumber: purNumber || null,
      surfaceIds: surfaceIds || null,  // множественные поверхности
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }]).returning();

    // Создаем запись в таблице остатков с начальным количеством
    const initialStockValue = initialStock ? parseInt(initialStock) : 0;
    await db.insert(schema.stock).values({
      productId: newProduct.id,
      currentStock: initialStockValue,
      reservedStock: 0,
      updatedAt: new Date()
    }).onConflictDoNothing();

    // Если указан начальный остаток, создаем запись в движениях склада
    if (initialStockValue > 0) {
      await db.insert(schema.stockMovements).values({
        productId: newProduct.id,
        movementType: 'incoming',
        quantity: initialStockValue,
        referenceType: 'initial_stock',
        comment: 'Начальное оприходование при создании товара',
        userId,
        createdAt: new Date()
      });
    }

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
router.put('/:id', authenticateToken, requirePermission('products', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      article,
      categoryId,
      surfaceId,
      logoId,
      materialId,
      pressType,  // 🔥 ДОБАВЛЕНО: поле пресса
      dimensions,
      characteristics,
      puzzleOptions,
      matArea,
      weight,
      grade,
      tags,
      price,
      costPrice,
      normStock,
      notes,
      photos,
      isActive,
      bottomTypeId,  // 🔥 ДОБАВЛЕНО: поле низа ковра
      // Новые поля для полной совместимости
      borderType,
      carpetEdgeType,
      carpetEdgeSides,
      carpetEdgeStrength,
      puzzleTypeId,
      puzzleSides,
      purNumber,
      surfaceIds  // множественные поверхности
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

    // Проверяем существование поверхности (если указана)
    if (surfaceId) {
      const surface = await db.query.productSurfaces.findFirst({
        where: eq(schema.productSurfaces.id, surfaceId)
      });

      if (!surface) {
        return next(createError('Поверхность не найдена', 400));
      }
    }

    // Проверяем существование логотипа (если указан)
    if (logoId) {
      const logo = await db.query.productLogos.findFirst({
        where: eq(schema.productLogos.id, logoId)
      });

      if (!logo) {
        return next(createError('Логотип не найден', 400));
      }
    }

    // Проверяем существование материала (если указан)
    if (materialId) {
      const material = await db.query.productMaterials.findFirst({
        where: eq(schema.productMaterials.id, materialId)
      });

      if (!material) {
        return next(createError('Материал не найден', 400));
      }
    }

    // Обновляем товар
    const [updatedProduct] = await db.update(schema.products)
      .set({
        name: name.trim(),
        article: article?.trim() || null,
        categoryId: categoryId || currentProduct.categoryId,
        surfaceId: surfaceId !== undefined ? surfaceId : currentProduct.surfaceId,
        logoId: logoId !== undefined ? logoId : currentProduct.logoId,
        materialId: materialId !== undefined ? materialId : currentProduct.materialId,
        pressType: pressType !== undefined ? pressType : currentProduct.pressType,  // 🔥 ДОБАВЛЕНО: поле пресса
        dimensions: dimensions || null,
        characteristics: characteristics || null,
        puzzleOptions: puzzleOptions || null,
        matArea: matArea ? parseFloat(matArea).toString() : null,
        weight: weight !== undefined ? (weight ? parseFloat(weight).toString() : null) : currentProduct.weight,
        grade: grade || currentProduct.grade || 'usual',
        tags: tags || null,
        price: price ? parseFloat(price).toString() : null,
        costPrice: costPrice ? parseFloat(costPrice).toString() : null,
        normStock: normStock ? parseInt(normStock) : 0,
        notes: notes?.trim() || null,
        photos: photos || null,
        bottomTypeId: bottomTypeId !== undefined ? bottomTypeId : currentProduct.bottomTypeId,  // 🔥 ДОБАВЛЕНО: поле низа ковра
        // Новые поля для полной совместимости
        borderType: borderType !== undefined ? borderType : currentProduct.borderType,
        carpetEdgeType: carpetEdgeType !== undefined ? carpetEdgeType : currentProduct.carpetEdgeType,
        carpetEdgeSides: carpetEdgeSides !== undefined ? carpetEdgeSides : currentProduct.carpetEdgeSides,
        carpetEdgeStrength: carpetEdgeStrength !== undefined ? carpetEdgeStrength : currentProduct.carpetEdgeStrength,
        puzzleTypeId: puzzleTypeId !== undefined ? puzzleTypeId : currentProduct.puzzleTypeId,
        puzzleSides: puzzleSides !== undefined ? puzzleSides : currentProduct.puzzleSides,
        purNumber: purNumber !== undefined ? purNumber : currentProduct.purNumber,
        surfaceIds: surfaceIds !== undefined ? surfaceIds : currentProduct.surfaceIds,
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

// DELETE роут убран - используется /api/catalog/products/:id

// Вспомогательная функция для определения статуса остатков
function getStockStatus(available: number, norm: number) {
  if (available <= 0) return 'critical';
  if (available < norm * 0.5) return 'low';
  return 'normal';
}

export default router; 