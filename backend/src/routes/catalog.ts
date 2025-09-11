import express from 'express';
import { db, schema } from '../db';
import { eq, like, ilike, isNull, and, or, sql, inArray } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { requireExportPermission, requirePermission } from '../middleware/permissions';
import { createError } from '../middleware/errorHandler';
import { ExcelExporter } from '../utils/excelExporter';
import { parsePrice, formatPrice } from '../utils/priceUtils';
import { generateArticle, validateProductData } from '../utils/articleGenerator';

const router = express.Router();

// Helper function to calculate mat area (площадь мата)
function calculateMatArea(matArea: string | undefined, dimensions: any, productType: string): string | null {
  // Если площадь указана вручную, используем её
  if (matArea) {
    return parseFloat(matArea).toString();
  }
  
  // Автоматический расчет для ковров и рулонных покрытий
  if ((productType === 'carpet' || productType === 'roll_covering') && dimensions) {
    const { length, width } = dimensions;
    if (length && width && length > 0 && width > 0) {
      // Переводим из мм в м и рассчитываем площадь
      const lengthInMeters = length / 1000;
      const widthInMeters = width / 1000;
      const areaInSquareMeters = lengthInMeters * widthInMeters;
      return areaInSquareMeters.toFixed(4);
    }
  }
  
  return null;
}

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
      limit = 1000, // Увеличен лимит для отображения всех товаров
      offset = 0,
      stockStatus, // 'in_stock', 'low_stock', 'out_of_stock'
      // Новые фильтры для полноценной фильтрации
      materialIds,    // материалы (массив ID)
      surfaceIds,     // поверхности (массив ID) 
      logoIds,        // логотипы (массив ID)
      grades,         // сорта товаров (массив)
      pressTypes,     // типы пресса (массив) - AC3
      productTypes,   // типы товара (массив) - carpet/other
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
      // Нормализуем поисковый запрос: убираем пробелы, дефисы, приводим к нижнему регистру
      const normalizedSearch = search.toString().toLowerCase().replace(/[\s\-]/g, '');
      
      // Поиск по названию ИЛИ артикулу (с нормализацией)
      whereConditions.push(
        or(
          ilike(schema.products.name, `%${search}%`),
          ilike(schema.products.article, `%${search}%`),
          // Дополнительный поиск с нормализацией для артикула
          sql`LOWER(REPLACE(REPLACE(${schema.products.article}, ' ', ''), '-', '')) LIKE ${'%' + normalizedSearch + '%'}`
        )
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

    // Фильтр по поверхностям (обновлено для surfaceIds массива)
    if (surfaceIds) {
      const ids = Array.isArray(surfaceIds) ? surfaceIds : [surfaceIds];
      const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));
      if (numericIds.length > 0) {
        // Используем оператор && для проверки пересечения массивов
        whereConditions.push(sql`${schema.products.surfaceIds} && ${numericIds}`);
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
        .filter(grade => typeof grade === 'string' && ['usual', 'grade_2', 'telyatnik', 'liber'].includes(grade))
        .map(grade => grade as 'usual' | 'grade_2' | 'telyatnik' | 'liber');
      if (validGrades.length > 0) {
        whereConditions.push(inArray(schema.products.grade, validGrades));
      }
    }

    // Фильтр по типу пресса (AC3)
    if (pressTypes) {
      const pressTypesList = Array.isArray(pressTypes) ? pressTypes : [pressTypes];
      const validPressTypes = pressTypesList
        .filter(pressType => typeof pressType === 'string' && ['not_selected', 'ukrainian', 'chinese'].includes(pressType))
        .map(pressType => pressType as 'not_selected' | 'ukrainian' | 'chinese');
      if (validPressTypes.length > 0) {
        whereConditions.push(inArray(schema.products.pressType, validPressTypes));
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

    // Фильтр по типу товара
    if (productTypes) {
      const typesList = Array.isArray(productTypes) ? productTypes : [productTypes];
      const validTypes = typesList
        .filter(type => typeof type === 'string' && ['carpet', 'other', 'pur', 'roll_covering'].includes(type))
        .map(type => type as 'carpet' | 'other' | 'pur' | 'roll_covering');
      if (validTypes.length > 0) {
        whereConditions.push(inArray(schema.products.productType, validTypes));
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
                        sortBy === 'updatedAt' ? schema.products.updatedAt :
                        sortBy === 'createdAt' ? schema.products.createdAt :
                        schema.products.updatedAt; // 🔥 НОВОЕ: дефолт по дате изменения
      
      const direction = sortOrder === 'DESC' ? sql`${sortColumn} DESC` : sql`${sortColumn} ASC`;
      orderBy = direction;
    } else {
      // 🔥 НОВОЕ: дефолтная сортировка по дате изменения (новые товары/изменения сверху)
      orderBy = sql`${schema.products.updatedAt} DESC`;
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
        },
        rollComposition: {
          with: {
            carpet: {
              columns: {
                id: true,
                name: true,
                article: true
              }
            }
          },
          orderBy: sql`${schema.rollCoveringComposition.sortOrder} ASC`
        }
      }
    });

    if (!product) {
      return next(createError('Product not found', 404));
    }

    // Загружаем множественные поверхности если есть surfaceIds
    let surfaces: any[] = [];
    if (product.surfaceIds && product.surfaceIds.length > 0) {
      surfaces = await db.query.productSurfaces.findMany({
        where: inArray(schema.productSurfaces.id, product.surfaceIds)
      });
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
      surfaces, // Добавляем множественные поверхности
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
router.post('/products', authenticateToken, requirePermission('catalog', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const { 
      name, 
      article, 
      productType, // тип товара: carpet, other или pur
      purNumber, // номер ПУР (только для товаров типа pur)
      categoryId, 
      surfaceId, // DEPRECATED: для обратной совместимости
      surfaceIds, // новое поле множественного выбора
      logoId,
      materialId,
      pressType, // новое поле типа пресса
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
      puzzleSides,
      autoGenerateArticle, // флаг автогенерации артикула
      // Поля для рулонных покрытий
      composition // состав рулонного покрытия
    } = req.body;

    if (!name || !categoryId) {
      return next(createError('Product name and category are required', 400));
    }

    // Валидация типа товара
    const validProductType = productType || 'carpet'; // по умолчанию ковер
    if (!['carpet', 'other', 'pur', 'roll_covering'].includes(validProductType)) {
      return next(createError('Product type must be "carpet", "other", "pur", or "roll_covering"', 400));
    }

    // Для товаров типа "other" артикул обязателен и автогенерация отключена
    if (validProductType === 'other') {
      if (!article || article.trim().length === 0) {
        return next(createError('Для товаров типа "Другое" артикул обязателен', 400));
      }
    }

    // Для товаров типа "pur" артикул обязателен, размеры обязательны
    if (validProductType === 'pur') {
      if (!article || article.trim().length === 0) {
        return next(createError('Для товаров типа "ПУР" артикул обязателен', 400));
      }
      
      // Валидация размеров для ПУР (обязательные)
      if (!dimensions || !dimensions.length || !dimensions.width || !dimensions.thickness) {
        return next(createError('Для товаров типа "ПУР" размеры (длина, ширина, высота) обязательны', 400));
      }
      
      if (dimensions.length <= 0 || dimensions.width <= 0 || dimensions.thickness <= 0) {
        return next(createError('Для товаров типа "ПУР" все размеры должны быть больше 0', 400));
      }
      
      // Валидация номера ПУР (опционально, но если указан - должен быть положительным)
      if (purNumber !== undefined && purNumber !== null && (typeof purNumber !== 'number' || purNumber <= 0)) {
        return next(createError('Номер ПУР должен быть положительным числом', 400));
      }
    }

    // Валидация цены
    let validatedPrice = null;
    if (price !== undefined && price !== null && price !== '') {
      const priceResult = parsePrice(price);
      if (!priceResult.success) {
        return next(createError(`Ошибка в цене: ${priceResult.error}`, 400));
      }
      validatedPrice = priceResult.value;
    }

    // Валидация себестоимости
    let validatedCostPrice = null;
    if (costPrice !== undefined && costPrice !== null && costPrice !== '') {
      const costPriceResult = parsePrice(costPrice);
      if (!costPriceResult.success) {
        return next(createError(`Ошибка в себестоимости: ${costPriceResult.error}`, 400));
      }
      validatedCostPrice = costPriceResult.value;
    }

    // bottomTypeId теперь опциональный (AC6)
    // Валидация surface_ids или surfaceId
    let finalSurfaceIds: number[] = [];
    
    if (surfaceIds && Array.isArray(surfaceIds)) {
      finalSurfaceIds = surfaceIds;
    } else if (surfaceId) {
      // Обратная совместимость: конвертируем surfaceId в surfaceIds
      finalSurfaceIds = [surfaceId];
    }

    // Валидация pressType
    const validPressTypes = ['not_selected', 'ukrainian', 'chinese'];
    if (pressType && !validPressTypes.includes(pressType)) {
      return next(createError('Недопустимое значение типа пресса', 400));
    }

    // Автогенерация артикула если включена (для ковров и рулонных покрытий)
    let finalArticle = article;
    
    if (validProductType === 'carpet' && (autoGenerateArticle || !article)) {
      try {
        // Получаем связанные данные для генерации артикула
        const [material, logo, surfaces, bottomType, puzzleType] = await Promise.all([
          materialId ? db.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, materialId) }) : null,
          logoId ? db.query.productLogos.findFirst({ where: eq(schema.productLogos.id, logoId) }) : null,
          finalSurfaceIds.length > 0 ? db.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, finalSurfaceIds) }) : [],
          bottomTypeId ? db.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, bottomTypeId) }) : null,
          puzzleTypeId ? db.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, puzzleTypeId) }) : null
        ]);

        const productData = {
          name,
          dimensions,
          material: material ? { name: material.name } : undefined,
          pressType: pressType || 'not_selected',
          logo: logo ? { name: logo.name } : undefined,
          surfaces: surfaces ? surfaces.map(s => ({ name: s.name })) : [],
          borderType,
          carpetEdgeType: carpetEdgeType || 'straight_cut',
          carpetEdgeSides: carpetEdgeSides || 1,
          carpetEdgeStrength: carpetEdgeStrength || 'normal',
          puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
          bottomType: bottomType ? { code: bottomType.code } : undefined,
          grade: grade || 'usual'
        };

        finalArticle = generateArticle(productData);
      } catch (genError) {
        console.error('Ошибка генерации артикула:', genError);
        // Если автогенерация не удалась, используем переданный артикул или генерируем простой
        finalArticle = article || `${name.toUpperCase()}-${Date.now()}`;
      }
    }
    
    // Автогенерация артикула для рулонных покрытий
    if (validProductType === 'roll_covering' && (autoGenerateArticle || !article)) {
      try {
        // Импортируем функцию генерации для рулонных покрытий
        const { generateRollCoveringArticle } = await import('../utils/articleGenerator');
        
        // Получаем связанные данные для генерации артикула
        const [surfaces, logo, bottomType] = await Promise.all([
          finalSurfaceIds.length > 0 ? db.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, finalSurfaceIds) }) : [],
          logoId ? db.query.productLogos.findFirst({ where: eq(schema.productLogos.id, logoId) }) : null,
          bottomTypeId ? db.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, bottomTypeId) }) : null
        ]);
        
        const rollData = {
          name,
          dimensions,
          surfaces: surfaces.length > 0 ? surfaces.map(s => ({ name: s.name })) : undefined,
          logo: logo ? { name: logo.name } : undefined, // 🔥 НОВОЕ: добавляем логотип
          bottomType: bottomType ? { code: bottomType.code } : undefined,
          composition: composition || []
        };
        
        finalArticle = generateRollCoveringArticle(rollData);
      } catch (genError) {
        console.error('Ошибка генерации артикула для рулонного покрытия:', genError);
        finalArticle = article || `RLN-${Date.now()}`;
      }
    }

    // Проверяем уникальность артикула (если указан) - проверка без учета регистра
    if (finalArticle) {
      const normalizedArticle = finalArticle.trim().toLowerCase();
      
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
        return next(createError(`Товар с таким артикулом уже существует. Выберите другой.`, 400));
      }
    }

    const newProduct = await db.insert(schema.products).values({
      name,
      article: finalArticle,
      productType: validProductType,
      purNumber: validProductType === 'pur' ? (purNumber || null) : null, // номер ПУР только для товаров типа pur
      categoryId,
      // Ковровые поля (для товаров типа 'carpet' и 'roll_covering')
      surfaceId: (validProductType === 'carpet' || validProductType === 'roll_covering') ? (surfaceId || null) : null, // DEPRECATED: для обратной совместимости
      surfaceIds: (validProductType === 'carpet' || validProductType === 'roll_covering') && finalSurfaceIds.length > 0 ? finalSurfaceIds : null, // множественный выбор для ковров и рулонов
      logoId: (validProductType === 'carpet' || validProductType === 'roll_covering') ? (logoId || null) : null, // логотип для ковров и рулонных покрытий
      materialId: (validProductType === 'carpet' || validProductType === 'roll_covering') ? (materialId || null) : null, // материал для ковров и рулонных покрытий
      pressType: (validProductType === 'carpet' || validProductType === 'roll_covering') ? (pressType || 'not_selected') : null, // пресс для ковров и рулонных покрытий
      dimensions: (validProductType === 'carpet' || validProductType === 'pur' || validProductType === 'roll_covering') ? dimensions : null, // размеры для ковров, ПУР и рулонов
      characteristics: validProductType === 'carpet' ? characteristics : null,
      puzzleOptions: validProductType === 'carpet' ? (puzzleOptions || null) : null,
      matArea: (validProductType === 'carpet' || validProductType === 'roll_covering' || validProductType === 'pur') ? calculateMatArea(matArea, dimensions, validProductType) : null,
      weight: weight ? parseFloat(weight).toString() : null, // вес может быть у любого товара
      grade: validProductType === 'carpet' ? (grade || 'usual') : null,
      borderType: validProductType === 'carpet' ? (borderType || null) : null,
      tags,
      price: validatedPrice,
      costPrice: validatedCostPrice,
      normStock: normStock || 0,
      notes,
      // Новые поля для края ковра (только для ковров)
      carpetEdgeType: validProductType === 'carpet' ? (carpetEdgeType || 'straight_cut') : null,
      carpetEdgeSides: validProductType === 'carpet' ? (carpetEdgeSides || 1) : null,
      carpetEdgeStrength: validProductType === 'carpet' ? (carpetEdgeStrength || 'normal') : null,
      // Поле для низа ковра (для ковров и рулонных покрытий)
      bottomTypeId: (validProductType === 'carpet' || validProductType === 'roll_covering') ? (bottomTypeId || null) : null,
      // Поля паззла (только для ковров)
      puzzleTypeId: validProductType === 'carpet' ? (puzzleTypeId || null) : null,
      puzzleSides: validProductType === 'carpet' ? (puzzleSides || null) : null
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

    // Сохраняем состав для рулонных покрытий
    if (validProductType === 'roll_covering' && composition && composition.length > 0) {
      try {
        const compositionItems = composition.map((item: any, index: number) => ({
          rollCoveringId: newProduct[0].id,
          carpetId: item.carpetId,
          quantity: item.quantity,
          sortOrder: item.sortOrder || index
        }));
        
        await db.insert(schema.rollCoveringComposition).values(compositionItems);
      } catch (compositionError) {
        console.error('Ошибка сохранения состава рулонного покрытия:', compositionError);
        // Состав не критичен, товар уже создан, продолжаем
      }
    }

    res.status(201).json({
      success: true,
      data: newProduct[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/catalog/products/preview-article - Preview article generation
router.post('/products/preview-article', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { 
      productType,
      name,
      dimensions,
      materialId,
      pressType,
      logoId,
      surfaceIds,
      borderType,
      carpetEdgeType,
      carpetEdgeSides,
      carpetEdgeStrength,
      bottomTypeId,
      puzzleTypeId,
      grade,
      composition
    } = req.body;

    // Получаем связанные данные для генерации артикула
    const [material, logo, surfaces, bottomType, puzzleType] = await Promise.all([
      materialId ? db.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, materialId) }) : null,
      logoId ? db.query.productLogos.findFirst({ where: eq(schema.productLogos.id, logoId) }) : null,
      surfaceIds && surfaceIds.length > 0 ? db.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, surfaceIds) }) : [],
      bottomTypeId ? db.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, bottomTypeId) }) : null,
      puzzleTypeId ? db.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, puzzleTypeId) }) : null
    ]);

    let previewArticle = '';
    let validationData: any;

    if (productType === 'roll_covering') {
      // Для рулонных покрытий используем специальный генератор
      const { generateRollCoveringArticle } = await import('../utils/articleGenerator');
      
      const rollData = {
        name: name || 'ТОВАР',
        dimensions: dimensions || {},
        surfaces: surfaces ? surfaces.map(s => ({ name: s.name })) : undefined,
        logo: logo ? { name: logo.name } : undefined, // 🔥 НОВОЕ: добавляем логотип
        bottomType: bottomType ? { code: bottomType.code } : undefined,
        composition: composition || []
      };
      
      previewArticle = generateRollCoveringArticle(rollData);
      validationData = { name: name || 'ТОВАР' };
    } else {
      // Для ковровых изделий используем обычный генератор
      const productData = {
        name: name || 'ТОВАР',
        dimensions: dimensions || {},
        material: material ? { name: material.name } : undefined,
        pressType: pressType || 'not_selected',
        logo: logo ? { name: logo.name } : undefined,
        surfaces: surfaces ? surfaces.map(s => ({ name: s.name })) : [],
        borderType,
        carpetEdgeType: carpetEdgeType || 'straight_cut',
        carpetEdgeSides: carpetEdgeSides || 1,
        carpetEdgeStrength: carpetEdgeStrength || 'normal',
        puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
        bottomType: bottomType ? { code: bottomType.code } : undefined,
        grade: grade || 'usual'
      };

      previewArticle = generateArticle(productData);
      validationData = productData;
    }
    
    const validation = validateProductData(validationData);

    res.json({
      success: true,
      data: {
        article: previewArticle,
        validation
      }
    });
  } catch (error) {
    console.error('Ошибка предварительного просмотра артикула:', error);
    res.json({
      success: false,
      error: 'Ошибка генерации артикула',
      data: {
        article: '',
        validation: { isValid: false, errors: ['Ошибка генерации'] }
      }
    });
  }
});

