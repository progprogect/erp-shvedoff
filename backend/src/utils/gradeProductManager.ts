/**
 * Утилита для управления товарами разных сортов (2-й сорт, Либерти)
 * Обеспечивает консистентную логику создания и обновления товаров во всех endpoint'ах
 */

import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { generateArticle } from './articleGenerator';

export interface GradeProductOptions {
  sourceProduct: any; // Исходный товар с полными данными
  grade: 'grade_2' | 'liber'; // Тип сорта
  quantity: number; // Количество для добавления/списания
  userId: number; // ID пользователя для логирования
  referenceId?: number; // ID связанного объекта (задание, операция)
  referenceType: 'production_task' | 'cutting_progress' | 'production' | 'cutting_operation';
  comment: string; // Комментарий для движения товара
  tx: any; // Транзакция Drizzle
}

/**
 * Находит или создает товар указанного сорта и обновляет его остатки
 * Гарантирует консистентное поведение во всех местах системы
 */
export async function findOrCreateGradeProduct(options: GradeProductOptions): Promise<{
  product: any;
  wasCreated: boolean;
}> {
  const { sourceProduct, grade, quantity, userId, referenceId, referenceType, comment, tx } = options;

  // 1. Ищем существующий товар с ПОЛНЫМ набором характеристик
  let gradeProduct = await tx.query.products.findFirst({
    where: and(
      // Основные параметры
      sourceProduct.categoryId ? eq(schema.products.categoryId, sourceProduct.categoryId) : undefined,
      eq(schema.products.name, sourceProduct.name),
      eq(schema.products.productType, sourceProduct.productType),
      eq(schema.products.grade, grade),
      eq(schema.products.isActive, true),
      
      // Размеры
      sourceProduct.dimensions ? eq(schema.products.dimensions, sourceProduct.dimensions) : undefined,
      
      // Поверхности
      sourceProduct.surfaceIds ? eq(schema.products.surfaceIds, sourceProduct.surfaceIds) : undefined,
      
      // Логотип
      sourceProduct.logoId 
        ? eq(schema.products.logoId, sourceProduct.logoId) 
        : (!sourceProduct.logoId ? isNull(schema.products.logoId) : undefined),
      
      // Материал
      sourceProduct.materialId 
        ? eq(schema.products.materialId, sourceProduct.materialId) 
        : (!sourceProduct.materialId ? isNull(schema.products.materialId) : undefined),
      
      // Низ ковра
      sourceProduct.bottomTypeId 
        ? eq(schema.products.bottomTypeId, sourceProduct.bottomTypeId) 
        : (!sourceProduct.bottomTypeId ? isNull(schema.products.bottomTypeId) : undefined),
      
      // Паззл
      sourceProduct.puzzleTypeId 
        ? eq(schema.products.puzzleTypeId, sourceProduct.puzzleTypeId) 
        : (!sourceProduct.puzzleTypeId ? isNull(schema.products.puzzleTypeId) : undefined),
      
      sourceProduct.puzzleSides ? eq(schema.products.puzzleSides, sourceProduct.puzzleSides) : undefined,
      
      // Пресс
      sourceProduct.pressType 
        ? eq(schema.products.pressType, sourceProduct.pressType) 
        : (!sourceProduct.pressType ? isNull(schema.products.pressType) : undefined),
      
      // Края ковра
      sourceProduct.carpetEdgeType 
        ? eq(schema.products.carpetEdgeType, sourceProduct.carpetEdgeType) 
        : (!sourceProduct.carpetEdgeType ? isNull(schema.products.carpetEdgeType) : undefined),
      
      sourceProduct.carpetEdgeSides 
        ? eq(schema.products.carpetEdgeSides, sourceProduct.carpetEdgeSides) 
        : undefined,
      
      sourceProduct.carpetEdgeStrength 
        ? eq(schema.products.carpetEdgeStrength, sourceProduct.carpetEdgeStrength) 
        : (!sourceProduct.carpetEdgeStrength ? isNull(schema.products.carpetEdgeStrength) : undefined),
      
      // Площадь мата
      sourceProduct.matArea 
        ? eq(schema.products.matArea, sourceProduct.matArea) 
        : (!sourceProduct.matArea ? isNull(schema.products.matArea) : undefined),
      
      // Вес
      sourceProduct.weight 
        ? eq(schema.products.weight, sourceProduct.weight) 
        : (!sourceProduct.weight ? isNull(schema.products.weight) : undefined),
      
      // Борт
      sourceProduct.borderType 
        ? eq(schema.products.borderType, sourceProduct.borderType) 
        : (!sourceProduct.borderType ? isNull(schema.products.borderType) : undefined)
    )
  });

  let wasCreated = false;

  // 2. Если товар не найден - создаем новый (независимо от quantity - может быть отрицательным)
  if (!gradeProduct) {
    // Получаем связанные данные для генерации артикула
    const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
      sourceProduct.surfaceIds && sourceProduct.surfaceIds.length > 0 
        ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, sourceProduct.surfaceIds) })
        : [],
      sourceProduct.logoId 
        ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, sourceProduct.logoId) })
        : null,
      sourceProduct.materialId 
        ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, sourceProduct.materialId) })
        : null,
      sourceProduct.bottomTypeId 
        ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, sourceProduct.bottomTypeId) })
        : null,
      sourceProduct.puzzleTypeId 
        ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, sourceProduct.puzzleTypeId) })
        : null
    ]);

    // Подготавливаем данные для генерации артикула
    const gradeProductData = {
      name: sourceProduct.name,
      dimensions: sourceProduct.dimensions as { length?: number; width?: number; thickness?: number },
      surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
      logo: logo ? { name: logo.name } : undefined,
      material: material ? { name: material.name } : undefined,
      bottomType: bottomType ? { code: bottomType.code } : undefined,
      puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
      carpetEdgeType: sourceProduct.carpetEdgeType || undefined,
      carpetEdgeSides: sourceProduct.carpetEdgeSides || undefined,
      carpetEdgeStrength: sourceProduct.carpetEdgeStrength || undefined,
      pressType: sourceProduct.pressType || 'not_selected',
      borderType: sourceProduct.borderType || 'without_border',
      grade: grade
    };
    
    const gradeArticle = generateArticle(gradeProductData);
    
    // Создаем новый товар
    const [newGradeProduct] = await tx.insert(schema.products).values({
      name: sourceProduct.name,
      article: gradeArticle,
      categoryId: sourceProduct.categoryId,
      productType: sourceProduct.productType,
      dimensions: sourceProduct.dimensions,
      surfaceIds: sourceProduct.surfaceIds,
      logoId: sourceProduct.logoId,
      materialId: sourceProduct.materialId,
      bottomTypeId: sourceProduct.bottomTypeId,
      puzzleTypeId: sourceProduct.puzzleTypeId,
      puzzleSides: sourceProduct.puzzleSides,
      carpetEdgeType: sourceProduct.carpetEdgeType,
      carpetEdgeSides: sourceProduct.carpetEdgeSides,
      carpetEdgeStrength: sourceProduct.carpetEdgeStrength,
      matArea: sourceProduct.matArea,
      weight: sourceProduct.weight,
      pressType: sourceProduct.pressType,
      borderType: sourceProduct.borderType,
      grade: grade,
      normStock: 0,
      isActive: true,
      notes: `Автоматически создан для сорта ${grade === 'grade_2' ? '2-й' : 'Либерти'}`
    }).returning();

    // Создаем запись остатков для нового товара
    await tx.insert(schema.stock).values({
      productId: newGradeProduct.id,
      currentStock: 0,
      reservedStock: 0,
      updatedAt: new Date()
    });

    gradeProduct = newGradeProduct;
    wasCreated = true;
  } else if (gradeProduct) {
    // Проверяем, есть ли запись в stock для существующего товара
    const existingStock = await tx.query.stock.findFirst({
      where: eq(schema.stock.productId, gradeProduct.id)
    });

    if (!existingStock) {
      // Создаем запись остатков для существующего товара
      await tx.insert(schema.stock).values({
        productId: gradeProduct.id,
        currentStock: 0,
        reservedStock: 0,
        updatedAt: new Date()
      });
    }
  }

  // 3. Если товар найден или создан - обновляем остатки и логируем движение
  if (gradeProduct && quantity !== 0) {
    // Обновляем остатки
    await tx.update(schema.stock)
      .set({
        currentStock: sql`current_stock + ${quantity}`,
        updatedAt: new Date()
      })
      .where(eq(schema.stock.productId, gradeProduct.id));

    // Логируем движение
    await tx.insert(schema.stockMovements).values({
      productId: gradeProduct.id,
      movementType: quantity > 0 ? 'incoming' : 'outgoing',
      quantity: Math.abs(quantity),
      referenceId: referenceId,
      referenceType: referenceType,
      comment: comment,
      userId
    });
  }

  return {
    product: gradeProduct,
    wasCreated
  };
}

