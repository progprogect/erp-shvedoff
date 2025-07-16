import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { performStockOperation } from '../utils/stockManager';

const router = express.Router();

// GET /api/cutting - Get cutting operations list
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let whereConditions = [];

    if (status) {
      whereConditions.push(eq(schema.cuttingOperations.status, status as any));
    }

    const operations = await db.query.cuttingOperations.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        sourceProduct: {
          with: {
            category: true,
            stock: true
          }
        },
        targetProduct: {
          with: {
            category: true,
            stock: true
          }
        },
        operator: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        assignedToUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: [
        desc(schema.cuttingOperations.createdAt)
      ],
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json({
      success: true,
      data: operations
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/cutting - Create new cutting operation request
router.post('/', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const { 
      sourceProductId, 
      targetProductId, 
      sourceQuantity, 
      targetQuantity, 
      plannedDate,
      notes,
      assignedTo
    } = req.body;
    const userId = req.user!.id;

    // Validation
    if (!sourceProductId || !targetProductId || !sourceQuantity || !targetQuantity) {
      return next(createError('Требуются: исходный товар, целевой товар, количества', 400));
    }

    if (sourceQuantity <= 0 || targetQuantity <= 0) {
      return next(createError('Количества должны быть положительными', 400));
    }

    if (sourceProductId === targetProductId) {
      return next(createError('Исходный и целевой товар не могут быть одинаковыми', 400));
    }

    // Check if source product has enough stock
    const sourceProduct = await db.query.products.findFirst({
      where: eq(schema.products.id, sourceProductId),
      with: { stock: true }
    });

    const targetProduct = await db.query.products.findFirst({
      where: eq(schema.products.id, targetProductId)
    });

    if (!sourceProduct || !targetProduct) {
      return next(createError('Товары не найдены', 404));
    }

    const availableStock = sourceProduct.stock ? 
      sourceProduct.stock.currentStock - sourceProduct.stock.reservedStock : 0;

    if (availableStock < sourceQuantity) {
      return next(createError(
        `Недостаточно товара "${sourceProduct.name}". Доступно: ${availableStock}, требуется: ${sourceQuantity}`, 
        400
      ));
    }

    // Calculate waste quantity (difference between used and produced)
    const wasteQuantity = sourceQuantity - targetQuantity;

    // Create cutting operation in transaction
    const result = await db.transaction(async (tx) => {
      // Create operation сразу в статусе "in_progress", минуя этап утверждения
      const [newOperation] = await tx.insert(schema.cuttingOperations).values({
        sourceProductId: Number(sourceProductId),
        targetProductId: Number(targetProductId),
        sourceQuantity: Number(sourceQuantity),
        targetQuantity: Number(targetQuantity),
        wasteQuantity: Math.max(0, wasteQuantity),
        status: 'in_progress', // Сразу в процессе, без утверждения
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        assignedTo: assignedTo || userId, // По умолчанию назначаем на создателя
        operatorId: userId // Устанавливаем оператора
      }).returning();

      // Сразу резервируем товар
      await performStockOperation({
        productId: Number(sourceProductId),
        type: 'reservation',
        quantity: Number(sourceQuantity),
        userId,
        comment: `Резерв для операции резки #${newOperation.id}: ${sourceProduct.name} → ${targetProduct.name}`
      });

      // Log creation in audit
      await tx.insert(schema.auditLog).values({
        tableName: 'cutting_operations',
        recordId: newOperation.id,
        operation: 'INSERT',
        newValues: newOperation,
        userId
      });

      return newOperation;
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `Операция резки создана и запущена. ${wasteQuantity > 0 ? `Ожидаемый брак: ${wasteQuantity} шт.` : ''}`
    });
  } catch (error) {
    next(error);
  }
});