// PUT /api/catalog/products/:id - Update product
router.put('/products/:id', authenticateToken, requirePermission('catalog', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.params.id);
    const updateData = { ...req.body };

    // Валидация цены, если она передана
    if ('price' in updateData && updateData.price !== undefined && updateData.price !== null && updateData.price !== '') {
      const priceResult = parsePrice(updateData.price);
      if (!priceResult.success) {
        return next(createError(`Ошибка в цене: ${priceResult.error}`, 400));
      }
      updateData.price = priceResult.value;
    }

    // Валидация себестоимости, если она передана
    if ('costPrice' in updateData && updateData.costPrice !== undefined && updateData.costPrice !== null && updateData.costPrice !== '') {
      const costPriceResult = parsePrice(updateData.costPrice);
      if (!costPriceResult.success) {
        return next(createError(`Ошибка в себестоимости: ${costPriceResult.error}`, 400));
      }
      updateData.costPrice = costPriceResult.value;
    }

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
router.delete('/products/:id', authenticateToken, requirePermission('catalog', 'delete'), async (req: AuthRequest, res, next) => {
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
router.post('/products/move', authenticateToken, requirePermission('catalog', 'edit'), async (req: AuthRequest, res, next) => {
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

// 🔥 НОВОЕ: Dry-run для массового обновления артикулов
router.post('/regenerate/dry-run', authenticateToken, authorizeRoles('owner'), async (req: AuthRequest, res, next) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать список ID товаров'
      });
    }

    // Получаем товары с полными данными для генерации артикула
    const products = await db.query.products.findMany({
      where: inArray(schema.products.id, productIds),
      with: {
        logo: true,
        material: true,
        bottomType: true,
        puzzleType: true
      }
    });

    const results = [];
    let canApplyCount = 0;
    let cannotApplyCount = 0;

    for (const product of products) {
      try {
        // Подготавливаем данные для генерации артикула
        const productData = {
          name: product.name,
          dimensions: product.dimensions as { length?: number; width?: number; thickness?: number },
          material: product.material ? { name: product.material.name } : undefined,
          pressType: product.pressType as 'not_selected' | 'ukrainian' | 'chinese',
          logo: product.logo ? { name: product.logo.name } : undefined,
          surfaces: [], // TODO: Добавить поддержку множественных поверхностей
          borderType: product.borderType as 'with_border' | 'without_border',
          carpetEdgeType: product.carpetEdgeType || undefined,
          carpetEdgeSides: product.carpetEdgeSides || undefined,
          carpetEdgeStrength: product.carpetEdgeStrength || undefined,
          puzzleType: product.puzzleType ? { name: product.puzzleType.name } : undefined,
          bottomType: product.bottomType ? { code: product.bottomType.code } : undefined,
          grade: product.grade as 'usual' | 'grade_2' | 'telyatnik' | 'liber'
        };

        // Генерируем новый артикул
        const newArticle = generateArticle(productData);
        
        if (!newArticle || newArticle.trim() === '') {
          results.push({
            productId: product.id,
            currentSku: product.article,
            newSku: null,
            canApply: false,
            reason: 'MISSING_PARAMS',
            details: ['Не удалось сгенерировать артикул - недостаточно параметров']
          });
          cannotApplyCount++;
          continue;
        }

        // Проверяем конфликт с существующими артикулами (исключая текущий товар)
        const existingProduct = await db.query.products.findFirst({
          where: and(
            eq(schema.products.article, newArticle),
            sql`${schema.products.id} != ${product.id}`
          )
        });

        if (existingProduct) {
          results.push({
            productId: product.id,
            currentSku: product.article,
            newSku: newArticle,
            canApply: false,
            reason: 'SKU_CONFLICT',
            details: [`Артикул "${newArticle}" уже существует у товара "${existingProduct.name}"`]
          });
          cannotApplyCount++;
          continue;
        }

        results.push({
          productId: product.id,
          currentSku: product.article,
          newSku: newArticle,
          canApply: true
        });
        canApplyCount++;

      } catch (error) {
        results.push({
          productId: product.id,
          currentSku: product.article,
          newSku: null,
          canApply: false,
          reason: 'UNKNOWN',
          details: [`Ошибка генерации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`]
        });
        cannotApplyCount++;
      }
    }

    return res.json({
      success: true,
      data: {
        results,
        canApplyCount,
        cannotApplyCount
      }
    });

  } catch (error) {
    return next(error);
  }
});

