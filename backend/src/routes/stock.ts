import express from 'express';
import { db, schema } from '../db';
import { eq, sql, and, or, ilike, inArray } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { createError } from '../middleware/errorHandler';
import { 
  performStockOperation, 
  getStockInfo, 
  validateAllStock, 
  fixStockInconsistencies, 
  syncReservationsWithOrders,
  getStockStatistics 
} from '../utils/stockManager';

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
          inArray(schema.orders.status, ['new', 'confirmed', 'in_production', 'ready'])
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

// GET /api/stock - Get current stock levels
router.get('/', authenticateToken, requirePermission('stock', 'view'), async (req, res, next) => {
  try {
    const { status, categoryId, search, sortBy, sortOrder } = req.query;

    // Build where conditions
    let whereClause = eq(schema.products.isActive, true);
    
    if (search) {
      whereClause = and(
        whereClause,
        or(
          ilike(schema.products.name, `%${search}%`),
          ilike(schema.products.article, `%${search}%`)
        )
      )!;
    }

    if (categoryId) {
      whereClause = and(whereClause, eq(schema.products.categoryId, Number(categoryId)))!;
    }

    const stockData = await db
      .select({
        id: schema.stock.id,
        productId: schema.stock.productId,
        currentStock: schema.stock.currentStock,
        updatedAt: schema.stock.updatedAt,
        productName: schema.products.name,
        productArticle: schema.products.article,
        categoryName: schema.categories.name,
        normStock: schema.products.normStock,
        price: schema.products.price,
        matArea: schema.products.matArea // Добавляем площадь для сортировки (Задача 7.2)
      })
      .from(schema.stock)
      .innerJoin(schema.products, eq(schema.stock.productId, schema.products.id))
      .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .where(whereClause);

    // Получаем ID всех продуктов
    const productIds = stockData.map(item => item.productId);
    
    // Получаем реальные резервы из заказов и количества к производству
    const [reservedQuantities, productionQuantities] = await Promise.all([
      getReservedQuantities(productIds),
      getProductionQuantities(productIds)
    ]);

    // Добавляем рассчитанные данные к складским остаткам с валидацией
    const stockWithCalculations = stockData.map(item => {
      const reserved = Number(reservedQuantities.get(item.productId) || 0);
      const inProduction = Number(productionQuantities.get(item.productId) || 0);
      const currentStock = Number(item.currentStock || 0);
      const available = currentStock - reserved;
      
      // Валидация данных
      if (reserved < 0) {
        console.warn(`⚠️ Отрицательный резерв для товара ${item.productId}: ${reserved}`);
      }
      if (currentStock < 0) {
        console.warn(`⚠️ Отрицательный остаток для товара ${item.productId}: ${currentStock}`);
      }
      if (reserved > currentStock) {
        console.warn(`⚠️ Резерв превышает остаток для товара ${item.productId}: резерв ${reserved}, остаток ${currentStock}`);
      }
      
      return {
        ...item,
        currentStock,
        reservedStock: Math.max(0, reserved),
        availableStock: available,
        inProductionQuantity: Math.max(0, inProduction)
      };
    });

    // Apply filters
    let filteredData = stockWithCalculations;

    if (status) {
      filteredData = stockWithCalculations.filter(item => {
        const available = item.availableStock;
        const norm = item.normStock || 0;
        const inProduction = item.inProductionQuantity;
        
        switch (status) {
          case 'out_of_stock':
            return available <= 0;
          case 'critical':
            return available <= 0;
          case 'negative':
            return available < 0;
          case 'low':
            return available > 0 && available < norm * 0.5;
          case 'normal':
            return available > 0; // ИСПРАВЛЕНО: только товары в наличии
          case 'in_production':
            return inProduction > 0;
          default:
            return true;
        }
      });
    }

    // Сортировка (Задача 7.2)
    if (sortBy) {
      filteredData.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'matArea':
            aValue = Number(a.matArea || 0);
            bValue = Number(b.matArea || 0);
            break;
          case 'name':
            aValue = a.productName.toLowerCase();
            bValue = b.productName.toLowerCase();
            break;
          case 'availableStock':
            aValue = a.availableStock;
            bValue = b.availableStock;
            break;
          case 'currentStock':
            aValue = a.currentStock;
            bValue = b.currentStock;
            break;
          default:
            aValue = a.productName.toLowerCase();
            bValue = b.productName.toLowerCase();
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'DESC' ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
        } else {
          const numA = Number(aValue) || 0;
          const numB = Number(bValue) || 0;
          return sortOrder === 'DESC' ? numB - numA : numA - numB;
        }
      });
    }

    // Calculate status counts for summary
    const statusCounts = {
      total: stockWithCalculations.length,
      critical: stockWithCalculations.filter(item => item.availableStock <= 0).length,
      negative: stockWithCalculations.filter(item => item.availableStock < 0).length,
      low: stockWithCalculations.filter(item => {
        const available = item.availableStock;
        const norm = item.normStock || 0;
        return available > 0 && available < norm * 0.5;
      }).length,
      normal: stockWithCalculations.filter(item => {
        const available = item.availableStock;
        const norm = item.normStock || 0;
        return available > 0 && available >= norm * 0.5; // ИСПРАВЛЕНО: только товары в наличии И выше нормы
      }).length,
      inProduction: stockWithCalculations.filter(item => item.inProductionQuantity > 0).length
    };

    res.json({
      success: true,
      data: filteredData,
      summary: statusCounts
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/adjust - Adjust stock levels (UPDATED)
router.post('/adjust', authenticateToken, requirePermission('stock', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, adjustment, comment, productionAction, productionQuantity } = req.body;
    const userId = req.user!.id;

    if (!productId || adjustment === undefined) {
      return next(createError('Product ID and adjustment are required', 400));
    }

    // Транзакция для атомарного выполнения операций
    const result = await db.transaction(async (tx) => {
      // 1. Корректировка склада
      const stockResult = await performStockOperation({
        productId: Number(productId),
        type: 'adjustment',
        quantity: Number(adjustment),
        userId,
        comment: comment || 'Корректировка остатков'
      });

      if (!stockResult.success) {
        throw new Error(stockResult.message);
      }

      // 2. Управление производственной очередью (если указано)
      let productionMessage = '';
      if (productionAction && productionAction !== 'none' && productionQuantity > 0) {
        if (productionAction === 'add') {
          // Добавляем в производственную очередь
          await tx.insert(schema.productionQueue).values({
            productId: Number(productId),
            quantity: Number(productionQuantity),
            priority: 1,
            status: 'queued',
            notes: `Добавлено при корректировке склада: ${comment || 'Ручная корректировка'}`,
            createdAt: new Date()
          });
          productionMessage = ` Добавлено в производство: ${productionQuantity} шт.`;
        } else if (productionAction === 'remove') {
          // Удаляем из производственной очереди (FIFO - сначала самые старые)
          const queueItems = await tx
            .select()
            .from(schema.productionQueue)
            .where(
              and(
                eq(schema.productionQueue.productId, Number(productId)),
                inArray(schema.productionQueue.status, ['queued', 'in_progress'])
              )
            )
            .orderBy(schema.productionQueue.createdAt);

          let remainingToRemove = Number(productionQuantity);
          for (const item of queueItems) {
            if (remainingToRemove <= 0) break;
            
            if (item.quantity <= remainingToRemove) {
              // Удаляем полностью
              await tx
                .delete(schema.productionQueue)
                .where(eq(schema.productionQueue.id, item.id));
              remainingToRemove -= item.quantity;
            } else {
              // Уменьшаем количество
              await tx
                .update(schema.productionQueue)
                .set({ quantity: item.quantity - remainingToRemove })
                .where(eq(schema.productionQueue.id, item.id));
              remainingToRemove = 0;
            }
          }
          const actuallyRemoved = Number(productionQuantity) - remainingToRemove;
          productionMessage = ` Убрано из производства: ${actuallyRemoved} шт.`;
        }
      }

      return {
        stockResult,
        productionMessage
      };
    });

    res.json({
      success: true,
      message: result.stockResult.message + result.productionMessage,
      data: result.stockResult.stockInfo
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/stock/movements/:productId - Get stock movement history
router.get('/movements/:productId', authenticateToken, requirePermission('stock', 'view'), async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const { limit = 50, offset = 0 } = req.query;

    const movements = await db.query.stockMovements.findMany({
      where: eq(schema.stockMovements.productId, productId),
      with: {
        user: {
          columns: {
            passwordHash: false
          }
        }
      },
      orderBy: sql`${schema.stockMovements.createdAt} DESC`,
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json({
      success: true,
      data: movements
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/reserve - Reserve stock for order (UPDATED)
router.post('/reserve', authenticateToken, requirePermission('stock', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity, orderId } = req.body;
    const userId = req.user!.id;

    if (!productId || !quantity || !orderId) {
      return next(createError('Product ID, quantity, and order ID are required', 400));
    }

    const result = await performStockOperation({
      productId: Number(productId),
      type: 'reservation',
      quantity: Number(quantity),
      orderId: Number(orderId),
      userId,
      comment: `Резервирование для заказа #${orderId}`
    });

    if (!result.success) {
      return next(createError(result.message, 400));
    }

    res.json({
      success: true,
      message: result.message,
      data: result.stockInfo
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/release - Release reserved stock (UPDATED)
router.post('/release', authenticateToken, requirePermission('stock', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity, orderId } = req.body;
    const userId = req.user!.id;

    const result = await performStockOperation({
      productId: Number(productId),
      type: 'release',
      quantity: Number(quantity),
      orderId: orderId ? Number(orderId) : undefined,
      userId,
      comment: `Снятие резерва${orderId ? ` с заказа #${orderId}` : ''}`
    });

    if (!result.success) {
      return next(createError(result.message, 400));
    }

    res.json({
      success: true,
      message: result.message,
      data: result.stockInfo
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/outgoing - Process outgoing shipment (UPDATED)
router.post('/outgoing', authenticateToken, requirePermission('stock', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity, orderId } = req.body;
    const userId = req.user!.id;

    if (!productId || !quantity) {
      return next(createError('Product ID and quantity are required', 400));
    }

    const result = await performStockOperation({
      productId: Number(productId),
      type: 'outgoing',
      quantity: Number(quantity),
      orderId: orderId ? Number(orderId) : undefined,
      userId,
      comment: `Отгрузка товара${orderId ? ` по заказу #${orderId}` : ''}`
    });

    if (!result.success) {
      return next(createError(result.message, 400));
    }

    res.json({
      success: true,
      message: result.message,
      data: result.stockInfo
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/incoming - Process incoming goods (NEW)
router.post('/incoming', authenticateToken, requirePermission('stock', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity, comment } = req.body;
    const userId = req.user!.id;

    if (!productId || !quantity || quantity <= 0) {
      return next(createError('Product ID and positive quantity are required', 400));
    }

    const result = await performStockOperation({
      productId: Number(productId),
      type: 'incoming',
      quantity: Number(quantity),
      userId,
      comment: comment || 'Поступление товара на склад'
    });

    if (!result.success) {
      return next(createError(result.message, 400));
    }

    res.json({
      success: true,
      message: result.message,
      data: result.stockInfo
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/stock/validate - Validate all stock data integrity (NEW)
router.get('/validate', authenticateToken, requirePermission('stock', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const validation = await validateAllStock();
    
    res.json({
      success: true,
      data: {
        valid: validation.valid,
        invalid: validation.invalid,
        total: validation.valid + validation.invalid.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/fix-inconsistencies - Fix stock data inconsistencies (NEW)
router.post('/fix-inconsistencies', authenticateToken, requirePermission('stock', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    
    const result = await fixStockInconsistencies(userId);
    
    res.json({
      success: true,
      message: `Исправлено записей: ${result.fixed}`,
      data: {
        fixed: result.fixed,
        errors: result.errors
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/sync-reservations - Sync reservations with orders (NEW)
router.post('/sync-reservations', authenticateToken, requirePermission('stock', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    
    const result = await syncReservationsWithOrders(userId);
    
    res.json({
      success: true,
      message: `Синхронизировано записей: ${result.synced}`,
      data: {
        synced: result.synced,
        errors: result.errors
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/stock/statistics - Get enhanced stock statistics (NEW)
router.get('/statistics', authenticateToken, requirePermission('stock', 'view'), async (req: AuthRequest, res, next) => {
  try {
    const statistics = await getStockStatistics();
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/stock/product/:id - Get detailed stock info for specific product (NEW)
router.get('/product/:id', authenticateToken, requirePermission('stock', 'view'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    const stockInfo = await getStockInfo(Number(id));
    
    res.json({
      success: true,
      data: stockInfo
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/clear-reservations - Clear all reservations for a product (admin only)
router.post('/clear-reservations', authenticateToken, requirePermission('stock', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, comment } = req.body;
    const userId = req.user!.id;

    if (!productId) {
      return next(createError('Product ID is required', 400));
    }

    // Get current stock
    const currentStock = await db.query.stock.findFirst({
      where: eq(schema.stock.productId, productId),
      with: {
        product: true
      }
    });

    if (!currentStock) {
      return next(createError('Stock record not found', 404));
    }

    const reservedQty = currentStock.reservedStock;
    
    if (reservedQty <= 0) {
      return res.json({
        success: true,
        message: 'No reservations to clear'
      });
    }

    // Clear all reservations
    await db.update(schema.stock)
      .set({
        reservedStock: 0,
        updatedAt: new Date()
      })
      .where(eq(schema.stock.productId, productId));

    // Log movement
    await db.insert(schema.stockMovements).values({
      productId,
      movementType: 'release_reservation',
      quantity: -reservedQty,
      comment: comment || `Очистка зависшего резерва: ${reservedQty} шт.`,
      userId
    });

    res.json({
      success: true,
      message: `Cleared ${reservedQty} reserved items for product: ${currentStock.product?.name}`,
      data: { clearedQuantity: reservedQty }
    });
  } catch (error) {
    next(error);
  }
});

// 🔧 НОВЫЙ ENDPOINT: Исправление целостности данных
router.post('/fix-integrity', authenticateToken, requirePermission('stock', 'manage'), async (req, res) => {
  try {
    console.log('🔍 Начинаю диагностику и исправление данных...');
    
    // 1. Получаем все товары и их складские данные
    const allProducts = await db.select({
      id: schema.products.id,
      name: schema.products.name,
      article: schema.products.article
    }).from(schema.products);
    
    const problems: string[] = [];
    const fixes: any[] = [];
    
    // 2. Для каждого товара пересчитываем метрики
    for (const product of allProducts) {
      // Получаем текущие данные склада
      let stockData = await db
        .select()
        .from(schema.stock)
        .where(eq(schema.stock.productId, product.id))
        .limit(1);
      
      // Создаем запись склада если её нет
      if (stockData.length === 0) {
        await db.insert(schema.stock).values({
          productId: product.id,
          currentStock: 0,
          reservedStock: 0,
          updatedAt: new Date()
        });
        
        stockData = await db
          .select()
          .from(schema.stock)
          .where(eq(schema.stock.productId, product.id))
          .limit(1);
        
        problems.push(`✅ Создана запись склада для ${product.name}`);
      }
      
      const currentStockData = stockData[0];
      
      // Считаем реальные резервы из активных заказов
      const realReserved = await db
        .select({
          total: sql`COALESCE(SUM(${schema.orderItems.quantity}), 0)`
        })
        .from(schema.orderItems)
        .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
        .where(
          and(
            eq(schema.orderItems.productId, product.id),
            sql`${schema.orders.status} IN ('new', 'confirmed', 'in_production')`
          )
        );
     
     const reservedCount = parseInt(realReserved[0].total as string) || 0;
     
     // Исправляем отрицательные значения
     if (currentStockData.currentStock < 0) {
       await db
         .update(schema.stock)
         .set({
           currentStock: 0,
           updatedAt: new Date()
         })
         .where(eq(schema.stock.productId, product.id));
       
       problems.push(`⚠️ ${product.name}: исправлен отрицательный остаток ${currentStockData.currentStock} → 0`);
     }
   }
   
   res.json({
     success: true,
     message: 'Данные успешно проверены и исправлены',
     problemsFound: problems.length,
     problems: problems
   });
   
 } catch (error: any) {
   console.error('❌ Ошибка при исправлении данных:', error);
   res.status(500).json({
     success: false,
     message: 'Ошибка при исправлении данных',
     error: error.message
   });
 }
});

// POST /api/stock/audit - комплексный аудит данных
router.post('/audit', authenticateToken, requirePermission('stock', 'manage'), async (req, res) => {
  try {
    const auditResults = {
      timestamp: new Date().toISOString(),
      issues: [] as string[],
      statistics: {
        totalProducts: 0,
        negativeStock: 0,
        excessiveReservations: 0,
        productionMismatches: 0,
        orphanedReservations: 0
      },
      recommendations: [] as string[]
    };

    // 1. Проверяем все товары с остатками
    const allStock = await db
      .select({
        productId: schema.stock.productId,
        currentStock: schema.stock.currentStock,
        reservedStock: schema.stock.reservedStock,
        productName: schema.products.name,
        productArticle: schema.products.article,
        isActive: schema.products.isActive
      })
      .from(schema.stock)
      .innerJoin(schema.products, eq(schema.stock.productId, schema.products.id));

    auditResults.statistics.totalProducts = allStock.length;

    // 2. Проверяем каждый товар
    for (const stock of allStock) {
      const productId = stock.productId;
      const currentStock = Number(stock.currentStock || 0);
      const reservedInDB = Number(stock.reservedStock || 0);

      // Проверка отрицательных остатков
      if (currentStock < 0) {
        auditResults.statistics.negativeStock++;
        auditResults.issues.push(`❌ ${stock.productName} (${stock.productArticle}): отрицательный остаток ${currentStock}`);
      }

      // Реальный расчет резерва из заказов
      const realReserved = await db
        .select({
          total: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)`
        })
        .from(schema.orderItems)
        .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
        .where(
          and(
            eq(schema.orderItems.productId, productId),
            sql`${schema.orders.status} IN ('new', 'confirmed', 'in_production')`
          )
        );

      const actualReserved = Number(realReserved[0]?.total || 0);

      // Проверка превышения резерва над остатком
      if (reservedInDB > currentStock) {
        auditResults.statistics.excessiveReservations++;
        auditResults.issues.push(`⚠️ ${stock.productName} (${stock.productArticle}): резерв ${reservedInDB} превышает остаток ${currentStock}`);
      }

      // Проверка соответствия резерва в базе и в заказах
      if (Math.abs(reservedInDB - actualReserved) > 0.01) {
        auditResults.statistics.orphanedReservations++;
        auditResults.issues.push(`🔄 ${stock.productName} (${stock.productArticle}): резерв в БД ${reservedInDB} не совпадает с заказами ${actualReserved}`);
      }

      // Проверка производственных заданий
      const productionTasks = await db
        .select({
          total: sql<number>`COALESCE(SUM(
            CASE 
              WHEN ${schema.productionTasks.status} IN ('pending', 'in_progress') 
              THEN ${schema.productionTasks.requestedQuantity}
              ELSE 0
            END
          ), 0)`
        })
        .from(schema.productionTasks)
        .where(
          and(
            eq(schema.productionTasks.productId, productId),
            sql`${schema.productionTasks.status} IN ('pending', 'in_progress')`
          )
        );

      const inProduction = Number(productionTasks[0]?.total || 0);
      const available = currentStock - actualReserved;
      const shortage = actualReserved - currentStock;

      // Проверка логики производственных заданий
      if (available >= 0 && inProduction > 0) {
        auditResults.issues.push(`❓ ${stock.productName} (${stock.productArticle}): есть производственные задания (${inProduction}), но товар в наличии (${available})`);
      }

      if (shortage > 0 && inProduction === 0) {
        auditResults.recommendations.push(`💡 ${stock.productName} (${stock.productArticle}): дефицит ${shortage}, стоит создать производственное задание`);
      }

      // Проверка неактивных товаров с остатками
      if (!stock.isActive && (currentStock > 0 || reservedInDB > 0)) {
        auditResults.issues.push(`🚫 ${stock.productName} (${stock.productArticle}): неактивный товар с остатками (текущий: ${currentStock}, резерв: ${reservedInDB})`);
      }
    }

    // 3. Общие рекомендации
    if (auditResults.statistics.negativeStock > 0) {
      auditResults.recommendations.push('🔧 Исправьте отрицательные остатки через корректировку или поступление товара');
    }

    if (auditResults.statistics.excessiveReservations > 0) {
      auditResults.recommendations.push('🔧 Пересмотрите резервы, превышающие остатки - возможно есть отмененные заказы');
    }

    if (auditResults.statistics.orphanedReservations > 0) {
      auditResults.recommendations.push('🔧 Запустите синхронизацию резервов с заказами через /api/stock/sync-reservations');
    }

    auditResults.recommendations.push('📊 Рекомендуется проводить аудит еженедельно для поддержания целостности данных');

    res.json({
      success: true,
      audit: auditResults
    });

  } catch (error: any) {
    console.error('❌ Ошибка при аудите:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при проведении аудита',
      error: error.message
    });
  }
});

// POST /api/stock/sync-reservations - синхронизация резервов с заказами
router.post('/sync-reservations', authenticateToken, requirePermission('stock', 'manage'), async (req, res) => {
  try {
    const syncResults = {
      synchronized: 0,
      errors: [] as string[]
    };

    // Получаем реальные резервы из заказов
    const actualReservations = await db
      .select({
        productId: schema.orderItems.productId,
        totalReserved: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)`
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(sql`${schema.orders.status} IN ('new', 'confirmed', 'in_production')`)
      .groupBy(schema.orderItems.productId);

    // Получаем все текущие записи остатков
    const allStock = await db.query.stock.findMany();

    for (const stock of allStock) {
      const actualReserve = actualReservations.find(r => r.productId === stock.productId);
      const shouldBeReserved = Number(actualReserve?.totalReserved || 0);

      if (stock.reservedStock !== shouldBeReserved) {
        try {
          await db.update(schema.stock)
            .set({
              reservedStock: shouldBeReserved,
              updatedAt: new Date()
            })
            .where(eq(schema.stock.productId, stock.productId));

          syncResults.synchronized++;
        } catch (error: any) {
          syncResults.errors.push(`Ошибка синхронизации товара ${stock.productId}: ${error.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Синхронизировано ${syncResults.synchronized} записей`,
      synchronized: syncResults.synchronized,
      errors: syncResults.errors
    });

  } catch (error: any) {
    console.error('❌ Ошибка при синхронизации:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при синхронизации резервов',
      error: error.message
    });
  }
});

export default router;