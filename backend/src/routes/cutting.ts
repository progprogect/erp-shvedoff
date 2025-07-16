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
      // Create operation
      const [newOperation] = await tx.insert(schema.cuttingOperations).values({
        sourceProductId: Number(sourceProductId),
        targetProductId: Number(targetProductId),
        sourceQuantity: Number(sourceQuantity),
        targetQuantity: Number(targetQuantity),
        wasteQuantity: Math.max(0, wasteQuantity),
        status: 'planned',
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        assignedTo: assignedTo || userId // По умолчанию назначаем на создателя
      }).returning();

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
      message: `Заявка на резку создана. ${wasteQuantity > 0 ? `Ожидаемые отходы: ${wasteQuantity} шт.` : ''}`
    });
  } catch (error) {
    next(error);
  }
});

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

// PUT /api/cutting/:id/complete - Complete cutting operation with results
router.put('/:id/complete', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const { actualTargetQuantity, actualWasteQuantity, notes } = req.body;
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

    // Calculate actual waste
    const actualWaste = actualWasteQuantity !== undefined ? 
      Number(actualWasteQuantity) : 
      operation.sourceQuantity - Number(actualTargetQuantity);

    // Complete operation and update stock in transaction
    const result = await db.transaction(async (tx) => {
      // Update operation
      const [updatedOperation] = await tx.update(schema.cuttingOperations)
        .set({
          status: 'completed',
          targetQuantity: Number(actualTargetQuantity), // Update with actual quantity
          wasteQuantity: Math.max(0, actualWaste),
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
          wasteQuantity: actualWaste,
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

    const wasteMessage = actualWaste > 0 ? ` Отходы: ${actualWaste} шт.` : '';
    
    res.json({
      success: true,
      data: result,
      message: `Операция резки завершена. Получено: ${actualTargetQuantity} шт.${wasteMessage}`
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

export default router; 