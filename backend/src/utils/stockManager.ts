import { db, schema } from '../db';
import { eq, sql, and, gte, lte, desc, asc, inArray } from 'drizzle-orm';

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

    // Для операций incoming - автоматически распределяем товар между заказами
    if (type === 'incoming' && quantity > 0) {
      try {
        const { distributeNewStockToOrders } = await import('./stockDistribution');
        const distributionResult = await distributeNewStockToOrders(productId, quantity);
        
        if (distributionResult.distributed > 0) {
          console.log(`🎯 Автоматически распределено ${distributionResult.distributed} шт товара ${productId} между ${distributionResult.ordersUpdated.length} заказами`);
        }
      } catch (error) {
        console.error(`❌ Ошибка автораспределения товара ${productId}:`, error);
        // Не прерываем основную операцию из-за ошибки автораспределения
      }
    }

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
 * Отменить движение остатков
 */
export async function cancelStockMovement(
  movementId: number,
  userId: number
): Promise<{
  success: boolean;
  message?: string;
  productId?: number;
  newStock?: number;
  newReservedStock?: number;
}> {
  return await db.transaction(async (tx) => {
    // Получаем движение
    const movement = await tx.query.stockMovements.findFirst({
      where: eq(schema.stockMovements.id, movementId),
      with: {
        product: true
      }
    });

    if (!movement) {
      return {
        success: false,
        message: 'Движение не найдено'
      };
    }

    const { productId, movementType, quantity, referenceType, referenceId } = movement;

    // Для движений cutting_progress остатки откатываются автоматически триггером БД
    // при удалении записи cutting_progress_log, поэтому пропускаем ручной откат
    const isCuttingProgress = referenceType === 'cutting_progress';

    let newCurrentStock: number | undefined;
    let newReservedStock: number | undefined;

    if (!isCuttingProgress) {
      // Получаем текущие остатки только для не-cutting_progress движений
      const stockRecord = await tx.query.stock.findFirst({
        where: eq(schema.stock.productId, productId)
      });

      if (!stockRecord) {
        return {
          success: false,
          message: 'Запись остатков не найдена'
        };
      }

      newCurrentStock = stockRecord.currentStock;
      newReservedStock = stockRecord.reservedStock;

      // Откат остатков в зависимости от типа движения
      switch (movementType) {
      case 'incoming':
        // Уменьшаем currentStock на quantity
        newCurrentStock = newCurrentStock - quantity;
        break;

      case 'outgoing':
        // Увеличиваем currentStock на quantity
        newCurrentStock = newCurrentStock + quantity;
        break;

      case 'cutting_out':
        // quantity для cutting_out хранится как отрицательное (например -10)
        // При создании движения остатки уменьшаются на sourceQuantity
        // При отмене нужно вернуть товар обратно - увеличить на Math.abs(quantity)
        const cuttingOutQuantity = Math.abs(quantity);
        newCurrentStock = newCurrentStock + cuttingOutQuantity;
        newReservedStock = newReservedStock + cuttingOutQuantity;
        break;

      case 'cutting_in':
        // Уменьшаем currentStock на quantity
        newCurrentStock = newCurrentStock - quantity;
        break;

      case 'reservation':
        // Уменьшаем reservedStock на quantity
        newReservedStock = newReservedStock - quantity;
        break;

      case 'release_reservation':
        // Увеличиваем reservedStock на quantity
        newReservedStock = newReservedStock + quantity;
        break;

      case 'adjustment':
        // Откатываем по знаку quantity
        if (quantity > 0) {
          newCurrentStock = newCurrentStock - quantity;
        } else {
          newCurrentStock = newCurrentStock + Math.abs(quantity);
        }
        break;

      default:
        return {
          success: false,
          message: `Неизвестный тип движения: ${movementType}`
        };
      }

      // Обновляем остатки только для не-cutting_progress движений
      await tx.update(schema.stock)
        .set({
          currentStock: newCurrentStock,
          reservedStock: newReservedStock,
          updatedAt: new Date()
        })
        .where(eq(schema.stock.productId, productId));
    }

    // Обновляем статистику операций
    // Примечание: Прогресс резки пересчитывается автоматически из cutting_progress_log,
    // поэтому здесь обновляем только production_tasks
    if (referenceType && referenceId) {
      if (referenceType === 'production_task' || referenceType === 'overproduction') {
        // Обновляем статистику в production_tasks
        const task = await tx.query.productionTasks.findFirst({
          where: eq(schema.productionTasks.id, referenceId),
          with: {
            product: {
              columns: {
                id: true,
                article: true
              }
            }
          }
        });

        if (task && movementType === 'incoming') {
          const cancelQuantity = Math.abs(quantity);
          const product = await tx.query.products.findFirst({
            where: eq(schema.products.id, productId),
            columns: {
              id: true,
              article: true
            }
          });

          // Определяем тип товара по productId и артикулу
          const isMainProduct = productId === task.productId;
          const isSecondGrade = product?.article?.includes('- 2СОРТ') || product?.article?.includes('- 2сорт');
          const isLibertyGrade = product?.article?.includes('- Либер') || product?.article?.includes('- Либерти');

          // Обновляем соответствующие поля
          let updates: any = {
            updatedAt: new Date()
          };

          if (isMainProduct) {
            // Это основной товар (quality) - откатываем qualityQuantity и producedQuantity
            updates.producedQuantity = Math.max(0, (task.producedQuantity || 0) - cancelQuantity);
            updates.qualityQuantity = Math.max(0, (task.qualityQuantity || 0) - cancelQuantity);
          } else if (isSecondGrade) {
            // Это товар 2-го сорта - откатываем secondGradeQuantity и producedQuantity
            updates.producedQuantity = Math.max(0, (task.producedQuantity || 0) - cancelQuantity);
            updates.secondGradeQuantity = Math.max(0, (task.secondGradeQuantity || 0) - cancelQuantity);
          } else if (isLibertyGrade) {
            // Это товар сорта Либерти - откатываем libertyGradeQuantity и producedQuantity
            updates.producedQuantity = Math.max(0, (task.producedQuantity || 0) - cancelQuantity);
            updates.libertyGradeQuantity = Math.max(0, (task.libertyGradeQuantity || 0) - cancelQuantity);
          } else {
            // Неизвестный тип - откатываем только producedQuantity (fallback)
            updates.producedQuantity = Math.max(0, (task.producedQuantity || 0) - cancelQuantity);
          }
          
          await tx.update(schema.productionTasks)
            .set(updates)
            .where(eq(schema.productionTasks.id, referenceId));
        }
      } else if (referenceType === 'cutting_progress' && referenceId) {
        // При отмене движения cutting_progress нужно удалить соответствующую запись из cutting_progress_log
        // чтобы статистика в операции резки обновилась
        // Триггер БД автоматически откатит все изменения в остатках при удалении записи progress
        
        if (!movement.createdAt) {
          return {
            success: false,
            message: 'Дата создания движения не найдена'
          };
        }

        // Расширяем временное окно до 2 минут для более надежного поиска
        const movementCreatedAt = new Date(movement.createdAt);
        const timeWindowStart = new Date(movementCreatedAt.getTime() - 120000); // 2 минуты назад
        const timeWindowEnd = new Date(movementCreatedAt.getTime() + 120000); // 2 минуты вперед

        // Находим все движения cutting_progress для этой операции в временном окне
        const relatedMovements = await tx.query.stockMovements.findMany({
          where: and(
            eq(schema.stockMovements.referenceType, 'cutting_progress'),
            eq(schema.stockMovements.referenceId, referenceId),
            gte(schema.stockMovements.createdAt, timeWindowStart),
            lte(schema.stockMovements.createdAt, timeWindowEnd)
          ),
          orderBy: asc(schema.stockMovements.createdAt)
        });

        // Находим движение списания исходного товара - оно всегда создается триггером первым
        // и содержит детальную информацию о прогрессе в комментарии
        const sourceWriteOffMovement = relatedMovements.find(m => 
          m.movementType === 'cutting_out' && 
          m.comment && 
          m.comment.includes('Списание исходного товара') &&
          m.comment.includes('прогресс:')
        );

        // Используем время движения списания для поиска записи progress, если найдено
        // Иначе используем время текущего движения
        const searchTime = sourceWriteOffMovement?.createdAt 
          ? new Date(sourceWriteOffMovement.createdAt)
          : movementCreatedAt;
        
        // Расширяем окно поиска до 30 секунд в обе стороны от времени движения
        const progressSearchStart = new Date(searchTime.getTime() - 30000); // 30 секунд назад
        const progressSearchEnd = new Date(searchTime.getTime() + 30000); // 30 секунд вперед

        // Ищем запись progress по operationId и времени
        let progressEntries = await tx.query.cuttingProgressLog.findMany({
          where: and(
            eq(schema.cuttingProgressLog.operationId, referenceId),
            gte(schema.cuttingProgressLog.enteredAt, progressSearchStart),
            lte(schema.cuttingProgressLog.enteredAt, progressSearchEnd)
          ),
          orderBy: desc(schema.cuttingProgressLog.enteredAt)
        });

        // Если не нашли по времени, пробуем найти последнюю запись для этой операции
        // в пределах более широкого временного окна (до 5 минут назад)
        let progressEntry = progressEntries.length > 0 ? progressEntries[0] : null;
        
        if (!progressEntry) {
          // Ищем последнюю запись progress для этой операции в пределах 5 минут
          const extendedStart = new Date(movementCreatedAt.getTime() - 300000); // 5 минут назад
          const extendedEnd = new Date(movementCreatedAt.getTime() + 30000); // 30 секунд вперед
          
          const extendedEntries = await tx.query.cuttingProgressLog.findMany({
            where: and(
              eq(schema.cuttingProgressLog.operationId, referenceId),
              gte(schema.cuttingProgressLog.enteredAt, extendedStart),
              lte(schema.cuttingProgressLog.enteredAt, extendedEnd)
            ),
            orderBy: desc(schema.cuttingProgressLog.enteredAt),
            limit: 5 // Берем последние 5 записей для более точного сопоставления
          });
          
          // Если есть комментарий с информацией о прогрессе, пытаемся найти запись по значениям
          if (sourceWriteOffMovement?.comment && extendedEntries.length > 0) {
            // Парсим значения из комментария (например, "товар=-2, 2сорт=-2, Либерти=-2, брак=0")
            const comment = sourceWriteOffMovement.comment;
            const productMatch = comment.match(/товар=(-?\d+)/);
            const secondGradeMatch = comment.match(/2сорт=(-?\d+)/);
            const libertyMatch = comment.match(/Либерти=(-?\d+)/);
            const wasteMatch = comment.match(/брак=(-?\d+)/);
            
            const expectedProduct = productMatch ? parseInt(productMatch[1]) : null;
            const expectedSecondGrade = secondGradeMatch ? parseInt(secondGradeMatch[1]) : null;
            const expectedLiberty = libertyMatch ? parseInt(libertyMatch[1]) : null;
            const expectedWaste = wasteMatch ? parseInt(wasteMatch[1]) : null;
            
            // Ищем запись progress с соответствующими значениями
            if (expectedProduct !== null || expectedSecondGrade !== null || expectedLiberty !== null || expectedWaste !== null) {
              const matchingEntry = extendedEntries.find(entry => {
                const productMatch = expectedProduct === null || entry.productQuantity === expectedProduct;
                const secondGradeMatch = expectedSecondGrade === null || entry.secondGradeQuantity === expectedSecondGrade;
                const libertyMatch = expectedLiberty === null || entry.libertyGradeQuantity === expectedLiberty;
                const wasteMatch = expectedWaste === null || entry.wasteQuantity === expectedWaste;
                return productMatch && secondGradeMatch && libertyMatch && wasteMatch;
              });
              
              if (matchingEntry) {
                progressEntry = matchingEntry;
              } else if (extendedEntries.length > 0) {
                // Если не нашли точное совпадение, берем последнюю запись
                progressEntry = extendedEntries[0];
              }
            } else {
              // Если не удалось распарсить комментарий, берем последнюю запись
              progressEntry = extendedEntries[0];
            }
          } else if (extendedEntries.length > 0) {
            progressEntry = extendedEntries[0];
          }
        }

        // Если найдена запись progress, обновляем только соответствующие поля (как в производстве)
        // вместо удаления всей записи, чтобы можно было отменять отдельные движения
        if (progressEntry) {
          const progressEntryId = progressEntry.id;
          
          // Определяем, какое количество нужно откатить на основе типа движения
          const cancelQuantity = Math.abs(quantity);
          
          // Получаем информацию об операции резки для сопоставления товаров
          const cuttingOperation = await tx.query.cuttingOperations.findFirst({
            where: eq(schema.cuttingOperations.id, referenceId),
            with: {
              targetProduct: {
                columns: {
                  id: true,
                  article: true
                }
              }
            }
          });
          
          // Определяем тип товара по комментарию и productId
          const comment = movement.comment || '';
          const isTargetProduct = cuttingOperation && productId === cuttingOperation.targetProductId;
          const isSecondGrade = comment.includes('2-го сорта') || comment.includes('2сорт') || 
                                (movement.product?.article?.includes('- 2СОРТ') || movement.product?.article?.includes('- 2сорт'));
          const isLibertyGrade = comment.includes('Либерти') || comment.includes('Либер') ||
                                (movement.product?.article?.includes('- Либер') || movement.product?.article?.includes('- Либерти'));
          const isSourceWriteOff = movementType === 'cutting_out' && comment.includes('Списание исходного товара');
          
          // Формируем обновления для записи progress
          let updates: any = {};
          
          if (isSourceWriteOff) {
            // Если отменяем списание исходного товара, это означает отмену всей записи progress
            // (так как списание исходного товара связано со всей операцией)
            // Удаляем всю запись progress - триггер автоматически откатит все изменения
            await tx.delete(schema.cuttingProgressLog)
              .where(eq(schema.cuttingProgressLog.id, progressEntryId));
            
            // Удаляем все связанные движения (кроме текущего, который удалим ниже)
            const relatedMovementIds = relatedMovements
              .filter(m => m.id !== movementId)
              .map(m => m.id);
            
            if (relatedMovementIds.length > 0) {
              await tx.delete(schema.stockMovements)
                .where(inArray(schema.stockMovements.id, relatedMovementIds));
            }
            
            // Триггер создаст новые движения при DELETE, их нужно удалить
            const existingMovementIds = new Set(relatedMovements.map(m => m.id));
            const allCurrentMovements = await tx.query.stockMovements.findMany({
              where: and(
                eq(schema.stockMovements.referenceType, 'cutting_progress'),
                eq(schema.stockMovements.referenceId, referenceId)
              )
            });
            
            const triggerCreatedMovements = allCurrentMovements.filter(
              m => !existingMovementIds.has(m.id) && m.id !== movementId
            );
            
            const triggerMovementIds = triggerCreatedMovements.map(m => m.id);
            if (triggerMovementIds.length > 0) {
              await tx.delete(schema.stockMovements)
                .where(inArray(schema.stockMovements.id, triggerMovementIds));
            }
            
            // Выходим из блока, так как уже обработали удаление
          } else if (movementType === 'cutting_in' || movementType === 'adjustment') {
            // Отменяем движение готового товара или корректировку
            if (isTargetProduct && !isSecondGrade && !isLibertyGrade) {
              // Готовый товар
              updates.productQuantity = Math.max(0, (progressEntry.productQuantity || 0) - cancelQuantity);
            } else if (isSecondGrade) {
              // Товар 2-го сорта
              updates.secondGradeQuantity = Math.max(0, (progressEntry.secondGradeQuantity || 0) - cancelQuantity);
            } else if (isLibertyGrade) {
              // Товар сорта Либерти
              updates.libertyGradeQuantity = Math.max(0, (progressEntry.libertyGradeQuantity || 0) - cancelQuantity);
            }
          }
          
          // Обновляем запись progress - триггер автоматически пересчитает остатки
          if (Object.keys(updates).length > 0 && !isSourceWriteOff) {
            // Сохраняем ID существующих движений до UPDATE
            const existingMovementIds = new Set(relatedMovements.map(m => m.id));
            
            // Обновляем запись progress - триггер синхронно создаст новые движения
            await tx.update(schema.cuttingProgressLog)
              .set(updates)
              .where(eq(schema.cuttingProgressLog.id, progressEntryId));
            
            // Триггер на UPDATE синхронно создаст новые движения для отката, их нужно удалить
            // Находим все движения cutting_progress для этой операции сразу после UPDATE
            const allCurrentMovements = await tx.query.stockMovements.findMany({
              where: and(
                eq(schema.stockMovements.referenceType, 'cutting_progress'),
                eq(schema.stockMovements.referenceId, referenceId)
              )
            });
            
            // Находим движения, созданные триггером (те, которых не было в исходном списке)
            const triggerCreatedMovements = allCurrentMovements.filter(
              m => !existingMovementIds.has(m.id) && m.id !== movementId
            );
            
            // Удаляем движения, созданные триггером при откате
            const triggerMovementIds = triggerCreatedMovements.map(m => m.id);
            
            if (triggerMovementIds.length > 0) {
              await tx.delete(schema.stockMovements)
                .where(inArray(schema.stockMovements.id, triggerMovementIds));
            }
            
            // Удаляем только отменяемое движение (остальные остаются)
            // Не удаляем все связанные движения, только конкретное
          }
          
          // Получаем обновленные остатки после работы триггера
          const updatedStock = await tx.query.stock.findFirst({
            where: eq(schema.stock.productId, productId)
          });
          
          if (updatedStock) {
            newCurrentStock = updatedStock.currentStock;
            newReservedStock = updatedStock.reservedStock;
          }
        } else {
          // Если не найдена запись progress, но есть связанные движения,
          // это может означать, что запись уже была удалена или движения были созданы вручную
          // В этом случае просто удаляем все связанные движения
          const relatedMovementIds = relatedMovements
            .filter(m => m.id !== movementId)
            .map(m => m.id);
          
          if (relatedMovementIds.length > 0) {
            await tx.delete(schema.stockMovements)
              .where(inArray(schema.stockMovements.id, relatedMovementIds));
          }
        }
      }
    }

    // Удаляем запись движения
    await tx.delete(schema.stockMovements)
      .where(eq(schema.stockMovements.id, movementId));

    // Логируем отмену в audit_log
    await tx.insert(schema.auditLog).values({
      tableName: 'stock_movements',
      recordId: movementId,
      operation: 'DELETE',
      oldValues: movement as any,
      newValues: { cancelled: true, cancelledBy: userId, cancelledAt: new Date() },
      userId,
      createdAt: new Date()
    });

    return {
      success: true,
      message: 'Движение успешно отменено',
      productId,
      newStock: newCurrentStock,
      newReservedStock: newReservedStock
    };
  });
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