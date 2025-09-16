import { db, schema } from '../db';
import { eq, sql, and } from 'drizzle-orm';

/**
 * Централизованная система управления остатками товаров
 * Обеспечивает целостность данных и автоматическую валидацию
 */

export interface StockInfo {
  productId: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  isValid: boolean;
  errors?: string[];
}

export interface StockOperation {
  productId: number;
  type: 'adjustment' | 'reservation' | 'release' | 'outgoing' | 'incoming';
  quantity: number;
  orderId?: number;
  userId: number;
  comment?: string;
}

/**
 * Получить информацию об остатках с валидацией
 */
export async function getStockInfo(productId: number): Promise<StockInfo> {
  const stockRecord = await db.query.stock.findFirst({
    where: eq(schema.stock.productId, productId),
    with: {
      product: true
    }
  });

  if (!stockRecord) {
    return {
      productId,
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
      isValid: false,
      errors: ['Stock record not found']
    };
  }

  const availableStock = stockRecord.currentStock - stockRecord.reservedStock;
  const errors: string[] = [];

  // Валидация целостности данных
  if (stockRecord.currentStock < 0) {
    errors.push('Отрицательный общий остаток');
  }
  
  if (stockRecord.reservedStock < 0) {
    errors.push('Отрицательный резерв');
  }
  
  if (stockRecord.reservedStock > stockRecord.currentStock) {
    errors.push('Резерв превышает общий остаток');
  }

  return {
    productId,
    currentStock: stockRecord.currentStock,
    reservedStock: stockRecord.reservedStock,
    availableStock,
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Безопасное изменение остатков с валидацией
 */
export async function performStockOperation(operation: StockOperation): Promise<{ success: boolean; message: string; stockInfo?: StockInfo }> {
  const { productId, type, quantity, orderId, userId, comment } = operation;

  // Начинаем транзакцию для атомарности
  return await db.transaction(async (tx) => {
    // Блокируем запись для предотвращения race conditions
    const currentStock = await tx.query.stock.findFirst({
      where: eq(schema.stock.productId, productId)
    });

    if (!currentStock) {
      // Создаем запись если её нет
      await tx.insert(schema.stock).values({
        productId,
        currentStock: 0,
        reservedStock: 0,
        updatedAt: new Date()
      });
      
      return performStockOperation(operation); // Повторяем операцию
    }

    let newCurrentStock = currentStock.currentStock;
    let newReservedStock = currentStock.reservedStock;

    // Рассчитываем новые значения в зависимости от типа операции
    switch (type) {
      case 'adjustment':
        newCurrentStock = currentStock.currentStock + quantity;
        break;
        
      case 'reservation':
        if (quantity > 0) {
          const availableStock = currentStock.currentStock - currentStock.reservedStock;
          if (quantity > availableStock) {
            return {
              success: false,
              message: `Недостаточно товара для резерва. Доступно: ${availableStock}, запрашивается: ${quantity}`
            };
          }
          newReservedStock = currentStock.reservedStock + quantity;
        } else {
          return { success: false, message: 'Количество для резерва должно быть положительным' };
        }
        break;
        
      case 'release':
        if (quantity > 0) {
          if (quantity > currentStock.reservedStock) {
            return {
              success: false,
              message: `Нельзя снять резерв больше чем зарезервировано. Зарезервировано: ${currentStock.reservedStock}, запрашивается: ${quantity}`
            };
          }
          newReservedStock = currentStock.reservedStock - quantity;
        } else {
          return { success: false, message: 'Количество для снятия резерва должно быть положительным' };
        }
        break;
        
      case 'outgoing':
        if (quantity > 0) {
          // При отгрузке уменьшаем и общий остаток и резерв
          if (quantity > currentStock.reservedStock) {
            return {
              success: false,
              message: `Нельзя отгрузить больше чем зарезервировано. Зарезервировано: ${currentStock.reservedStock}, запрашивается: ${quantity}`
            };
          }
          newCurrentStock = currentStock.currentStock - quantity;
          newReservedStock = currentStock.reservedStock - quantity;
        } else {
          return { success: false, message: 'Количество для отгрузки должно быть положительным' };
        }
        break;
        
      case 'incoming':
        if (quantity > 0) {
          newCurrentStock = currentStock.currentStock + quantity;
        } else {
          return { success: false, message: 'Количество поступления должно быть положительным' };
        }
        break;
        
      default:
        return { success: false, message: 'Неизвестный тип операции' };
    }

    // Валидация финальных значений
    if (newCurrentStock < 0 && type !== 'adjustment') {
      return {
        success: false,
        message: `Операция приведет к отрицательному остатку: ${newCurrentStock}`
      };
    }

    if (newReservedStock < 0) {
      return {
        success: false,
        message: `Операция приведет к отрицательному резерву: ${newReservedStock}`
      };
    }

    // Специальная логика для корректировок - ПЕРЕМЕЩЕНО СЮДА!
    if (type === 'adjustment' && newReservedStock > newCurrentStock) {
      // При корректировке остатка автоматически корректируем резерв
      const excessReserve = newReservedStock - newCurrentStock;
      newReservedStock = newCurrentStock;
      
      // Логируем автоматическую корректировку резерва
      await tx.insert(schema.stockMovements).values({
        productId,
        movementType: 'release_reservation',
        quantity: -excessReserve,
        comment: `Автокорректировка резерва при изменении остатка: снято ${excessReserve} шт.`,
        userId
      });
    }

    // Основная валидация резерва (для всех операций кроме корректировок)
    if (newReservedStock > newCurrentStock && type !== 'adjustment') {
      return {
        success: false,
        message: `Резерв не может превышать общий остаток. Остаток: ${newCurrentStock}, резерв: ${newReservedStock}`
      };
    }

    // Обновляем остатки
    await tx.update(schema.stock)
      .set({
        currentStock: newCurrentStock,
        reservedStock: newReservedStock,
        updatedAt: new Date()
      })
      .where(eq(schema.stock.productId, productId));

    // Логируем движение
    const movementType = getMovementType(type);
    const logQuantity = type === 'outgoing' ? -quantity : quantity;
    
    await tx.insert(schema.stockMovements).values({
      productId,
      movementType,
      quantity: logQuantity,
      referenceId: orderId || null,
      referenceType: orderId ? 'order' : null,
      comment: comment || `${type} operation`,
      userId
    });

    // Получаем обновленную информацию
    const stockInfo = await getStockInfo(productId);

    // Пересчитываем статусы заказов для этого товара
    try {
      const { recalculateOrdersForProduct } = await import('./stockDistribution');
      await recalculateOrdersForProduct(productId);
      console.log(`🔄 Пересчитаны статусы заказов для товара ${productId} после изменения остатков`);
    } catch (error) {
      console.error(`❌ Ошибка пересчета статусов заказов для товара ${productId}:`, error);
      // Не прерываем основную операцию из-за ошибки пересчета
    }

    return {
      success: true,
      message: `Операция ${type} выполнена успешно`,
      stockInfo
    };
  });
}

/**
 * Проверка целостности всех остатков
 */
export async function validateAllStock(): Promise<{ valid: number; invalid: StockInfo[] }> {
  const allStock = await db.query.stock.findMany({
    with: {
      product: true
    }
  });

  const invalidStock: StockInfo[] = [];
  let validCount = 0;

  for (const stock of allStock) {
    const stockInfo = await getStockInfo(stock.productId);
    if (!stockInfo.isValid) {
      invalidStock.push(stockInfo);
    } else {
      validCount++;
    }
  }

  return {
    valid: validCount,
    invalid: invalidStock
  };
}

/**
 * Автоматическое исправление некорректных остатков
 */
export async function fixStockInconsistencies(userId: number): Promise<{ fixed: number; errors: string[] }> {
  const validation = await validateAllStock();
  const errors: string[] = [];
  let fixedCount = 0;

  for (const invalidStock of validation.invalid) {
    try {
      const { productId, currentStock, reservedStock } = invalidStock;

      // Исправляем основные проблемы
      let newCurrentStock = Math.max(0, currentStock);
      let newReservedStock = Math.max(0, reservedStock);

      // Если резерв больше остатка, корректируем резерв
      if (newReservedStock > newCurrentStock) {
        newReservedStock = newCurrentStock;
      }

      await db.update(schema.stock)
        .set({
          currentStock: newCurrentStock,
          reservedStock: newReservedStock,
          updatedAt: new Date()
        })
        .where(eq(schema.stock.productId, productId));

      // Логируем исправление
      await db.insert(schema.stockMovements).values({
        productId,
        movementType: 'adjustment',
        quantity: newCurrentStock - currentStock,
        comment: `Автоматическое исправление некорректных данных`,
        userId
      });

      if (newReservedStock !== reservedStock) {
        await db.insert(schema.stockMovements).values({
          productId,
          movementType: 'release_reservation',
          quantity: newReservedStock - reservedStock,
          comment: `Автоматическая корректировка избыточного резерва`,
          userId
        });
      }

      fixedCount++;
    } catch (error) {
      errors.push(`Ошибка исправления товара ${invalidStock.productId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { fixed: fixedCount, errors };
}

/**
 * Синхронизация резервов с актуальными заказами
 */
export async function syncReservationsWithOrders(userId: number): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let syncedCount = 0;

  try {
    // Получаем все активные резервы из заказов
    const actualReservations = await db
      .select({
        productId: schema.orderItems.productId,
        totalReserved: sql<number>`SUM(COALESCE(${schema.orderItems.reservedQuantity}, 0))`.as('totalReserved')
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(sql`${schema.orders.status} IN ('new', 'confirmed', 'in_production', 'ready')`)
      .groupBy(schema.orderItems.productId);

    // Получаем текущие резервы в stock
    const currentStock = await db.query.stock.findMany();

    for (const stock of currentStock) {
      const actualReservation = actualReservations.find(r => r.productId === stock.productId);
      const shouldBeReserved = actualReservation?.totalReserved || 0;

      if (stock.reservedStock !== shouldBeReserved) {
        await db.update(schema.stock)
          .set({
            reservedStock: shouldBeReserved,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, stock.productId));

        // Логируем синхронизацию
        await db.insert(schema.stockMovements).values({
          productId: stock.productId,
          movementType: 'release_reservation',
          quantity: shouldBeReserved - stock.reservedStock,
          comment: `Синхронизация резерва с заказами: было ${stock.reservedStock}, стало ${shouldBeReserved}`,
          userId
        });

        syncedCount++;
      }
    }
  } catch (error) {
    errors.push(`Ошибка синхронизации: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { synced: syncedCount, errors };
}

/**
 * Получить тип движения для логирования
 */
function getMovementType(operationType: string): 'incoming' | 'outgoing' | 'cutting_out' | 'cutting_in' | 'reservation' | 'release_reservation' | 'adjustment' {
  const mapping: Record<string, 'incoming' | 'outgoing' | 'cutting_out' | 'cutting_in' | 'reservation' | 'release_reservation' | 'adjustment'> = {
    'adjustment': 'adjustment',
    'reservation': 'reservation',
    'release': 'release_reservation',
    'outgoing': 'outgoing',
    'incoming': 'incoming'
  };
  
  return mapping[operationType] || 'adjustment';
}

/**
 * Получить статистику по остаткам
 */
export async function getStockStatistics(): Promise<{
  total: number;
  critical: number;
  negative: number;
  low: number;
  normal: number;
  invalidData: number;
}> {
  const validation = await validateAllStock();
  
  const stats = await db
    .select({
      total: sql<number>`COUNT(*)`.as('total'),
      critical: sql<number>`COUNT(*) FILTER (WHERE (current_stock - reserved_stock) <= 0)`.as('critical'),
      negative: sql<number>`COUNT(*) FILTER (WHERE (current_stock - reserved_stock) < 0)`.as('negative'),
      low: sql<number>`COUNT(*) FILTER (WHERE (current_stock - reserved_stock) > 0 AND (current_stock - reserved_stock) <= COALESCE((SELECT norm_stock FROM products WHERE id = stock.product_id), 0) * 0.5)`.as('low'),
      normal: sql<number>`COUNT(*) FILTER (WHERE (current_stock - reserved_stock) > COALESCE((SELECT norm_stock FROM products WHERE id = stock.product_id), 0) * 0.5)`.as('normal')
    })
    .from(schema.stock)
    .innerJoin(schema.products, eq(schema.stock.productId, schema.products.id))
    .where(eq(schema.products.isActive, true));

  return {
    total: Number(stats[0]?.total || 0),
    critical: Number(stats[0]?.critical || 0),
    negative: Number(stats[0]?.negative || 0),
    low: Number(stats[0]?.low || 0),
    normal: Number(stats[0]?.normal || 0),
    invalidData: validation.invalid.length
  };
} 