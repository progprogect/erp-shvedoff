import express from 'express';
import { db, schema } from '../db';
import { eq, like, isNull, and, sql, inArray } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { requireExportPermission } from '../middleware/permissions';
import { createError } from '../middleware/errorHandler';
import { ExcelExporter } from '../utils/excelExporter';

const router = express.Router();

// Helper function to calculate reserved quantities from active orders
async function getReservedQuantities(productIds?: number[]) {
  if (!productIds || productIds.length === 0) {
    return new Map<number, number>();
  }

  try {
    // Резерв = сумма всех товаров в активных заказах (не отмененных и не доставленных)
    const reservedQuery = db
      .select({
        productId: schema.orderItems.productId,
        quantity: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)`.as('quantity')
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(
        and(
          inArray(schema.orderItems.productId, productIds),
          inArray(schema.orders.status, ['new', 'confirmed', 'in_production'])
        )
      )
      .groupBy(schema.orderItems.productId);

    const reservedData = await reservedQuery;
    const reservedMap = new Map<number, number>();

    reservedData.forEach(item => {
      // Добавляем валидацию и обработку числовых данных
      const quantity = Number(item.quantity) || 0;
      
      // Проверяем на разумность значения (максимум 1 миллион штук на товар)
      if (quantity < 0 || quantity > 1000000) {
        console.warn(`⚠️ Подозрительное значение резерва для товара ${item.productId}: ${quantity}. Устанавливаем 0.`);
        reservedMap.set(item.productId, 0);
      } else {
        reservedMap.set(item.productId, quantity);
      }
    });

    return reservedMap;
  } catch (error) {
    console.error('Ошибка при расчете резервов:', error);
    return new Map<number, number>();
  }
}

// Helper function to calculate production quantity for products
async function getProductionQuantities(productIds?: number[]) {
  // Если нет productIds или пустой массив, возвращаем пустую Map
  if (!productIds || productIds.length === 0) {
    return new Map<number, number>();
  }

  try {
    // К производству = товары из подтвержденных и активных производственных заданий
    const tasksQuery = db
      .select({
        productId: schema.productionTasks.productId,
        quantity: sql<number>`
          COALESCE(SUM(
            CASE 
              WHEN ${schema.productionTasks.status} IN ('pending', 'in_progress', 'paused') 
              THEN ${schema.productionTasks.requestedQuantity}
              ELSE 0
            END
          ), 0)
        `.as('quantity')
      })
      .from(schema.productionTasks)
      .where(
        and(
          inArray(schema.productionTasks.status, ['pending', 'in_progress', 'paused']),
          inArray(schema.productionTasks.productId, productIds)
        )
      )
      .groupBy(schema.productionTasks.productId);

    const inProduction = await tasksQuery;
    const productionMap = new Map<number, number>();

    inProduction.forEach(item => {
      // Добавляем валидацию и обработку числовых данных
      const quantity = Number(item.quantity) || 0;
      
      // Проверяем на разумность значения
      if (quantity < 0 || quantity > 1000000) {
        console.warn(`⚠️ Подозрительное значение производства для товара ${item.productId}: ${quantity}. Устанавливаем 0.`);
        productionMap.set(item.productId, 0);
      } else {
        productionMap.set(item.productId, quantity);
      }
    });

    return productionMap;
  } catch (error) {
    console.error('Ошибка при расчете производственных количеств:', error);
    return new Map<number, number>();
  }
}

// GET /api/catalog/products - Get products with search and filters
router.get('/products', authenticateToken, async (req, res, next) => {
  try {
    const { 
      search, 
      categoryId, 
      limit = 50, 
      offset = 0,
      stockStatus, // 'in_stock', 'low_stock', 'out_of_stock'
      // Новые фильтры для полноценной фильтрации
      materialIds,    // материалы (массив ID)
      surfaceIds,     // поверхности (массив ID) 
      logoIds,        // логотипы (массив ID)
      grades,         // сорта товаров (массив)
      weightMin,      // минимальный вес
      weightMax,      // максимальный вес
      matAreaMin,     // минимальная площадь
      matAreaMax,     // максимальная площадь
      onlyInStock,    // только товары в наличии
      borderTypes,    // типы бортов (массив)
      // Новые фильтры для края ковра
      carpetEdgeTypes,    // типы края ковра (массив)
      carpetEdgeSides,    // количество сторон паззла (массив)
      carpetEdgeStrength, // усиление края (массив)
      // Фильтр по низу ковра
      bottomTypeIds,      // типы низа ковра (массив ID)
      // Фильтр по типам паззла
      puzzleTypeIds,      // типы паззла (массив ID)
      // Фильтры по габаритам
      lengthMin,      // минимальная длина
      lengthMax,      // максимальная длина
      widthMin,       // минимальная ширина
      widthMax,       // максимальная ширина
      thicknessMin,   // минимальная высота
      thicknessMax,   // максимальная высота
      sortBy,         // поле сортировки
      sortOrder       // направление сортировки (ASC/DESC)
    } = req.query;

    let whereConditions = [];

    if (search) {
      whereConditions.push(
        like(schema.products.name, `%${search}%`)
      );
    }

    if (categoryId) {
      whereConditions.push(
        eq(schema.products.categoryId, Number(categoryId))
      );
    }

    // Фильтр по материалам
    if (materialIds) {
      const ids = Array.isArray(materialIds) ? materialIds : [materialIds];
      const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));
      if (numericIds.length > 0) {
        whereConditions.push(inArray(schema.products.materialId, numericIds));
      }
    }

    // Фильтр по поверхностям
    if (surfaceIds) {
      const ids = Array.isArray(surfaceIds) ? surfaceIds : [surfaceIds];
      const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));
      if (numericIds.length > 0) {
        whereConditions.push(inArray(schema.products.surfaceId, numericIds));
      }
    }

    // Фильтр по логотипам
    if (logoIds) {
      const ids = Array.isArray(logoIds) ? logoIds : [logoIds];
      const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));
      if (numericIds.length > 0) {
        whereConditions.push(inArray(schema.products.logoId, numericIds));
      }
    }

    // Фильтр по сортам
    if (grades) {
      const gradesList = Array.isArray(grades) ? grades : [grades];
      const validGrades = gradesList
        .filter(grade => typeof grade === 'string' && ['usual', 'grade_2'].includes(grade))
        .map(grade => grade as 'usual' | 'grade_2');
      if (validGrades.length > 0) {
        whereConditions.push(inArray(schema.products.grade, validGrades));
      }
    }

    // Фильтр по весу
    if (weightMin || weightMax) {
      if (weightMin) {
        whereConditions.push(sql`${schema.products.weight} >= ${Number(weightMin)}`);
      }
      if (weightMax) {
        whereConditions.push(sql`${schema.products.weight} <= ${Number(weightMax)}`);
      }
    }

    // Фильтр по площади мата
    if (matAreaMin || matAreaMax) {
      if (matAreaMin) {
        whereConditions.push(sql`${schema.products.matArea} >= ${Number(matAreaMin)}`);
      }
      if (matAreaMax) {
        whereConditions.push(sql`${schema.products.matArea} <= ${Number(matAreaMax)}`);
      }
    }

    // Фильтр по типу борта (Задача 7.1)
    if (borderTypes) {
      const typesList = Array.isArray(borderTypes) ? borderTypes : [borderTypes];
      const validTypes = typesList
        .filter(type => typeof type === 'string' && ['with_border', 'without_border'].includes(type))
        .map(type => type as 'with_border' | 'without_border');
      if (validTypes.length > 0) {
        whereConditions.push(inArray(schema.products.borderType, validTypes));
      }
    }

    // Новые фильтры для края ковра
    if (carpetEdgeTypes) {
      const typesList = Array.isArray(carpetEdgeTypes) ? carpetEdgeTypes : [carpetEdgeTypes];
      const validTypes = typesList
        .filter(type => typeof type === 'string' && ['straight_cut', 'puzzle'].includes(type))
        .map(type => type as 'straight_cut' | 'puzzle');
      if (validTypes.length > 0) {
        whereConditions.push(inArray(schema.products.carpetEdgeType, validTypes));
      }
    }

    if (carpetEdgeSides) {
      const sidesList = Array.isArray(carpetEdgeSides) ? carpetEdgeSides : [carpetEdgeSides];
      const numericSides = sidesList.map(side => Number(side)).filter(side => !isNaN(side) && [1, 2, 3, 4].includes(side));
      if (numericSides.length > 0) {
        whereConditions.push(inArray(schema.products.carpetEdgeSides, numericSides));
      }
    }

    if (carpetEdgeStrength) {
      const strengthList = Array.isArray(carpetEdgeStrength) ? carpetEdgeStrength : [carpetEdgeStrength];
      const validStrengths = strengthList
        .filter(strength => typeof strength === 'string' && ['normal', 'reinforced'].includes(strength))
        .map(strength => strength as 'normal' | 'reinforced');
      if (validStrengths.length > 0) {
        whereConditions.push(inArray(schema.products.carpetEdgeStrength, validStrengths));
      }
    }

    // Фильтр по низу ковра
    if (bottomTypeIds) {
      const ids = Array.isArray(bottomTypeIds) ? bottomTypeIds : [bottomTypeIds];
      const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));
      if (numericIds.length > 0) {
        whereConditions.push(inArray(schema.products.bottomTypeId, numericIds));
      }
    }

    // Фильтр по типам паззла
    if (puzzleTypeIds) {
      const ids = Array.isArray(puzzleTypeIds) ? puzzleTypeIds : [puzzleTypeIds];
      const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));
      if (numericIds.length > 0) {
        whereConditions.push(inArray(schema.products.puzzleTypeId, numericIds));
      }
    }

    // Фильтры по габаритам
    if (lengthMin || lengthMax) {
      if (lengthMin) {
        whereConditions.push(sql`(${schema.products.dimensions}->>'length')::numeric >= ${Number(lengthMin)}`);
      }
      if (lengthMax) {
        whereConditions.push(sql`(${schema.products.dimensions}->>'length')::numeric <= ${Number(lengthMax)}`);
      }
    }

    if (widthMin || widthMax) {
      if (widthMin) {
        whereConditions.push(sql`(${schema.products.dimensions}->>'width')::numeric >= ${Number(widthMin)}`);
      }
      if (widthMax) {
        whereConditions.push(sql`(${schema.products.dimensions}->>'width')::numeric <= ${Number(widthMax)}`);
      }
    }

    if (thicknessMin || thicknessMax) {
      if (thicknessMin) {
        whereConditions.push(sql`(${schema.products.dimensions}->>'thickness')::numeric >= ${Number(thicknessMin)}`);
      }
      if (thicknessMax) {
        whereConditions.push(sql`(${schema.products.dimensions}->>'thickness')::numeric <= ${Number(thicknessMax)}`);
      }
    }

    whereConditions.push(eq(schema.products.isActive, true));

    // Определяем сортировку
    let orderBy;
    if (sortBy) {
      const sortColumn = sortBy === 'matArea' ? schema.products.matArea :
                        sortBy === 'weight' ? schema.products.weight :
                        sortBy === 'name' ? schema.products.name :
                        sortBy === 'price' ? schema.products.price :
                        schema.products.name;
      
      const direction = sortOrder === 'DESC' ? sql`${sortColumn} DESC` : sql`${sortColumn} ASC`;
      orderBy = direction;
    } else {
      orderBy = schema.products.name;
    }

    const products = await db.query.products.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        category: true,
        surface: true,     // Добавляем поверхность
        logo: true,        // Добавляем логотип
        material: true,    // Добавляем материал
        bottomType: true,  // Добавляем тип низа ковра
        stock: true
      },
      limit: Number(limit),
      offset: Number(offset),
      orderBy
    });

    // Получаем ID всех продуктов для расчета резервов и производства
    const productIds = products.map(product => product.id);
    
    // Получаем точные резервы и производственные количества
    const [reservedQuantities, productionQuantities] = await Promise.all([
      getReservedQuantities(productIds),
      getProductionQuantities(productIds)
    ]);

    // Применяем точные расчеты вместо данных из таблицы stock
    let filteredProducts = products.map(product => {
      const currentStock = product.stock?.currentStock || 0;
      const reservedStock = reservedQuantities.get(product.id) || 0;
      const inProductionQuantity = productionQuantities.get(product.id) || 0;
      const availableStock = currentStock - reservedStock;

      return {
        ...product,
        currentStock,
        reservedStock,
        availableStock,
        inProductionQuantity,
        // Добавляем названия связанных сущностей для совместимости с frontend
        categoryName: product.category?.name,
        categoryPath: product.category?.path,
        surfaceName: product.surface?.name,
        logoName: product.logo?.name,
        materialName: product.material?.name,
        // Обновляем объект stock для консистентности
        stock: {
          ...product.stock,
          currentStock,
          reservedStock,
          availableStock,
          inProductionQuantity
        }
      };
    });

    // Фильтр "только в наличии"
    if (onlyInStock === 'true') {
      filteredProducts = filteredProducts.filter(product => product.availableStock > 0);
    }
    
    if (stockStatus) {
      filteredProducts = filteredProducts.filter(product => {
        const available = product.availableStock;
        const norm = product.normStock || 0;
        
        switch (stockStatus) {
          case 'out_of_stock':
            return available <= 0;
          case 'low_stock':
            return available > 0 && available < norm * 0.5;
          case 'in_stock':
            return available > 0; // ИСПРАВЛЕНО: только товары в наличии
          default:
            return true;
        }
      });
    }

    res.json({
      success: true,
      data: filteredProducts,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: filteredProducts.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/catalog/products/:id - Get product details
router.get('/products/:id', authenticateToken, async (req, res, next) => {
  try {
    const productId = Number(req.params.id);

    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, productId),
      with: {
        category: true,
        surface: true,
        logo: true,
        material: true,
        bottomType: true,
        puzzleType: true,
        manager: {
          columns: {
            id: true,
            fullName: true,
            username: true,
            role: true
          }
        },
        stock: true,
        stockMovements: {
          with: {
            user: {
              columns: {
                passwordHash: false
              }
            }
          },
          orderBy: sql`${schema.stockMovements.createdAt} DESC`,
          limit: 10
        }
      }
    });

    if (!product) {
      return next(createError('Product not found', 404));
    }

    // Получаем точные резервы и производственные количества для этого товара
    const [reservedQuantities, productionQuantities] = await Promise.all([
      getReservedQuantities([productId]),
      getProductionQuantities([productId])
    ]);

    const currentStock = product?.stock?.currentStock || 0;
    const reservedStock = reservedQuantities.get(productId) || 0;
    const inProductionQuantity = productionQuantities.get(productId) || 0;
    const availableStock = currentStock - reservedStock;

    // Обновляем данные продукта с точными расчетами
    const productWithAccurateStock = {
      ...product,
      currentStock,
      reservedStock,
      availableStock,
      inProductionQuantity,
      // Обновляем объект stock для консистентности
      stock: {
        ...product?.stock,
        currentStock,
        reservedStock,
        availableStock,
        inProductionQuantity
      }
    };

    res.json({
      success: true,
      data: productWithAccurateStock
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/catalog/products - Create product
router.post('/products', authenticateToken, authorizeRoles('director', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const { 
      name, 
      article, 
      categoryId, 
      surfaceId,
      logoId,
      materialId,
      dimensions, 
      characteristics,
      puzzleOptions,
      matArea,
      weight,
      grade,
      borderType,
      tags, 
      price, 
      costPrice, 
      normStock,
      initialStock,
      notes,
      // Новые поля для края ковра
      carpetEdgeType,
      carpetEdgeSides,
      carpetEdgeStrength,
      // Поле для низа ковра
      bottomTypeId,
      // Поля паззла
      puzzleTypeId,
      puzzleSides
    } = req.body;

    if (!name || !categoryId) {
      return next(createError('Product name and category are required', 400));
    }

    // Проверяем обязательность bottomTypeId
    if (!bottomTypeId) {
      return next(createError('Выберите низ ковра', 400));
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
        return next(createError(`Товар с таким артикулом уже существует. Выберите другой. (Существующий товар: "${duplicateProduct.name}")`, 400));
      }
    }

    const newProduct = await db.insert(schema.products).values({
      name,
      article,
      categoryId,
      surfaceId: surfaceId || null,
      logoId: logoId || null,
      materialId: materialId || null,
      dimensions,
      characteristics,
      puzzleOptions: puzzleOptions || null,
      matArea: matArea ? parseFloat(matArea).toString() : null,
      weight: weight ? parseFloat(weight).toString() : null,
      grade: grade || 'usual',
      borderType: borderType || null,
      tags,
      price,
      costPrice,
      normStock: normStock || 0,
      notes,
      // Новые поля для края ковра
      carpetEdgeType: carpetEdgeType || 'straight_cut',
      carpetEdgeSides: carpetEdgeSides || 1,
      carpetEdgeStrength: carpetEdgeStrength || 'normal',
      // Поле для низа ковра
      bottomTypeId: bottomTypeId || null,
      // Поля паззла
      puzzleTypeId: puzzleTypeId || null,
      puzzleSides: puzzleSides || null
    }).returning();

    // Create initial stock record with initial quantity
    const initialStockValue = initialStock ? parseInt(initialStock) : 0;
    await db.insert(schema.stock).values({
      productId: newProduct[0].id,
      currentStock: initialStockValue,
      reservedStock: 0,
      updatedAt: new Date()
    });

    // Create stock movement record if initial stock > 0
    if (initialStockValue > 0) {
      await db.insert(schema.stockMovements).values({
        productId: newProduct[0].id,
        movementType: 'incoming',
        quantity: initialStockValue,
        referenceType: 'initial_stock',
        comment: 'Начальное оприходование при создании товара',
        userId: req.user!.id,
        createdAt: new Date()
      });
    }

    res.status(201).json({
      success: true,
      data: newProduct[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/catalog/products/:id - Update product
router.put('/products/:id', authenticateToken, authorizeRoles('director', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.params.id);
    const updateData = req.body;

    const updatedProduct = await db.update(schema.products)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(schema.products.id, productId))
      .returning();

    if (!updatedProduct.length) {
      return next(createError('Product not found', 404));
    }

    res.json({
      success: true,
      data: updatedProduct[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/catalog/products/:id - Delete product (деактивация)
router.delete('/products/:id', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.params.id);
    const userId = req.user!.id;

    // Получаем товар
    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, productId)
    });

    if (!product) {
      return next(createError('Product not found', 404));
    }

    // Мягкое удаление (деактивация)
    const updatedProduct = await db.update(schema.products)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(schema.products.id, productId))
      .returning();

    // Логируем деактивацию
    await db.insert(schema.auditLog).values({
      tableName: 'products',
      recordId: productId,
      operation: 'UPDATE',
      oldValues: product,
      newValues: updatedProduct[0],
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

// POST /api/catalog/products/move - Move products between categories (Задача 7.3)
router.post('/products/move', authenticateToken, authorizeRoles('director', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const { productIds, targetCategoryId } = req.body;
    const userId = req.user!.id;

    // Валидация входных данных
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return next(createError('Необходимо указать ID товаров для перемещения', 400));
    }

    if (!targetCategoryId || typeof targetCategoryId !== 'number') {
      return next(createError('Необходимо указать ID целевой категории', 400));
    }

    // Проверяем существование целевой категории
    const targetCategory = await db.query.categories.findFirst({
      where: eq(schema.categories.id, targetCategoryId)
    });

    if (!targetCategory) {
      return next(createError('Целевая категория не найдена', 404));
    }

    // Получаем товары для перемещения
    const products = await db.query.products.findMany({
      where: inArray(schema.products.id, productIds)
    });

    if (products.length !== productIds.length) {
      return next(createError('Некоторые товары не найдены', 404));
    }

    // Выполняем перемещение товаров
    const movedProducts = await db.update(schema.products)
      .set({
        categoryId: targetCategoryId,
        updatedAt: new Date()
      })
      .where(inArray(schema.products.id, productIds))
      .returning();

    // Логируем перемещение для каждого товара
    for (let i = 0; i < products.length; i++) {
      const oldProduct = products[i];
      const newProduct = movedProducts[i];
      
      await db.insert(schema.auditLog).values({
        tableName: 'products',
        recordId: oldProduct.id,
        operation: 'UPDATE',
        oldValues: oldProduct,
        newValues: newProduct,
        userId,
        createdAt: new Date()
      });
    }

    res.json({
      success: true,
      message: `Успешно перемещено ${movedProducts.length} товаров в категорию "${targetCategory.name}"`,
      data: {
        movedProductIds: productIds,
        targetCategoryId,
        targetCategoryName: targetCategory.name
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/catalog/export - Export catalog products to Excel (Задача 9.2)
router.post('/export', authenticateToken, requireExportPermission('catalog'), async (req: AuthRequest, res, next) => {
  try {
    const { productIds, filters, format = 'xlsx' } = req.body; // добавляем параметр format

    let whereConditions: any[] = [eq(schema.products.isActive, true)];

    // Если указаны конкретные товары
    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
      whereConditions.push(inArray(schema.products.id, productIds));
    }

    // Применяем фильтры если они переданы
    if (filters) {
      if (filters.search) {
        whereConditions.push(
          sql`(${schema.products.name} ILIKE ${`%${filters.search}%`} OR ${schema.products.article} ILIKE ${`%${filters.search}%`})`
        );
      }

      if (filters.categoryId) {
        whereConditions.push(eq(schema.products.categoryId, filters.categoryId));
      }

      if (filters.materialIds && filters.materialIds.length > 0) {
        whereConditions.push(inArray(schema.products.materialId, filters.materialIds));
      }

      if (filters.surfaceIds && filters.surfaceIds.length > 0) {
        whereConditions.push(inArray(schema.products.surfaceId, filters.surfaceIds));
      }

      if (filters.logoIds && filters.logoIds.length > 0) {
        whereConditions.push(inArray(schema.products.logoId, filters.logoIds));
      }

      if (filters.borderTypes && filters.borderTypes.length > 0) {
        const validBorderTypes = filters.borderTypes.filter((type: string) => 
          typeof type === 'string' && ['with_border', 'without_border'].includes(type)
        );
        if (validBorderTypes.length > 0) {
          whereConditions.push(inArray(schema.products.borderType, validBorderTypes));
        }
      }
    }

    // Получаем товары с полной информацией
    const products = await db.query.products.findMany({
      where: and(...whereConditions),
      with: {
        category: true,
        surface: true,
        logo: true,
        material: true,
        stock: true
      }
    });

    // Подготавливаем данные для экспорта
    const exportData = products.map(product => ({
      ...product,
      categoryName: product.category?.name,
      surfaceName: product.surface?.name,
      logoName: product.logo?.name,
      materialName: product.material?.name,
      currentStock: product.stock?.currentStock || 0,
      reservedStock: product.stock?.reservedStock || 0
    }));

    // Форматируем данные для Excel
    const formattedData = ExcelExporter.formatCatalogData(exportData);

    // Генерируем имя файла
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const fileExtension = format === 'csv' ? 'csv' : 'xlsx';
    const filename = `catalog-export-${timestamp}.${fileExtension}`;

    // Экспортируем в указанном формате (Задача 3: Дополнительные форматы)
    await ExcelExporter.exportData(res, {
      filename,
      sheetName: 'Каталог товаров',
      title: `Экспорт каталога товаров - ${new Date().toLocaleDateString('ru-RU')}`,
      columns: ExcelExporter.getCatalogColumns(),
      data: formattedData,
      format
    });

  } catch (error) {
    next(error);
  }
});

export default router; 