// DEPRECATED: Больше не используется, операции создаются сразу в статусе "in_progress"
/*
// PUT /api/cutting/:id/approve - Approve cutting operation (Director only)
router.put('/:id/approve', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const userId = req.user!.id;

    const operation = await db.query.cuttingOperations.findFirst({
      where: eq(schema.cuttingOperations.id, operationId),
      with: {
        sourceProduct: {
          with: { stock: true }
        },
        targetProduct: true
      }
    });

    if (!operation) {
      return next(createError('Операция резки не найдена', 404));
    }

    if (operation.status !== 'planned') {
      return next(createError('Можно утвердить только запланированные операции', 400));
    }

    // Check stock availability again
    const availableStock = operation.sourceProduct.stock ? 
      operation.sourceProduct.stock.currentStock - operation.sourceProduct.stock.reservedStock : 0;

    if (availableStock < operation.sourceQuantity) {
      return next(createError(
        `Недостаточно товара для утверждения. Доступно: ${availableStock}, требуется: ${operation.sourceQuantity}`, 
        400
      ));
    }

    // Approve operation and reserve stock in transaction
    const result = await db.transaction(async (tx) => {
      // Update operation status
      const [updatedOperation] = await tx.update(schema.cuttingOperations)
        .set({
          status: 'approved'
        })
        .where(eq(schema.cuttingOperations.id, operationId))
        .returning();

      // Reserve source stock
      await performStockOperation({
        productId: operation.sourceProductId,
        type: 'reservation',
        quantity: operation.sourceQuantity,
        userId,
        comment: `Резерв для операции резки #${operationId}: ${operation.sourceProduct.name} → ${operation.targetProduct.name}`
      });

      // Log approval
      await tx.insert(schema.auditLog).values({
        tableName: 'cutting_operations',
        recordId: operationId,
        operation: 'UPDATE',
        oldValues: { status: 'planned' },
        newValues: { status: 'approved' },
        userId
      });

      return updatedOperation;
    });

    res.json({
      success: true,
      data: result,
      message: 'Операция резки утверждена и товар зарезервирован'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/cutting/:id/start - Start cutting operation
router.put('/:id/start', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const userId = req.user!.id;

    const operation = await db.query.cuttingOperations.findFirst({
      where: eq(schema.cuttingOperations.id, operationId)
    });

    if (!operation) {
      return next(createError('Операция резки не найдена', 404));
    }

    if (operation.status !== 'approved') {
      return next(createError('Можно запустить только утвержденные операции', 400));
    }

    const result = await db.transaction(async (tx) => {
      // Update operation status
      const [updatedOperation] = await tx.update(schema.cuttingOperations)
        .set({
          status: 'in_progress',
          operatorId: userId
        })
        .where(eq(schema.cuttingOperations.id, operationId))
        .returning();

      // Log start
      await tx.insert(schema.auditLog).values({
        tableName: 'cutting_operations',
        recordId: operationId,
        operation: 'UPDATE',
        oldValues: { status: 'approved', operatorId: null },
        newValues: { status: 'in_progress', operatorId: userId },
        userId
      });

      return updatedOperation;
    });

    res.json({
      success: true,
      data: result,
      message: 'Операция резки запущена'
    });
  } catch (error) {
    next(error);
  }
});
*/

