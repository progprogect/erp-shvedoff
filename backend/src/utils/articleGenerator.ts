/**
 * Утилиты для автогенерации артикула товара
 * Формат: НАЗВАНИЕ-РАЗМЕРЫ-МАТЕРИАЛ-ПРЕСС-ПОВЕРХНОСТИ-БОРТ-КРАЙ-НИЗ-СОРТ
 */

export interface ProductData {
  name: string;
  dimensions: {
    length?: number;
    width?: number;
    thickness?: number;
  };
  material?: {
    name: string;
  };
  pressType?: 'not_selected' | 'ukrainian' | 'chinese';
  surfaces?: Array<{
    name: string;
  }>;
  borderType?: 'with_border' | 'without_border';
  carpetEdgeType?: string;
  carpetEdgeSides?: number;
  carpetEdgeStrength?: string;
  puzzleType?: {
    name?: string;
  };
  bottomType?: {
    code?: string;
  };
  grade?: 'usual' | 'grade_2' | 'telyatnik' | 'liber';
}

/**
 * Генерирует артикул на основе характеристик товара
 */
export function generateArticle(product: ProductData): string {
  const parts: string[] = [];

  // 1. НАЗВАНИЕ - с особыми правилами для "коровка"
  const namePart = formatName(product.name);
  if (namePart) parts.push(namePart);

  // 2. РАЗМЕРЫ
  const dimensionsPart = formatDimensions(product.dimensions);
  if (dimensionsPart) parts.push(dimensionsPart);

  // 3. МАТЕРИАЛ
  const materialPart = formatMaterial(product.material?.name);
  if (materialPart) parts.push(materialPart);

  // 4. ПРЕСС (только если выбран)
  const pressPart = formatPress(product.pressType);
  if (pressPart) parts.push(pressPart);

  // 5. ПОВЕРХНОСТИ
  const surfacesPart = formatSurfaces(product.surfaces);
  if (surfacesPart) parts.push(surfacesPart);

  // 6. БОРТ (только если "с бортом")
  const borderPart = formatBorder(product.borderType);
  if (borderPart) parts.push(borderPart);

  // 7. КРАЙ
  const edgePart = formatEdge(
    product.carpetEdgeType,
    product.carpetEdgeSides,
    product.carpetEdgeStrength,
    product.puzzleType
  );
  if (edgePart) parts.push(edgePart);

  // 8. НИЗ
  const bottomPart = formatBottom(product.bottomType?.code);
  if (bottomPart) parts.push(bottomPart);

  // 9. СОРТ (кроме "usual")
  const gradePart = formatGrade(product.grade);
  if (gradePart) parts.push(gradePart);

  return parts.join('-');
}

/**
 * Форматирует название с особыми правилами
 */
function formatName(name: string): string {
  if (!name) return '';

  // Специальные правила для "коровка"
  const lowerName = name.toLowerCase();
  
  // "коровка" → "1КОР"
  if (lowerName.includes('коровка') && !lowerName.match(/\d/)) {
    return '1КОР';
  }
  
  // "1 коровка" → "1КОР"
  const match1 = lowerName.match(/(\d+)\s*коровк[а-я]*/);
  if (match1) {
    return `${match1[1]}КОР`;
  }

  // По умолчанию берем первое слово в верхнем регистре
  return name.split(' ')[0].toUpperCase();
}

/**
 * Форматирует размеры: LENGTH x WIDTH x THICKNESS
 */
function formatDimensions(dimensions: { length?: number; width?: number; thickness?: number }): string {
  if (!dimensions) return '';

  const { length, width, thickness } = dimensions;
  const parts = [];

  if (length) parts.push(length.toString());
  if (width) parts.push(width.toString());
  if (thickness) parts.push(thickness.toString());

  return parts.length > 0 ? parts.join('x') : '';
}

/**
 * Форматирует материал (сокращение)
 */
function formatMaterial(material?: string): string {
  if (!material) return '';

  // Можно добавить мапинг для сокращений материалов
  const materialMap: Record<string, string> = {
    'резина': 'РЕЗ',
    'каучук': 'КАУ',
    'gea': 'GEA',
    // добавить другие при необходимости
  };

  const normalizedMaterial = material.toLowerCase();
  return materialMap[normalizedMaterial] || material.toUpperCase();
}

/**
 * Форматирует тип пресса
 */
function formatPress(pressType?: string): string {
  const pressMap: Record<string, string> = {
    'ukrainian': 'УКР',
    'chinese': 'КИТ',
    'not_selected': '' // не включаем в артикул
  };

  return pressMap[pressType || 'not_selected'] || '';
}