// 🔥 НОВОЕ: Apply для массового обновления артикулов
router.post('/regenerate/apply', authenticateToken, authorizeRoles('owner'), async (req: AuthRequest, res, next) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать список товаров для обновления'
      });
    }

    const updated = [];
    const failed = [];

    // Обрабатываем каждый товар в транзакции
    for (const item of items) {
      try {
        const { productId, newSku } = item;
        
        if (!productId || !newSku) {
          failed.push({
            productId,
            error: 'Отсутствуют обязательные параметры'
          });
          continue;
        }

        // Обновляем артикул товара
        await db.update(schema.products)
          .set({ 
            article: newSku,
            updatedAt: new Date()
          })
          .where(eq(schema.products.id, productId));

        updated.push({
          productId,
          newSku
        });

        // Логируем изменение в аудит
        await db.insert(schema.auditLog).values({
          tableName: 'products',
          recordId: productId,
          operation: 'UPDATE',
          oldValues: { article: item.currentSku },
          newValues: { article: newSku },
          userId: req.user?.id || null
        });

      } catch (error) {
        failed.push({
          productId: item.productId,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка'
        });
      }
    }

    return res.json({
      success: true,
      data: {
        updated: updated.length,
        failed: failed.length,
        updatedItems: updated,
        failedItems: failed
      }
    });

  } catch (error) {
    return next(error);
  }
});

export default router; 