// PUT /api/cutting/:id/complete - Complete cutting operation with results
router.put('/:id/complete', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const { actualTargetQuantity, actualDefectQuantity, notes } = req.body;
    const userId = req.user!.id;

    if (actualTargetQuantity === undefined || actualTargetQuantity < 0) {
      return next(createError('Укажите фактическое количество готовой продукции', 400));
    }

    const operation = await db.query.cuttingOperations.findFirst({
      where: eq(schema.cuttingOperations.id, operationId),
      with: {
        sourceProduct: true,
        targetProduct: true
      }
    });

    if (!operation) {
      return next(createError('Операция резки не найдена', 404));
    }

    if (operation.status !== 'in_progress') {
      return next(createError('Можно завершить только операции в процессе выполнения', 400));
    }

    // Calculate actual defect (брак)
    const actualDefect = actualDefectQuantity !== undefined ? 
      Number(actualDefectQuantity) : 
      Math.max(0, operation.sourceQuantity - Number(actualTargetQuantity));

    // Complete operation and update stock in transaction
    const result = await db.transaction(async (tx) => {
      // Update operation
      const [updatedOperation] = await tx.update(schema.cuttingOperations)
        .set({
          status: 'completed',
          targetQuantity: Number(actualTargetQuantity), // Update with actual quantity
          wasteQuantity: Math.max(0, actualDefect), // Используем старое поле для совместимости, но теперь это "брак"
          completedAt: new Date()
        })
        .where(eq(schema.cuttingOperations.id, operationId))
        .returning();

      // Release reservation and reduce source stock
      await performStockOperation({
        productId: operation.sourceProductId,
        type: 'release',
        quantity: operation.sourceQuantity,
        userId,
        comment: `Снятие резерва при завершении резки #${operationId}`
      });

      // Reduce source stock (cutting out)
      await performStockOperation({
        productId: operation.sourceProductId,
        type: 'outgoing',
        quantity: operation.sourceQuantity,
        userId,
        comment: `Списание при резке #${operationId}: ${operation.sourceProduct.name} → ${operation.targetProduct.name}`
      });

      // Add target product to stock (cutting in)
      if (actualTargetQuantity > 0) {
        await performStockOperation({
          productId: operation.targetProductId,
          type: 'incoming',
          quantity: Number(actualTargetQuantity),
          userId,
          comment: `Поступление от резки #${operationId}: ${operation.sourceProduct.name} → ${operation.targetProduct.name}`
        });
      }

      // Log completion
      await tx.insert(schema.auditLog).values({
        tableName: 'cutting_operations',
        recordId: operationId,
        operation: 'UPDATE',
        oldValues: { 
          status: 'in_progress', 
          targetQuantity: operation.targetQuantity,
          wasteQuantity: operation.wasteQuantity,
          completedAt: null 
        },
        newValues: { 
          status: 'completed',
          targetQuantity: actualTargetQuantity,
          wasteQuantity: actualDefect,
          completedAt: new Date()
        },
        userId
      });

      // Log stock movements
      await tx.insert(schema.stockMovements).values([
        {
          productId: operation.sourceProductId,
          movementType: 'cutting_out',
          quantity: -operation.sourceQuantity,
          referenceId: operationId,
          referenceType: 'cutting',
          comment: `Резка: ${operation.sourceProduct.name} → ${operation.targetProduct.name}`,
          userId
        },
        {
          productId: operation.targetProductId,
          movementType: 'cutting_in',
          quantity: Number(actualTargetQuantity),
          referenceId: operationId,
          referenceType: 'cutting',
          comment: `Резка: ${operation.sourceProduct.name} → ${operation.targetProduct.name}`,
          userId
        }
      ]);

      return updatedOperation;
    });

    const defectMessage = actualDefect > 0 ? ` Брак: ${actualDefect} шт.` : '';
    
    res.json({
      success: true,
      data: result,
      message: `Операция резки завершена. Получено: ${actualTargetQuantity} шт.${defectMessage}`
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/cutting/:id/status - Change operation status
router.put('/:id/status', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const { status } = req.body;
    const userId = req.user!.id;

    if (!status) {
      return next(createError('Статус обязателен', 400));
    }

    // Валидные статусы для операций резки (убираем planned и approved)
    const validStatuses = ['in_progress', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return next(createError(`Недопустимый статус: ${status}. Допустимые: ${validStatuses.join(', ')}`, 400));
    }

    const operation = await db.query.cuttingOperations.findFirst({
      where: eq(schema.cuttingOperations.id, operationId),
      with: {
        sourceProduct: true,
        targetProduct: true
      }
    });

    if (!operation) {
      return next(createError('Операция резки не найдена', 404));
    }

    const currentStatus = operation.status || 'in_progress';

    // Нельзя изменить статус завершенной операции
    if (currentStatus === 'completed') {
      return next(createError('Нельзя изменить статус завершенной операции', 400));
    }

    // Простые переходы статусов
    const validTransitions: Record<string, string[]> = {
      'in_progress': ['paused', 'completed', 'cancelled'],
      'paused': ['in_progress', 'cancelled'],
      'cancelled': ['in_progress'] // Можно возобновить отмененную операцию
    };

    if (!validTransitions[currentStatus]?.includes(status)) {
      return next(createError(`Невозможно изменить статус с '${currentStatus}' на '${status}'`, 400));
    }

    const result = await db.transaction(async (tx) => {
      // Обновляем статус
      const [updatedOperation] = await tx.update(schema.cuttingOperations)
        .set({
          status,
          operatorId: status === 'in_progress' ? userId : operation.operatorId
        })
        .where(eq(schema.cuttingOperations.id, operationId))
        .returning();

      // Управляем резервированием в зависимости от статуса
      if (status === 'cancelled' && currentStatus === 'in_progress') {
        // Снимаем резерв при отмене
        await performStockOperation({
          productId: operation.sourceProductId,
          type: 'release',
          quantity: operation.sourceQuantity,
          userId,
          comment: `Снятие резерва при отмене операции резки #${operationId}`
        });
      } else if (status === 'in_progress' && currentStatus === 'cancelled') {
        // Возобновляем резерв при возобновлении операции
        await performStockOperation({
          productId: operation.sourceProductId,
          type: 'reservation',
          quantity: operation.sourceQuantity,
          userId,
          comment: `Восстановление резерва при возобновлении операции резки #${operationId}`
        });
      }

      // Log status change
      await tx.insert(schema.auditLog).values({
        tableName: 'cutting_operations',
        recordId: operationId,
        operation: 'UPDATE',
        oldValues: { status: currentStatus },
        newValues: { status },
        userId
      });

      return updatedOperation;
    });

    const statusMessages: Record<string, string> = {
      'in_progress': 'Операция возобновлена',
      'paused': 'Операция поставлена на паузу',
      'completed': 'Операция завершена',
      'cancelled': 'Операция отменена'
    };

    res.json({
      success: true,
      data: result,
      message: statusMessages[status] || 'Статус операции изменен'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/cutting/:id - Cancel cutting operation
router.delete('/:id', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const userId = req.user!.id;

    const operation = await db.query.cuttingOperations.findFirst({
      where: eq(schema.cuttingOperations.id, operationId)
    });

    if (!operation) {
      return next(createError('Операция резки не найдена', 404));
    }

    if (operation.status === 'completed') {
      return next(createError('Нельзя отменить завершенную операцию', 400));
    }

    if (operation.status === 'cancelled') {
      return next(createError('Операция уже отменена', 400));
    }

    // Cancel operation and release reservations in transaction
    const result = await db.transaction(async (tx) => {
      // Update operation status
      const [updatedOperation] = await tx.update(schema.cuttingOperations)
        .set({
          status: 'cancelled'
        })
        .where(eq(schema.cuttingOperations.id, operationId))
        .returning();

      // Release reservation if operation was approved
      if (operation.status === 'approved' || operation.status === 'in_progress') {
        await performStockOperation({
          productId: operation.sourceProductId,
          type: 'release',
          quantity: operation.sourceQuantity,
          userId,
          comment: `Снятие резерва при отмене операции резки #${operationId}`
        });
      }

      // Log cancellation
      await tx.insert(schema.auditLog).values({
        tableName: 'cutting_operations',
        recordId: operationId,
        operation: 'UPDATE',
        oldValues: { status: operation.status },
        newValues: { status: 'cancelled' },
        userId
      });

      return updatedOperation;
    });

    res.json({
      success: true,
      data: result,
      message: 'Операция резки отменена'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/cutting/:id - Get cutting operation details
router.get('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);

    const operation = await db.query.cuttingOperations.findFirst({
      where: eq(schema.cuttingOperations.id, operationId),
      with: {
        sourceProduct: {
          with: {
            category: true,
            stock: true
          }
        },
        targetProduct: {
          with: {
            category: true,
            stock: true
          }
        },
        operator: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        }
      }
    });

    if (!operation) {
      return next(createError('Операция резки не найдена', 404));
    }

    // Get related stock movements
    const movements = await db.query.stockMovements.findMany({
      where: and(
        eq(schema.stockMovements.referenceId, operationId),
        eq(schema.stockMovements.referenceType, 'cutting')
      ),
      with: {
        product: true,
        user: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: desc(schema.stockMovements.createdAt)
    });

    res.json({
      success: true,
      data: {
        ...operation,
        movements
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/cutting/:id - Update cutting operation details (only before approval)
router.put('/:id', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const { 
      sourceProductId, 
      targetProductId, 
      sourceQuantity, 
      targetQuantity, 
      plannedDate,
      notes,
      assignedTo
    } = req.body;
    const userId = req.user!.id;

    if (!operationId || isNaN(operationId)) {
      return next(createError('Некорректный ID операции', 400));
    }

    // Проверяем существование операции
    const operation = await db.query.cuttingOperations.findFirst({
      where: eq(schema.cuttingOperations.id, operationId),
      with: {
        sourceProduct: true,
        targetProduct: true
      }
    });

    if (!operation) {
      return next(createError('Операция резки не найдена', 404));
    }

    // Можно редактировать только запланированные операции
    if (operation.status !== 'planned') {
      return next(createError('Можно редактировать только запланированные операции', 400));
    }

    // Подготавливаем данные для обновления
    const updateData: any = {};

    if (sourceProductId !== undefined) {
      if (sourceProductId === targetProductId) {
        return next(createError('Исходный и целевой товар не могут быть одинаковыми', 400));
      }
      
      // Проверяем существование товара
      const sourceProduct = await db.query.products.findFirst({
        where: eq(schema.products.id, sourceProductId),
        with: { stock: true }
      });

      if (!sourceProduct) {
        return next(createError('Исходный товар не найден', 404));
      }

      updateData.sourceProductId = Number(sourceProductId);
    }

    if (targetProductId !== undefined) {
      if (sourceProductId === targetProductId) {
        return next(createError('Исходный и целевой товар не могут быть одинаковыми', 400));
      }
      
      // Проверяем существование товара
      const targetProduct = await db.query.products.findFirst({
        where: eq(schema.products.id, targetProductId)
      });

      if (!targetProduct) {
        return next(createError('Целевой товар не найден', 404));
      }

      updateData.targetProductId = Number(targetProductId);
    }

    if (sourceQuantity !== undefined) {
      if (sourceQuantity <= 0) {
        return next(createError('Количество исходного товара должно быть положительным', 400));
      }
      updateData.sourceQuantity = Number(sourceQuantity);
    }

    if (targetQuantity !== undefined) {
      if (targetQuantity <= 0) {
        return next(createError('Количество целевого товара должно быть положительным', 400));
      }
      updateData.targetQuantity = Number(targetQuantity);
    }

    if (plannedDate !== undefined) {
      updateData.plannedDate = plannedDate ? new Date(plannedDate) : null;
    }

    if (assignedTo !== undefined) {
      if (assignedTo) {
        // Проверяем существование пользователя
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, assignedTo)
        });
        if (!user) {
          return next(createError('Пользователь не найден', 404));
        }
      }
      updateData.assignedTo = assignedTo || null;
    }

    // Пересчитываем отходы если изменились количества
    if (updateData.sourceQuantity !== undefined || updateData.targetQuantity !== undefined) {
      const newSourceQuantity = updateData.sourceQuantity || operation.sourceQuantity;
      const newTargetQuantity = updateData.targetQuantity || operation.targetQuantity;
      updateData.wasteQuantity = Math.max(0, newSourceQuantity - newTargetQuantity);
    }

    // Проверяем наличие товара на складе если изменился исходный товар или количество
    if (updateData.sourceProductId !== undefined || updateData.sourceQuantity !== undefined) {
      const productId = updateData.sourceProductId || operation.sourceProductId;
      const quantity = updateData.sourceQuantity || operation.sourceQuantity;
      
      const product = await db.query.products.findFirst({
        where: eq(schema.products.id, productId),
        with: { stock: true }
      });

      if (product && product.stock) {
        const availableStock = product.stock.currentStock - product.stock.reservedStock;
        if (availableStock < quantity) {
          return next(createError(
            `Недостаточно товара "${product.name}". Доступно: ${availableStock}, требуется: ${quantity}`, 
            400
          ));
        }
      }
    }

    // Обновляем операцию в транзакции
    const result = await db.transaction(async (tx) => {
      // Обновляем операцию
      const [updatedOperation] = await tx.update(schema.cuttingOperations)
        .set(updateData)
        .where(eq(schema.cuttingOperations.id, operationId))
        .returning();

      // Логируем изменение
      await tx.insert(schema.auditLog).values({
        tableName: 'cutting_operations',
        recordId: operationId,
        operation: 'UPDATE',
        oldValues: operation,
        newValues: updatedOperation,
        userId
      });

      return updatedOperation;
    });

    res.json({
      success: true,
      data: result,
      message: 'Операция резки обновлена'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 