import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql, desc, asc, inArray, isNull } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { requireExportPermission, requirePermission } from '../middleware/permissions';
import { createError } from '../middleware/errorHandler';
import { performStockOperation } from '../utils/stockManager';
import { ExcelExporter } from '../utils/excelExporter';

const router = express.Router();

// GET /api/cutting - Get cutting operations list
router.get('/', authenticateToken, requirePermission('cutting', 'view'), async (req: AuthRequest, res, next) => {
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

    // Получаем прогресс для каждой операции
    const operationsWithProgress = await Promise.all(
      operations.map(async (operation) => {
        const progress = await db
          .select({
            totalProduct: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.productQuantity}), 0)`,
            totalSecondGrade: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.secondGradeQuantity}), 0)`,
            totalLibertyGrade: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.libertyGradeQuantity}), 0)`,
            totalWaste: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.wasteQuantity}), 0)`,
            lastUpdated: sql<Date>`MAX(${schema.cuttingProgressLog.enteredAt})`
          })
          .from(schema.cuttingProgressLog)
          .where(eq(schema.cuttingProgressLog.operationId, operation.id));

        return {
          ...operation,
          progress: progress[0]
        };
      })
    );

    res.json({
      success: true,
      data: operationsWithProgress
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/cutting - Create new cutting operation request
router.post('/', authenticateToken, requirePermission('cutting', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const { 
      sourceProductId, 
      targetProductId, 
      sourceQuantity, 
      targetQuantity, 
      plannedDate, // Оставляем для обратной совместимости
      plannedStartDate, // Новая дата начала
      plannedEndDate, // Новая дата окончания
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

    // Валидация диапазона дат
    if (plannedStartDate && plannedEndDate) {
      const startDate = new Date(plannedStartDate);
      const endDate = new Date(plannedEndDate);
      
      if (startDate > endDate) {
        return next(createError('Дата начала не может быть позже даты окончания', 400));
      }
      
      // Проверка на разумный диапазон (не более 30 дней)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30) {
        return next(createError('Диапазон дат не может превышать 30 дней', 400));
      }
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
        plannedDate: plannedDate ? new Date(plannedDate) : null, // Обратная совместимость
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null, // Новая дата начала
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null, // Новая дата окончания
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
router.put('/:id/approve', authenticateToken, requirePermission('cutting', 'manage'), async (req: AuthRequest, res, next) => {
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
router.put('/:id/start', authenticateToken, requirePermission('cutting', 'manage'), async (req: AuthRequest, res, next) => {
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
router.put('/:id/complete', authenticateToken, requirePermission('cutting', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const { actualTargetQuantity, actualSecondGradeQuantity, actualLibertyGradeQuantity, actualDefectQuantity, notes } = req.body;
    const userId = req.user!.id;

    if (actualTargetQuantity === undefined || actualTargetQuantity < 0) {
      return next(createError('Укажите фактическое количество готовой продукции', 400));
    }

    const operation = await db.query.cuttingOperations.findFirst({
      where: eq(schema.cuttingOperations.id, operationId),
      with: {
        sourceProduct: true,
        targetProduct: {
          with: {
            logo: true,
            material: true,
            bottomType: true,
            puzzleType: true
          }
        }
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
          actualSecondGradeQuantity: Number(actualSecondGradeQuantity) || 0, // Сохраняем количество товара 2-го сорта
          actualLibertyGradeQuantity: Number(actualLibertyGradeQuantity) || 0, // Сохраняем количество товара сорта Либерти
          completedAt: new Date()
        })
        .where(eq(schema.cuttingOperations.id, operationId))
        .returning();

      // Обновляем остатки напрямую (движения будут созданы в массиве stockMovements ниже)
      
      // 1. Снимаем резерв и списываем исходный товар
      await tx.update(schema.stock)
        .set({
          currentStock: sql`current_stock - ${operation.sourceQuantity}`,
          reservedStock: sql`reserved_stock - ${operation.sourceQuantity}`,
          updatedAt: new Date()
        })
        .where(eq(schema.stock.productId, operation.sourceProductId));

      // 2. Добавляем целевой товар на склад
      if (actualTargetQuantity > 0) {
        await tx.update(schema.stock)
          .set({
            currentStock: sql`current_stock + ${Number(actualTargetQuantity)}`,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, operation.targetProductId));
      }

      // 4. Обрабатываем товар 2-го сорта (если указан)
      let secondGradeProductId = null;
      console.log('🔍 Debug: actualSecondGradeQuantity =', actualSecondGradeQuantity);
      if (actualSecondGradeQuantity && actualSecondGradeQuantity > 0) {
        // Ищем товар 2-го сорта с теми же параметрами
        const secondGradeProduct = await tx.query.products.findFirst({
          where: and(
            // Основные параметры
            operation.targetProduct.categoryId ? eq(schema.products.categoryId, operation.targetProduct.categoryId) : undefined,
            eq(schema.products.name, operation.targetProduct.name),
            eq(schema.products.productType, operation.targetProduct.productType),
            eq(schema.products.grade, 'grade_2'),
            eq(schema.products.isActive, true),
            
            // Размеры (для ковров и рулонных покрытий)
            operation.targetProduct.dimensions ? eq(schema.products.dimensions, operation.targetProduct.dimensions) : undefined,
            
            // Поверхности (массив ID поверхностей)
            operation.targetProduct.surfaceIds ? eq(schema.products.surfaceIds, operation.targetProduct.surfaceIds) : undefined,
            
            // Логотип
            operation.targetProduct.logoId ? eq(schema.products.logoId, operation.targetProduct.logoId) : 
            (!operation.targetProduct.logoId ? isNull(schema.products.logoId) : undefined),
            
            // Материал
            operation.targetProduct.materialId ? eq(schema.products.materialId, operation.targetProduct.materialId) : 
            (!operation.targetProduct.materialId ? isNull(schema.products.materialId) : undefined),
            
            // Низ ковра
            operation.targetProduct.bottomTypeId ? eq(schema.products.bottomTypeId, operation.targetProduct.bottomTypeId) : 
            (!operation.targetProduct.bottomTypeId ? isNull(schema.products.bottomTypeId) : undefined),
            
            // Паззл
            operation.targetProduct.puzzleTypeId ? eq(schema.products.puzzleTypeId, operation.targetProduct.puzzleTypeId) : 
            (!operation.targetProduct.puzzleTypeId ? isNull(schema.products.puzzleTypeId) : undefined),
            
            operation.targetProduct.puzzleSides ? eq(schema.products.puzzleSides, operation.targetProduct.puzzleSides) : undefined,
            
            // Пресс
            operation.targetProduct.pressType ? eq(schema.products.pressType, operation.targetProduct.pressType) : 
            (!operation.targetProduct.pressType ? isNull(schema.products.pressType) : undefined),
            
            // Края ковра
            operation.targetProduct.carpetEdgeType ? eq(schema.products.carpetEdgeType, operation.targetProduct.carpetEdgeType) : 
            (!operation.targetProduct.carpetEdgeType ? isNull(schema.products.carpetEdgeType) : undefined),
            
            operation.targetProduct.carpetEdgeSides ? eq(schema.products.carpetEdgeSides, operation.targetProduct.carpetEdgeSides) : undefined,
            
            operation.targetProduct.carpetEdgeStrength ? eq(schema.products.carpetEdgeStrength, operation.targetProduct.carpetEdgeStrength) : 
            (!operation.targetProduct.carpetEdgeStrength ? isNull(schema.products.carpetEdgeStrength) : undefined),
            
            // Площадь мата (для рулонных покрытий)
            operation.targetProduct.matArea ? eq(schema.products.matArea, operation.targetProduct.matArea) : 
            (!operation.targetProduct.matArea ? isNull(schema.products.matArea) : undefined),
            
            // Вес
            operation.targetProduct.weight ? eq(schema.products.weight, operation.targetProduct.weight) : 
            (!operation.targetProduct.weight ? isNull(schema.products.weight) : undefined),
            
            // Борт
            operation.targetProduct.borderType ? eq(schema.products.borderType, operation.targetProduct.borderType) : 
            (!operation.targetProduct.borderType ? isNull(schema.products.borderType) : undefined)
          )
        });

        if (secondGradeProduct) {
          // Товар 2-го сорта уже существует
          secondGradeProductId = secondGradeProduct.id;
        } else {
          // Создаем новый товар 2-го сорта
          // Получаем связанные данные для генерации артикула
          const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
            operation.targetProduct.surfaceIds && operation.targetProduct.surfaceIds.length > 0 
              ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, operation.targetProduct.surfaceIds) })
              : [],
            operation.targetProduct.logoId 
              ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, operation.targetProduct.logoId) })
              : null,
            operation.targetProduct.materialId 
              ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, operation.targetProduct.materialId) })
              : null,
            operation.targetProduct.bottomTypeId 
              ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, operation.targetProduct.bottomTypeId) })
              : null,
            operation.targetProduct.puzzleTypeId 
              ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, operation.targetProduct.puzzleTypeId) })
              : null
          ]);

          // Генерируем артикул для товара 2-го сорта
          const { generateArticle } = await import('../utils/articleGenerator');
          const secondGradeProductData = {
            name: operation.targetProduct.name,
            dimensions: operation.targetProduct.dimensions as { length?: number; width?: number; thickness?: number },
            surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
            logo: logo ? { name: logo.name } : undefined,
            material: material ? { name: material.name } : undefined,
            bottomType: bottomType ? { code: bottomType.code } : undefined,
            puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
            carpetEdgeType: operation.targetProduct.carpetEdgeType || undefined,
            carpetEdgeSides: operation.targetProduct.carpetEdgeSides || undefined,
            carpetEdgeStrength: operation.targetProduct.carpetEdgeStrength || undefined,
            pressType: operation.targetProduct.pressType || undefined,
            borderType: operation.targetProduct.borderType || undefined,
            grade: 'grade_2' as const
          };
          
          const secondGradeArticle = generateArticle(secondGradeProductData);
          
          const newSecondGradeProduct = await tx.insert(schema.products).values({
            name: operation.targetProduct.name,
            article: secondGradeArticle,
            categoryId: operation.targetProduct.categoryId,
            productType: operation.targetProduct.productType,
            dimensions: operation.targetProduct.dimensions,
            surfaceIds: operation.targetProduct.surfaceIds,
            logoId: operation.targetProduct.logoId,
            materialId: operation.targetProduct.materialId,
            bottomTypeId: operation.targetProduct.bottomTypeId,
            puzzleTypeId: operation.targetProduct.puzzleTypeId,
            puzzleSides: operation.targetProduct.puzzleSides,
            pressType: operation.targetProduct.pressType,
            carpetEdgeType: operation.targetProduct.carpetEdgeType,
            carpetEdgeSides: operation.targetProduct.carpetEdgeSides,
            carpetEdgeStrength: operation.targetProduct.carpetEdgeStrength,
            matArea: operation.targetProduct.matArea,
            weight: operation.targetProduct.weight,
            grade: 'grade_2',
            borderType: operation.targetProduct.borderType,
            tags: operation.targetProduct.tags,
            price: operation.targetProduct.price,
            normStock: 0,
            isActive: true,
            notes: `Автоматически создан при завершении операции резки #${operationId}`
          }).returning();

          secondGradeProductId = newSecondGradeProduct[0].id;

          // Создаем запись остатков для нового товара
          await tx.insert(schema.stock).values({
            productId: secondGradeProductId,
            currentStock: 0,
            reservedStock: 0,
            updatedAt: new Date()
          });
        }

        // Добавляем товар 2-го сорта на склад (движение будет создано в массиве stockMovements ниже)
        await tx.update(schema.stock)
          .set({
            currentStock: sql`current_stock + ${Number(actualSecondGradeQuantity)}`,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, secondGradeProductId));
      }

      // 5. Обрабатываем товар сорта Либерти (если указан)
      let libertyGradeProductId = null;
      console.log('🔍 Debug: actualLibertyGradeQuantity =', actualLibertyGradeQuantity);
      if (actualLibertyGradeQuantity && actualLibertyGradeQuantity > 0) {
        // Ищем товар сорта Либерти с теми же параметрами
        const libertyGradeProduct = await tx.query.products.findFirst({
          where: and(
            // Основные параметры
            operation.targetProduct.categoryId ? eq(schema.products.categoryId, operation.targetProduct.categoryId) : undefined,
            eq(schema.products.name, operation.targetProduct.name),
            eq(schema.products.productType, operation.targetProduct.productType),
            eq(schema.products.grade, 'liber'),
            eq(schema.products.isActive, true),
            
            // Размеры (для ковров и рулонных покрытий)
            operation.targetProduct.dimensions ? eq(schema.products.dimensions, operation.targetProduct.dimensions) : undefined,
            
            // Поверхности (массив ID поверхностей)
            operation.targetProduct.surfaceIds ? eq(schema.products.surfaceIds, operation.targetProduct.surfaceIds) : undefined,
            
            // Логотип
            operation.targetProduct.logoId ? eq(schema.products.logoId, operation.targetProduct.logoId) : 
            (!operation.targetProduct.logoId ? isNull(schema.products.logoId) : undefined),
            
            // Материал
            operation.targetProduct.materialId ? eq(schema.products.materialId, operation.targetProduct.materialId) : 
            (!operation.targetProduct.materialId ? isNull(schema.products.materialId) : undefined),
            
            // Низ ковра
            operation.targetProduct.bottomTypeId ? eq(schema.products.bottomTypeId, operation.targetProduct.bottomTypeId) : 
            (!operation.targetProduct.bottomTypeId ? isNull(schema.products.bottomTypeId) : undefined),
            
            // Паззл
            operation.targetProduct.puzzleTypeId ? eq(schema.products.puzzleTypeId, operation.targetProduct.puzzleTypeId) : 
            (!operation.targetProduct.puzzleTypeId ? isNull(schema.products.puzzleTypeId) : undefined),
            
            operation.targetProduct.puzzleSides ? eq(schema.products.puzzleSides, operation.targetProduct.puzzleSides) : undefined,
            
            // Пресс
            operation.targetProduct.pressType ? eq(schema.products.pressType, operation.targetProduct.pressType) : 
            (!operation.targetProduct.pressType ? isNull(schema.products.pressType) : undefined),
            
            // Края ковра
            operation.targetProduct.carpetEdgeType ? eq(schema.products.carpetEdgeType, operation.targetProduct.carpetEdgeType) : 
            (!operation.targetProduct.carpetEdgeType ? isNull(schema.products.carpetEdgeType) : undefined),
            
            operation.targetProduct.carpetEdgeSides ? eq(schema.products.carpetEdgeSides, operation.targetProduct.carpetEdgeSides) : undefined,
            
            operation.targetProduct.carpetEdgeStrength ? eq(schema.products.carpetEdgeStrength, operation.targetProduct.carpetEdgeStrength) : 
            (!operation.targetProduct.carpetEdgeStrength ? isNull(schema.products.carpetEdgeStrength) : undefined),
            
            // Площадь мата (для рулонных покрытий)
            operation.targetProduct.matArea ? eq(schema.products.matArea, operation.targetProduct.matArea) : 
            (!operation.targetProduct.matArea ? isNull(schema.products.matArea) : undefined),
            
            // Вес
            operation.targetProduct.weight ? eq(schema.products.weight, operation.targetProduct.weight) : 
            (!operation.targetProduct.weight ? isNull(schema.products.weight) : undefined),
            
            // Борт
            operation.targetProduct.borderType ? eq(schema.products.borderType, operation.targetProduct.borderType) : 
            (!operation.targetProduct.borderType ? isNull(schema.products.borderType) : undefined)
          )
        });

        if (libertyGradeProduct) {
          // Товар сорта Либерти уже существует
          libertyGradeProductId = libertyGradeProduct.id;
        } else {
          // Создаем новый товар сорта Либерти
          // Получаем связанные данные для генерации артикула
          const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
            operation.targetProduct.surfaceIds && operation.targetProduct.surfaceIds.length > 0 
              ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, operation.targetProduct.surfaceIds) })
              : [],
            operation.targetProduct.logoId 
              ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, operation.targetProduct.logoId) })
              : null,
            operation.targetProduct.materialId 
              ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, operation.targetProduct.materialId) })
              : null,
            operation.targetProduct.bottomTypeId 
              ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, operation.targetProduct.bottomTypeId) })
              : null,
            operation.targetProduct.puzzleTypeId 
              ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, operation.targetProduct.puzzleTypeId) })
              : null
          ]);

          // Генерируем артикул для товара сорта Либерти
          const { generateArticle } = await import('../utils/articleGenerator');
          const libertyGradeProductData = {
            name: operation.targetProduct.name,
            dimensions: operation.targetProduct.dimensions as { length?: number; width?: number; thickness?: number },
            surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
            logo: logo ? { name: logo.name } : undefined,
            material: material ? { name: material.name } : undefined,
            bottomType: bottomType ? { code: bottomType.code } : undefined,
            puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
            pressType: operation.targetProduct.pressType || 'not_selected',
            borderType: operation.targetProduct.borderType || 'without_border',
            carpetEdgeType: operation.targetProduct.carpetEdgeType || undefined,
            carpetEdgeSides: operation.targetProduct.carpetEdgeSides || undefined,
            carpetEdgeStrength: operation.targetProduct.carpetEdgeStrength || undefined,
            grade: 'liber' as const
          };

          const libertyGradeArticle = generateArticle(libertyGradeProductData);

          // Создаем товар сорта Либерти
          const [newLibertyGradeProduct] = await tx.insert(schema.products).values({
            name: operation.targetProduct.name,
            article: libertyGradeArticle,
            productType: operation.targetProduct.productType,
            categoryId: operation.targetProduct.categoryId,
            surfaceIds: operation.targetProduct.surfaceIds,
            logoId: operation.targetProduct.logoId,
            materialId: operation.targetProduct.materialId,
            pressType: operation.targetProduct.pressType,
            dimensions: operation.targetProduct.dimensions,
            matArea: operation.targetProduct.matArea,
            weight: operation.targetProduct.weight,
            grade: 'liber',
            borderType: operation.targetProduct.borderType,
            carpetEdgeType: operation.targetProduct.carpetEdgeType,
            carpetEdgeSides: operation.targetProduct.carpetEdgeSides,
            carpetEdgeStrength: operation.targetProduct.carpetEdgeStrength,
            bottomTypeId: operation.targetProduct.bottomTypeId,
            puzzleTypeId: operation.targetProduct.puzzleTypeId,
            puzzleSides: operation.targetProduct.puzzleSides,
            isActive: true,
            notes: `Автоматически создан для сорта Либерти по операции резки #${operationId}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();

          libertyGradeProductId = newLibertyGradeProduct.id;

          // Создаем запись остатков для нового товара
          await tx.insert(schema.stock).values({
            productId: libertyGradeProductId,
            currentStock: 0,
            reservedStock: 0,
            updatedAt: new Date()
          });
        }

        // Добавляем товар сорта Либерти на склад (движение будет создано в массиве stockMovements ниже)
        await tx.update(schema.stock)
          .set({
            currentStock: sql`current_stock + ${Number(actualLibertyGradeQuantity)}`,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, libertyGradeProductId));
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
      const stockMovements: any[] = [
        {
          productId: operation.sourceProductId,
          movementType: 'cutting_out',
          quantity: -operation.sourceQuantity,
          referenceId: operationId,
          referenceType: 'cutting',
          comment: `Списание при резке #${operationId}: ${operation.sourceProduct.name} → ${operation.targetProduct.name}`,
          userId
        }
      ];

      // Добавляем движение для целевого товара
      if (actualTargetQuantity > 0) {
        stockMovements.push({
          productId: operation.targetProductId,
          movementType: 'cutting_in',
          quantity: Number(actualTargetQuantity),
          referenceId: operationId,
          referenceType: 'cutting',
          comment: `Поступление от резки #${operationId}: ${operation.sourceProduct.name} → ${operation.targetProduct.name}`,
          userId
        });
      }

      // Добавляем движение для товара 2-го сорта (если есть)
      if (secondGradeProductId && actualSecondGradeQuantity > 0) {
        stockMovements.push({
          productId: secondGradeProductId,
          movementType: 'cutting_in',
          quantity: Number(actualSecondGradeQuantity),
          referenceId: operationId,
          referenceType: 'cutting',
          comment: `Поступление 2-го сорта от резки #${operationId}: ${operation.sourceProduct.name} → ${operation.targetProduct.name} (2 сорт)`,
          userId
        });
      }

      // Добавляем движение для товара сорта Либерти (если есть)
      if (libertyGradeProductId && actualLibertyGradeQuantity > 0) {
        stockMovements.push({
          productId: libertyGradeProductId,
          movementType: 'cutting_in',
          quantity: Number(actualLibertyGradeQuantity),
          referenceId: operationId,
          referenceType: 'cutting',
          comment: `Поступление сорта Либерти от резки #${operationId}: ${operation.sourceProduct.name} → ${operation.targetProduct.name} (Либерти)`,
          userId
        });
      }

      await tx.insert(schema.stockMovements).values(stockMovements);

      // Пересчитываем статусы заказов после завершения резки
      try {
        const { analyzeOrderAvailability } = await import('../utils/orderStatusCalculator');
        
        // Получаем все активные заказы, которые могут быть затронуты
        const affectedOrders = await tx
          .select({ id: schema.orders.id })
          .from(schema.orders)
          .innerJoin(schema.orderItems, eq(schema.orders.id, schema.orderItems.orderId))
          .where(
            and(
              eq(schema.orderItems.productId, operation.targetProductId),
              inArray(schema.orders.status, ['new', 'confirmed', 'in_production', 'ready'])
            )
          )
          .groupBy(schema.orders.id);

        // Пересчитываем статусы затронутых заказов
        for (const order of affectedOrders) {
          try {
            const orderAnalysis = await analyzeOrderAvailability(order.id);
            await tx.update(schema.orders)
              .set({ 
                status: orderAnalysis.status as any,
                updatedAt: new Date()
              })
              .where(eq(schema.orders.id, order.id));
          } catch (error) {
            console.error(`Ошибка пересчета статуса заказа ${order.id} после резки:`, error);
          }
        }
      } catch (error) {
        console.error('Ошибка пересчета статусов заказов после резки:', error);
      }

      return updatedOperation;
    });

    // Распределяем новый товар между заказами
    try {
      const { distributeNewStockToOrders } = await import('../utils/stockDistribution');
      const distributionResult = await distributeNewStockToOrders(operation.targetProductId, actualTargetQuantity);
      
      if (distributionResult.distributed > 0) {
        console.log(`🎯 Распределено ${distributionResult.distributed} шт товара ${operation.targetProductId} между ${distributionResult.ordersUpdated.length} заказами`);
      }
    } catch (distributionError) {
      console.error('Ошибка распределения товара:', distributionError);
    }

    const defectMessage = actualDefect > 0 ? ` Брак: ${actualDefect} шт.` : '';
    const secondGradeMessage = actualSecondGradeQuantity > 0 ? ` 2 сорт: ${actualSecondGradeQuantity} шт.` : '';
    const libertyGradeMessage = actualLibertyGradeQuantity > 0 ? ` Либерти: ${actualLibertyGradeQuantity} шт.` : '';
    
    res.json({
      success: true,
      data: result,
      message: `Операция резки завершена. Готово: ${actualTargetQuantity} шт.${secondGradeMessage}${libertyGradeMessage}${defectMessage}`
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/cutting/:id/status - Change operation status
router.put('/:id/status', authenticateToken, requirePermission('cutting', 'edit'), async (req: AuthRequest, res, next) => {
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
router.delete('/:id', authenticateToken, requirePermission('cutting', 'delete'), async (req: AuthRequest, res, next) => {
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
router.get('/:id', authenticateToken, requirePermission('cutting', 'view'), async (req: AuthRequest, res, next) => {
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

    // Get progress for this operation
    const progress = await db
      .select({
        totalProduct: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.productQuantity}), 0)`,
        totalSecondGrade: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.secondGradeQuantity}), 0)`,
        totalLibertyGrade: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.libertyGradeQuantity}), 0)`,
        totalWaste: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.wasteQuantity}), 0)`,
        lastUpdated: sql<Date>`MAX(${schema.cuttingProgressLog.enteredAt})`
      })
      .from(schema.cuttingProgressLog)
      .where(eq(schema.cuttingProgressLog.operationId, operationId));

    res.json({
      success: true,
      data: {
        ...operation,
        movements,
        progress: progress[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/cutting/:id/progress - Add progress entry for cutting operation
router.post('/:id/progress', authenticateToken, requirePermission('cutting', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const { productQuantity, secondGradeQuantity, libertyGradeQuantity, wasteQuantity } = req.body;
    const userId = req.user!.id;

    if (operationId && isNaN(operationId)) {
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

    // Можно добавлять прогресс только для незавершенных операций
    if (operation.status === 'completed') {
      return next(createError('Нельзя добавлять прогресс для завершенной операции', 400));
    }

    // Валидация входных данных
    if (productQuantity === undefined && secondGradeQuantity === undefined && libertyGradeQuantity === undefined && wasteQuantity === undefined) {
      return next(createError('Необходимо указать хотя бы одно количество', 400));
    }

    // Проверяем, что все значения являются числами
    const quantities = {
      productQuantity: productQuantity !== undefined ? Number(productQuantity) : 0,
      secondGradeQuantity: secondGradeQuantity !== undefined ? Number(secondGradeQuantity) : 0,
      libertyGradeQuantity: libertyGradeQuantity !== undefined ? Number(libertyGradeQuantity) : 0,
      wasteQuantity: wasteQuantity !== undefined ? Number(wasteQuantity) : 0
    };

    // Проверяем, что все значения являются валидными числами
    if (isNaN(quantities.productQuantity) || isNaN(quantities.secondGradeQuantity) || isNaN(quantities.libertyGradeQuantity) || isNaN(quantities.wasteQuantity)) {
      return next(createError('Все значения должны быть числами', 400));
    }

    // Проверяем, что хотя бы одно значение не равно нулю
    if (quantities.productQuantity === 0 && quantities.secondGradeQuantity === 0 && quantities.libertyGradeQuantity === 0 && quantities.wasteQuantity === 0) {
      return next(createError('Хотя бы одно количество должно быть отличным от нуля', 400));
    }

    // Добавляем прогресс в транзакции
    const result = await db.transaction(async (tx) => {
      // Объявляем переменные для товаров 2-го сорта и Либерти
      let existingSecondGrade: any = null;
      let existingLibertyGrade: any = null;

      // Проверяем и создаем товары 2-го сорта и Либерти если их нет
      if (quantities.secondGradeQuantity !== 0) {
        // Проверяем, существует ли товар 2-го сорта с теми же характеристиками
        existingSecondGrade = await tx.query.products.findFirst({
          where: and(
            // Основные параметры
            operation.targetProduct.categoryId ? eq(schema.products.categoryId, operation.targetProduct.categoryId) : undefined,
            eq(schema.products.name, operation.targetProduct.name),
            eq(schema.products.productType, operation.targetProduct.productType),
            eq(schema.products.grade, 'grade_2'),
            eq(schema.products.isActive, true),
            
            // Размеры (для ковров и рулонных покрытий)
            operation.targetProduct.dimensions ? eq(schema.products.dimensions, operation.targetProduct.dimensions) : undefined,
            
            // Поверхности (массив ID поверхностей)
            operation.targetProduct.surfaceIds ? eq(schema.products.surfaceIds, operation.targetProduct.surfaceIds) : undefined,
            
            // Логотип
            operation.targetProduct.logoId ? eq(schema.products.logoId, operation.targetProduct.logoId) : 
            (!operation.targetProduct.logoId ? isNull(schema.products.logoId) : undefined),
            
            // Материал
            operation.targetProduct.materialId ? eq(schema.products.materialId, operation.targetProduct.materialId) : 
            (!operation.targetProduct.materialId ? isNull(schema.products.materialId) : undefined),
            
            // Низ ковра
            operation.targetProduct.bottomTypeId ? eq(schema.products.bottomTypeId, operation.targetProduct.bottomTypeId) : 
            (!operation.targetProduct.bottomTypeId ? isNull(schema.products.bottomTypeId) : undefined),
            
            // Паззл
            operation.targetProduct.puzzleTypeId ? eq(schema.products.puzzleTypeId, operation.targetProduct.puzzleTypeId) : 
            (!operation.targetProduct.puzzleTypeId ? isNull(schema.products.puzzleTypeId) : undefined),
            
            operation.targetProduct.puzzleSides ? eq(schema.products.puzzleSides, operation.targetProduct.puzzleSides) : undefined,
            
            // Пресс
            operation.targetProduct.pressType ? eq(schema.products.pressType, operation.targetProduct.pressType) : 
            (!operation.targetProduct.pressType ? isNull(schema.products.pressType) : undefined),
            
            // Края ковра
            operation.targetProduct.carpetEdgeType ? eq(schema.products.carpetEdgeType, operation.targetProduct.carpetEdgeType) : 
            (!operation.targetProduct.carpetEdgeType ? isNull(schema.products.carpetEdgeType) : undefined),
            
            operation.targetProduct.carpetEdgeSides ? eq(schema.products.carpetEdgeSides, operation.targetProduct.carpetEdgeSides) : undefined,
            
            operation.targetProduct.carpetEdgeStrength ? eq(schema.products.carpetEdgeStrength, operation.targetProduct.carpetEdgeStrength) : 
            (!operation.targetProduct.carpetEdgeStrength ? isNull(schema.products.carpetEdgeStrength) : undefined),
            
            // Площадь мата (для рулонных покрытий)
            operation.targetProduct.matArea ? eq(schema.products.matArea, operation.targetProduct.matArea) : 
            (!operation.targetProduct.matArea ? isNull(schema.products.matArea) : undefined),
            
            // Вес
            operation.targetProduct.weight ? eq(schema.products.weight, operation.targetProduct.weight) : 
            (!operation.targetProduct.weight ? isNull(schema.products.weight) : undefined),
            
            // Борт
            operation.targetProduct.borderType ? eq(schema.products.borderType, operation.targetProduct.borderType) : 
            (!operation.targetProduct.borderType ? isNull(schema.products.borderType) : undefined)
          )
        });

        if (!existingSecondGrade) {
          // Создаем товар 2-го сорта с полным артикулом
          const { generateArticle } = await import('../utils/articleGenerator');
          
          // Получаем связанные данные для генерации артикула
          const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
            operation.targetProduct.surfaceIds && operation.targetProduct.surfaceIds.length > 0 
              ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, operation.targetProduct.surfaceIds) })
              : [],
            operation.targetProduct.logoId 
              ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, operation.targetProduct.logoId) })
              : null,
            operation.targetProduct.materialId 
              ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, operation.targetProduct.materialId) })
              : null,
            operation.targetProduct.bottomTypeId 
              ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, operation.targetProduct.bottomTypeId) })
              : null,
            operation.targetProduct.puzzleTypeId 
              ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, operation.targetProduct.puzzleTypeId) })
              : null
          ]);

          const secondGradeProductData = {
            name: operation.targetProduct.name,
            dimensions: operation.targetProduct.dimensions as { length?: number; width?: number; thickness?: number },
            surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
            logo: logo ? { name: logo.name } : undefined,
            material: material ? { name: material.name } : undefined,
            bottomType: bottomType ? { code: bottomType.code } : undefined,
            puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
            carpetEdgeType: operation.targetProduct.carpetEdgeType || undefined,
            carpetEdgeSides: operation.targetProduct.carpetEdgeSides || undefined,
            carpetEdgeStrength: operation.targetProduct.carpetEdgeStrength || undefined,
            pressType: operation.targetProduct.pressType || 'not_selected',
            borderType: operation.targetProduct.borderType || 'without_border',
            grade: 'grade_2' as const
          };
          
          const secondGradeArticle = generateArticle(secondGradeProductData);
          
          const [newSecondGradeProduct] = await tx.insert(schema.products).values({
            name: operation.targetProduct.name,
            article: secondGradeArticle,
            categoryId: operation.targetProduct.categoryId,
            productType: operation.targetProduct.productType,
            dimensions: operation.targetProduct.dimensions,
            surfaceIds: operation.targetProduct.surfaceIds,
            logoId: operation.targetProduct.logoId,
            materialId: operation.targetProduct.materialId,
            bottomTypeId: operation.targetProduct.bottomTypeId,
            puzzleTypeId: operation.targetProduct.puzzleTypeId,
            puzzleSides: operation.targetProduct.puzzleSides,
            carpetEdgeType: operation.targetProduct.carpetEdgeType,
            carpetEdgeSides: operation.targetProduct.carpetEdgeSides,
            carpetEdgeStrength: operation.targetProduct.carpetEdgeStrength,
            matArea: operation.targetProduct.matArea,
            weight: operation.targetProduct.weight,
            pressType: operation.targetProduct.pressType,
            borderType: operation.targetProduct.borderType,
            grade: 'grade_2',
            normStock: 0,
            isActive: true,
            notes: `Автоматически создан для 2-го сорта по операции резки #${operationId} (прогресс)`
          }).returning();

          // Создаем запись остатков для нового товара
          await tx.insert(schema.stock).values({
            productId: newSecondGradeProduct.id,
            currentStock: 0,
            reservedStock: 0,
            updatedAt: new Date()
          });
        } else {
          // Проверяем, есть ли запись в stock для существующего товара
          const existingStock = await tx.query.stock.findFirst({
            where: eq(schema.stock.productId, existingSecondGrade.id)
          });

          if (!existingStock) {
            // Создаем запись остатков для существующего товара
            await tx.insert(schema.stock).values({
              productId: existingSecondGrade.id,
              currentStock: 0,
              reservedStock: 0,
              updatedAt: new Date()
            });
          }
        }
      }

      if (quantities.libertyGradeQuantity !== 0) {
        // Проверяем, существует ли товар сорта Либерти с теми же характеристиками
        existingLibertyGrade = await tx.query.products.findFirst({
          where: and(
            // Основные параметры
            operation.targetProduct.categoryId ? eq(schema.products.categoryId, operation.targetProduct.categoryId) : undefined,
            eq(schema.products.name, operation.targetProduct.name),
            eq(schema.products.productType, operation.targetProduct.productType),
            eq(schema.products.grade, 'liber'),
            eq(schema.products.isActive, true),
            
            // Размеры (для ковров и рулонных покрытий)
            operation.targetProduct.dimensions ? eq(schema.products.dimensions, operation.targetProduct.dimensions) : undefined,
            
            // Поверхности (массив ID поверхностей)
            operation.targetProduct.surfaceIds ? eq(schema.products.surfaceIds, operation.targetProduct.surfaceIds) : undefined,
            
            // Логотип
            operation.targetProduct.logoId ? eq(schema.products.logoId, operation.targetProduct.logoId) : 
            (!operation.targetProduct.logoId ? isNull(schema.products.logoId) : undefined),
            
            // Материал
            operation.targetProduct.materialId ? eq(schema.products.materialId, operation.targetProduct.materialId) : 
            (!operation.targetProduct.materialId ? isNull(schema.products.materialId) : undefined),
            
            // Низ ковра
            operation.targetProduct.bottomTypeId ? eq(schema.products.bottomTypeId, operation.targetProduct.bottomTypeId) : 
            (!operation.targetProduct.bottomTypeId ? isNull(schema.products.bottomTypeId) : undefined),
            
            // Паззл
            operation.targetProduct.puzzleTypeId ? eq(schema.products.puzzleTypeId, operation.targetProduct.puzzleTypeId) : 
            (!operation.targetProduct.puzzleTypeId ? isNull(schema.products.puzzleTypeId) : undefined),
            
            operation.targetProduct.puzzleSides ? eq(schema.products.puzzleSides, operation.targetProduct.puzzleSides) : undefined,
            
            // Пресс
            operation.targetProduct.pressType ? eq(schema.products.pressType, operation.targetProduct.pressType) : 
            (!operation.targetProduct.pressType ? isNull(schema.products.pressType) : undefined),
            
            // Края ковра
            operation.targetProduct.carpetEdgeType ? eq(schema.products.carpetEdgeType, operation.targetProduct.carpetEdgeType) : 
            (!operation.targetProduct.carpetEdgeType ? isNull(schema.products.carpetEdgeType) : undefined),
            
            operation.targetProduct.carpetEdgeSides ? eq(schema.products.carpetEdgeSides, operation.targetProduct.carpetEdgeSides) : undefined,
            
            operation.targetProduct.carpetEdgeStrength ? eq(schema.products.carpetEdgeStrength, operation.targetProduct.carpetEdgeStrength) : 
            (!operation.targetProduct.carpetEdgeStrength ? isNull(schema.products.carpetEdgeStrength) : undefined),
            
            // Площадь мата (для рулонных покрытий)
            operation.targetProduct.matArea ? eq(schema.products.matArea, operation.targetProduct.matArea) : 
            (!operation.targetProduct.matArea ? isNull(schema.products.matArea) : undefined),
            
            // Вес
            operation.targetProduct.weight ? eq(schema.products.weight, operation.targetProduct.weight) : 
            (!operation.targetProduct.weight ? isNull(schema.products.weight) : undefined),
            
            // Борт
            operation.targetProduct.borderType ? eq(schema.products.borderType, operation.targetProduct.borderType) : 
            (!operation.targetProduct.borderType ? isNull(schema.products.borderType) : undefined)
          )
        });

        if (!existingLibertyGrade) {
          // Создаем товар сорта Либерти с полным артикулом
          const { generateArticle } = await import('../utils/articleGenerator');
          
          // Получаем связанные данные для генерации артикула
          const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
            operation.targetProduct.surfaceIds && operation.targetProduct.surfaceIds.length > 0 
              ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, operation.targetProduct.surfaceIds) })
              : [],
            operation.targetProduct.logoId 
              ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, operation.targetProduct.logoId) })
              : null,
            operation.targetProduct.materialId 
              ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, operation.targetProduct.materialId) })
              : null,
            operation.targetProduct.bottomTypeId 
              ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, operation.targetProduct.bottomTypeId) })
              : null,
            operation.targetProduct.puzzleTypeId 
              ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, operation.targetProduct.puzzleTypeId) })
              : null
          ]);

          const libertyGradeProductData = {
            name: operation.targetProduct.name,
            dimensions: operation.targetProduct.dimensions as { length?: number; width?: number; thickness?: number },
            surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
            logo: logo ? { name: logo.name } : undefined,
            material: material ? { name: material.name } : undefined,
            bottomType: bottomType ? { code: bottomType.code } : undefined,
            puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
            carpetEdgeType: operation.targetProduct.carpetEdgeType || undefined,
            carpetEdgeSides: operation.targetProduct.carpetEdgeSides || undefined,
            carpetEdgeStrength: operation.targetProduct.carpetEdgeStrength || undefined,
            pressType: operation.targetProduct.pressType || 'not_selected',
            borderType: operation.targetProduct.borderType || 'without_border',
            grade: 'liber' as const
          };
          
          const libertyGradeArticle = generateArticle(libertyGradeProductData);
          
          const [newLibertyGradeProduct] = await tx.insert(schema.products).values({
            name: operation.targetProduct.name,
            article: libertyGradeArticle,
            categoryId: operation.targetProduct.categoryId,
            productType: operation.targetProduct.productType,
            dimensions: operation.targetProduct.dimensions,
            surfaceIds: operation.targetProduct.surfaceIds,
            logoId: operation.targetProduct.logoId,
            materialId: operation.targetProduct.materialId,
            bottomTypeId: operation.targetProduct.bottomTypeId,
            puzzleTypeId: operation.targetProduct.puzzleTypeId,
            puzzleSides: operation.targetProduct.puzzleSides,
            carpetEdgeType: operation.targetProduct.carpetEdgeType,
            carpetEdgeSides: operation.targetProduct.carpetEdgeSides,
            carpetEdgeStrength: operation.targetProduct.carpetEdgeStrength,
            matArea: operation.targetProduct.matArea,
            weight: operation.targetProduct.weight,
            pressType: operation.targetProduct.pressType,
            borderType: operation.targetProduct.borderType,
            grade: 'liber',
            normStock: 0,
            isActive: true,
            notes: `Автоматически создан для сорта Либерти по операции резки #${operationId} (прогресс)`
          }).returning();

          // Создаем запись остатков для нового товара
          await tx.insert(schema.stock).values({
            productId: newLibertyGradeProduct.id,
            currentStock: 0,
            reservedStock: 0,
            updatedAt: new Date()
          });
        } else {
          // Проверяем, есть ли запись в stock для существующего товара
          const existingStock = await tx.query.stock.findFirst({
            where: eq(schema.stock.productId, existingLibertyGrade.id)
          });

          if (!existingStock) {
            // Создаем запись остатков для существующего товара
            await tx.insert(schema.stock).values({
              productId: existingLibertyGrade.id,
              currentStock: 0,
              reservedStock: 0,
              updatedAt: new Date()
            });
          }
        }
      }

      // Обновляем остатки для товара 2-го сорта (если количество не нулевое)
      if (quantities.secondGradeQuantity !== 0 && existingSecondGrade) {
        await tx.update(schema.stock)
          .set({
            currentStock: sql`current_stock + ${quantities.secondGradeQuantity}`,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, existingSecondGrade.id));

        // Логируем движение товара
        await tx.insert(schema.stockMovements).values({
          productId: existingSecondGrade.id,
          movementType: quantities.secondGradeQuantity > 0 ? 'cutting_in' : 'outgoing',
          quantity: Math.abs(quantities.secondGradeQuantity),
          referenceId: operationId,
          referenceType: 'cutting_progress',
          comment: `Корректировка 2-го сорта по операции резки #${operationId} (прогресс)`,
          userId
        });
      }

      // Обновляем остатки для товара Либерти (если количество не нулевое)
      if (quantities.libertyGradeQuantity !== 0 && existingLibertyGrade) {
        await tx.update(schema.stock)
          .set({
            currentStock: sql`current_stock + ${quantities.libertyGradeQuantity}`,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, existingLibertyGrade.id));

        // Логируем движение товара
        await tx.insert(schema.stockMovements).values({
          productId: existingLibertyGrade.id,
          movementType: quantities.libertyGradeQuantity > 0 ? 'cutting_in' : 'outgoing',
          quantity: Math.abs(quantities.libertyGradeQuantity),
          referenceId: operationId,
          referenceType: 'cutting_progress',
          comment: `Корректировка сорта Либерти по операции резки #${operationId} (прогресс)`,
          userId
        });
      }

      // Создаем запись прогресса
      const [progressEntry] = await tx.insert(schema.cuttingProgressLog).values({
        operationId,
        productQuantity: quantities.productQuantity,
        secondGradeQuantity: quantities.secondGradeQuantity,
        libertyGradeQuantity: quantities.libertyGradeQuantity,
        wasteQuantity: quantities.wasteQuantity,
        enteredBy: userId
      }).returning();

      // Получаем текущий прогресс операции
      const currentProgress = await tx
        .select({
          totalProduct: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.productQuantity}), 0)`,
          totalSecondGrade: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.secondGradeQuantity}), 0)`,
          totalLibertyGrade: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.libertyGradeQuantity}), 0)`,
          totalWaste: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.wasteQuantity}), 0)`
        })
        .from(schema.cuttingProgressLog)
        .where(eq(schema.cuttingProgressLog.operationId, operationId));

      // Логируем добавление прогресса
      await tx.insert(schema.auditLog).values({
        tableName: 'cutting_progress_log',
        recordId: progressEntry.id,
        operation: 'INSERT',
        newValues: progressEntry,
        userId
      });

      return {
        progressEntry,
        currentProgress: currentProgress[0]
      };
    });

    // Формируем сообщение с информацией о введенных количествах
    const messages = [];
    if (quantities.productQuantity !== 0) {
      const sign = quantities.productQuantity > 0 ? '+' : '';
      messages.push(`Товар: ${sign}${quantities.productQuantity} шт.`);
    }
    if (quantities.secondGradeQuantity !== 0) {
      const sign = quantities.secondGradeQuantity > 0 ? '+' : '';
      messages.push(`2 сорт: ${sign}${quantities.secondGradeQuantity} шт.`);
    }
    if (quantities.wasteQuantity !== 0) {
      const sign = quantities.wasteQuantity > 0 ? '+' : '';
      messages.push(`Брак: ${sign}${quantities.wasteQuantity} шт.`);
    }

    res.status(201).json({
      success: true,
      data: result,
      message: `Прогресс добавлен: ${messages.join(', ')}`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/cutting/:id/progress - Get progress entries for cutting operation
router.get('/:id/progress', authenticateToken, requirePermission('cutting', 'view'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);

    if (!operationId || isNaN(operationId)) {
      return next(createError('Некорректный ID операции', 400));
    }

    // Проверяем существование операции
    const operation = await db.query.cuttingOperations.findFirst({
      where: eq(schema.cuttingOperations.id, operationId)
    });

    if (!operation) {
      return next(createError('Операция резки не найдена', 404));
    }

    // Получаем записи прогресса
    const progressEntries = await db.query.cuttingProgressLog.findMany({
      where: eq(schema.cuttingProgressLog.operationId, operationId),
      with: {
        enteredByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: desc(schema.cuttingProgressLog.enteredAt)
    });

    // Получаем текущий прогресс
    const currentProgress = await db
      .select({
        totalProduct: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.productQuantity}), 0)`,
        totalSecondGrade: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.secondGradeQuantity}), 0)`,
        totalWaste: sql<number>`COALESCE(SUM(${schema.cuttingProgressLog.wasteQuantity}), 0)`
      })
      .from(schema.cuttingProgressLog)
      .where(eq(schema.cuttingProgressLog.operationId, operationId));

    res.json({
      success: true,
      data: {
        operation,
        progressEntries,
        currentProgress: currentProgress[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/cutting/:id - Update cutting operation details
router.put('/:id', authenticateToken, requirePermission('cutting', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const operationId = Number(req.params.id);
    const { 
      sourceProductId, 
      targetProductId, 
      sourceQuantity, 
      targetQuantity, 
      plannedDate, // Оставляем для обратной совместимости
      plannedStartDate, // Новая дата начала
      plannedEndDate, // Новая дата окончания
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

    // Можно редактировать только незавершенные операции
    const editableStatuses = ['in_progress', 'paused', 'cancelled'];
    if (!operation.status || !editableStatuses.includes(operation.status)) {
      return next(createError('Можно редактировать только незавершенные операции (в процессе, на паузе, отмененные)', 400));
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

    // Обработка дат
    if (plannedDate !== undefined) {
      updateData.plannedDate = plannedDate ? new Date(plannedDate) : null;
    }

    if (plannedStartDate !== undefined) {
      updateData.plannedStartDate = plannedStartDate ? new Date(plannedStartDate) : null;
    }

    if (plannedEndDate !== undefined) {
      updateData.plannedEndDate = plannedEndDate ? new Date(plannedEndDate) : null;
    }

    // Валидация диапазона дат
    if (updateData.plannedStartDate && updateData.plannedEndDate) {
      const startDate = new Date(updateData.plannedStartDate);
      const endDate = new Date(updateData.plannedEndDate);
      
      if (startDate > endDate) {
        return next(createError('Дата начала не может быть позже даты окончания', 400));
      }
      
      // Проверка на разумный диапазон (не более 30 дней)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30) {
        return next(createError('Диапазон дат не может превышать 30 дней', 400));
      }
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

    if (notes !== undefined) {
      updateData.notes = notes || null;
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

// POST /api/cutting/export - Export cutting operations to Excel (Задача 9.2)
router.post('/export', authenticateToken, requireExportPermission('cutting'), async (req: AuthRequest, res, next) => {
  try {
    const { filters, format = 'xlsx' } = req.body; // добавляем параметр format

    let whereConditions: any[] = [];

    // Применяем фильтры если они переданы
    if (filters) {
      if (filters.status && filters.status !== 'all') {
        const statusArray = filters.status.split(',').map((s: string) => s.trim());
        if (statusArray.length === 1) {
          whereConditions.push(eq(schema.cuttingOperations.status, statusArray[0] as any));
        } else {
          whereConditions.push(inArray(schema.cuttingOperations.status, statusArray as any[]));
        }
      }

      if (filters.operatorId && filters.operatorId !== 'all') {
        whereConditions.push(eq(schema.cuttingOperations.operatorId, parseInt(filters.operatorId)));
      }

      if (filters.assignedTo && filters.assignedTo !== 'all') {
        whereConditions.push(eq(schema.cuttingOperations.assignedTo, parseInt(filters.assignedTo)));
      }

      if (filters.dateFrom) {
        whereConditions.push(sql`${schema.cuttingOperations.createdAt} >= ${filters.dateFrom}`);
      }

      if (filters.dateTo) {
        whereConditions.push(sql`${schema.cuttingOperations.createdAt} <= ${filters.dateTo}`);
      }
    }

    // Получаем операции резки с полной информацией
    const operations = await db.query.cuttingOperations.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        sourceProduct: true,
        targetProduct: true,
        operator: true,
        assignedToUser: true
      },
      orderBy: [desc(schema.cuttingOperations.createdAt)]
    });

    // Форматируем данные для Excel
    const formattedData = ExcelExporter.formatCuttingOperationsData(operations);

    // Генерируем имя файла
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const fileExtension = format === 'csv' ? 'csv' : 'xlsx';
    const filename = `cutting-operations-export-${timestamp}.${fileExtension}`;

    // Экспортируем в указанном формате (Задача 3: Дополнительные форматы)
    await ExcelExporter.exportData(res, {
      filename,
      sheetName: 'Операции резки',
      title: `Экспорт операций резки - ${new Date().toLocaleDateString('ru-RU')}`,
      columns: ExcelExporter.getCuttingOperationsColumns(),
      data: formattedData,
      format
    });

  } catch (error) {
    next(error);
  }
});

export default router; 