/**
 * Форматирует поверхности (множественный выбор через дефис)
 */
function formatSurfaces(surfaces?: Array<{ name: string }>): string {
  if (!surfaces || surfaces.length === 0) return '';

  const surfaceMap: Record<string, string> = {
    'чешуйки': 'ЧЕШУЙ',
    'черточки': 'ЧЕРТ',
    'гладкая': 'ГЛАД',
    '1 коровка': '1КОР',
    '3 коровки': '3КОР',
    'чешуйка с лого': 'ЧЕШУЙ-ЛОГО'
  };

  const formattedSurfaces = surfaces.map(surface => {
    const normalized = surface.name.toLowerCase();
    return surfaceMap[normalized] || surface.name.toUpperCase();
  });

  return formattedSurfaces.join('-');
}

/**
 * Форматирует борт
 */
function formatBorder(borderType?: string): string {
  return borderType === 'with_border' ? 'Б' : '';
}

/**
 * Форматирует край ковра
 */
function formatEdge(
  edgeType?: string,
  sides?: number,
  strength?: string,
  puzzleType?: { name?: string }
): string {
  if (!edgeType || edgeType === 'straight_cut') {
    // Литой край по умолчанию - не отражается в артикуле
    return '';
  }

  const parts = [];

  // Тип края
  const edgeMap: Record<string, string> = {
    'straight_cut': '', // Литой - не показываем
    'direct_cut': 'ПрямРез',
    'puzzle': 'Пазл',
    'sub_puzzle': 'Подпазл',
    'cast_puzzle': 'ЛитПазл'
  };

  const edgePrefix = edgeMap[edgeType] || edgeType.toUpperCase();
  if (edgePrefix) parts.push(edgePrefix);

  // Количество сторон
  if (sides && sides > 1) {
    parts.push(`${sides}ст`);
  } else if (sides === 1) {
    parts.push('1ст');
  }

  // Для типа "Пазл" добавляем тип пазла
  if (edgeType === 'puzzle' && puzzleType?.name) {
    const puzzleMap: Record<string, string> = {
      'старый': 'Стар',
      'новый': 'Нов'
    };
    const puzzleName = puzzleType.name.toLowerCase();
    const puzzleSuffix = puzzleMap[puzzleName] || puzzleType.name;
    parts.push(puzzleSuffix);
  }

  // Усиление (только если не усиленный)
  if (strength === 'weak') {
    parts.push('НеУсил');
  }
  // Усиленный по умолчанию - не показываем

  return parts.join('');
}

/**
 * Форматирует низ ковра
 */
function formatBottom(bottomCode?: string): string {
  if (!bottomCode) return '';
  
  // Коды низа уже в правильном формате: Ш0, Ш1, Ш2, и т.д.
  return bottomCode.toUpperCase();
}

/**
 * Форматирует сорт товара
 */
function formatGrade(grade?: string): string {
  const gradeMap: Record<string, string> = {
    'usual': '', // Обычный не указываем в артикуле
    'grade_2': '2СОРТ',
    'telyatnik': 'ТЕЛЯТ',
    'liber': 'ЛИБЕР'
  };

  return gradeMap[grade || 'usual'] || '';
}

/**
 * Валидирует данные для генерации артикула
 */
export function validateProductData(product: ProductData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!product.name?.trim()) {
    errors.push('Название товара обязательно');
  }

  if (!product.dimensions?.length || !product.dimensions?.width) {
    errors.push('Длина и ширина обязательны');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Предварительный просмотр артикула (для отображения в UI)
 */
export function previewArticle(product: Partial<ProductData>): string {
  // Заполняем отсутствующие поля значениями по умолчанию для предварительного просмотра
  const defaultProduct: ProductData = {
    name: product.name || 'ТОВАР',
    dimensions: product.dimensions || { length: 0, width: 0, thickness: 0 },
    material: product.material,
    pressType: product.pressType || 'not_selected',
    surfaces: product.surfaces || [],
    borderType: product.borderType || 'without_border',
    carpetEdgeType: product.carpetEdgeType || 'straight_cut',
    carpetEdgeSides: product.carpetEdgeSides || 1,
    carpetEdgeStrength: product.carpetEdgeStrength || 'normal',
    puzzleType: product.puzzleType,
    bottomType: product.bottomType,
    grade: product.grade || 'usual'
  };

  return generateArticle(defaultProduct);
}
