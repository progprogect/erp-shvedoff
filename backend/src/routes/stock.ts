import express from 'express';
import { db, schema } from '../db';
import { eq, sql, and, or, ilike, inArray } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
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

  // Резерв = сумма всех товаров в активных заказах (не отмененных и не доставленных)
  const reservedQuery = db
    .select({
      productId: schema.orderItems.productId,
      quantity: sql<number>`SUM(${schema.orderItems.quantity})`.as('quantity')
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
    reservedMap.set(item.productId, item.quantity);
  });

  return reservedMap;
}

// Helper function to calculate production quantity for products
async function getProductionQuantities(productIds?: number[]) {
  // Если нет productIds или пустой массив, возвращаем пустую Map
  if (!productIds || productIds.length === 0) {
    return new Map<number, number>();
  }

  // К производству = только товары в очереди производства
  const queueQuery = db
    .select({
      productId: schema.productionQueue.productId,
      quantity: sql<number>`SUM(${schema.productionQueue.quantity})`.as('quantity')
    })
    .from(schema.productionQueue)
    .where(
      and(
        inArray(schema.productionQueue.status, ['queued', 'in_progress']),
        inArray(schema.productionQueue.productId, productIds)
      )
    )
    .groupBy(schema.productionQueue.productId);

  const inQueue = await queueQuery;
  const productionMap = new Map<number, number>();

  inQueue.forEach(item => {
    productionMap.set(item.productId, item.quantity);
  });

  return productionMap;
}

// GET /api/stock - Get current stock levels
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, categoryId, search } = req.query;

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
        price: schema.products.price
      })
      .from(schema.stock)
      .innerJoin(schema.products, eq(schema.stock.productId, schema.products.id))
      .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .where(whereClause)
      .orderBy(schema.products.name);

    // Получаем ID всех продуктов
    const productIds = stockData.map(item => item.productId);
    
    // Получаем реальные резервы из заказов и количества к производству
    const [reservedQuantities, productionQuantities] = await Promise.all([
      getReservedQuantities(productIds),
      getProductionQuantities(productIds)
    ]);

    // Добавляем рассчитанные данные к складским остаткам
    const stockWithCalculations = stockData.map(item => {
      const reserved = reservedQuantities.get(item.productId) || 0;
      const inProduction = productionQuantities.get(item.productId) || 0;
      const available = item.currentStock - reserved;
      
      return {
        ...item,
        reservedStock: reserved,
        availableStock: available,
        inProductionQuantity: inProduction
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
            return available >= norm * 0.5;
          case 'in_production':
            return inProduction > 0;
          default:
            return true;
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
        return available >= norm * 0.5;
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
router.post('/adjust', authenticateToken, authorizeRoles('manager', 'director', 'warehouse'), async (req: AuthRequest, res, next) => {
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
router.get('/movements/:productId', authenticateToken, async (req, res, next) => {
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
router.post('/reserve', authenticateToken, async (req: AuthRequest, res, next) => {
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
router.post('/release', authenticateToken, async (req: AuthRequest, res, next) => {
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
router.post('/outgoing', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
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
router.post('/incoming', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
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
router.get('/validate', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
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
router.post('/fix-inconsistencies', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
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
router.post('/sync-reservations', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
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
router.get('/statistics', authenticateToken, async (req: AuthRequest, res, next) => {
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
router.get('/product/:id', authenticateToken, async (req: AuthRequest, res, next) => {
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
router.post('/clear-reservations', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
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
router.post('/fix-integrity', authenticateToken, async (req, res) => {
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

export default router;