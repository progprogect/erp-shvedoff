import express from 'express';
import { db, schema } from '../db';
import { eq, like, isNull, and, sql, inArray, or } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

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
      stockStatus // 'in_stock', 'low_stock', 'out_of_stock'
    } = req.query;

    let whereConditions = [];

    if (search) {
      whereConditions.push(
        or(
          like(schema.products.name, `%${search}%`),
          like(schema.products.article, `%${search}%`)
        )
      );
    }

    if (categoryId) {
      whereConditions.push(
        eq(schema.products.categoryId, Number(categoryId))
      );
    }

    whereConditions.push(eq(schema.products.isActive, true));

    const products = await db.query.products.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        category: true,
        stock: true
      },
      limit: Number(limit),
      offset: Number(offset),
      orderBy: schema.products.name
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

    const currentStock = product.stock?.currentStock || 0;
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
        ...product.stock,
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
      tags, 
      price, 
      costPrice, 
      normStock,
      initialStock,
      notes 
    } = req.body;

    if (!name || !categoryId) {
      return next(createError('Product name and category are required', 400));
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
      tags,
      price,
      costPrice,
      normStock: normStock || 0,
      notes
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

export default router; 