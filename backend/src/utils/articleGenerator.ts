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
  logo?: {
    name: string;
  };
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

export interface RollCoveringData {
  name: string;
  dimensions?: {
    length?: number;
    width?: number;
    thickness?: number;
  };
  surfaces?: Array<{
    name: string;
  }>;
  bottomType?: {
    code?: string;
  };
  composition?: Array<{
    carpetId: number;
    quantity: number;
    sortOrder: number;
  }>;
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

  // 6. ЛОГОТИП (только если выбран)
  const logoPart = formatLogo(product.logo?.name);
  if (logoPart) parts.push(logoPart);

  // 7. БОРТ (только если "с бортом")
  const borderPart = formatBorder(product.borderType);
  if (borderPart) parts.push(borderPart);

  // 8. КРАЙ
  const edgePart = formatEdge(
    product.carpetEdgeType,
    product.carpetEdgeSides,
    product.carpetEdgeStrength,
    product.puzzleType
  );
  if (edgePart) parts.push(edgePart);

  // 9. НИЗ
  const bottomPart = formatBottom(product.bottomType?.code);
  if (bottomPart) parts.push(bottomPart);

  // 10. СОРТ (кроме "usual")
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

  // Мапинг для сокращений материалов
  const materialMap: Record<string, string> = {
    'резина': 'РЕЗ',
    'каучук': 'КАУ',
    'gea': 'GEA',
    'дробленка': 'ДРОБ',
    'протектор': 'ПРОТ',
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
 * Форматирует логотип
 */
function formatLogo(logoName?: string): string {
  if (!logoName) return '';

  const logoMap: Record<string, string> = {
    'gea': 'GEA',
    'maximilk': 'MAX',
    'veles': 'VEL',
    'агротек': 'АГР',
    'арнтьен': 'АРН',
    'shvedoff': 'ШВЕ'
  };

  const normalized = logoName.toLowerCase();
  return logoMap[normalized] || logoName.toUpperCase().substring(0, 3);
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
    'cast_puzzle': 'ЛитПазл',
    // Backward compatibility for old enum values
    'podpuzzle': 'Подпазл',
    'litoy_puzzle': 'ЛитПазл'
  };

  // Для типа "Пазл" сначала добавляем тип пазла
  if (edgeType === 'puzzle' && puzzleType?.name) {
    const puzzleMap: Record<string, string> = {
      'старый': 'Стар',
      'новый': 'Нов'
    };
    const puzzleName = puzzleType.name.toLowerCase();
    const puzzleSuffix = puzzleMap[puzzleName] || puzzleType.name;
    parts.push(puzzleSuffix);
  }

  // Количество сторон (для краев которые требуют выбора сторон)
  // Прямой рез применяется ко всем сторонам - стороны не указываем
  if (sides && edgeType !== 'direct_cut' && edgeType !== 'straight') {
    parts.push(`${sides}ст`);
  }

  // Тип края
  const edgePrefix = edgeMap[edgeType] || edgeType.toUpperCase();
  if (edgePrefix) parts.push(edgePrefix);

  // Усиление (только если не усиленный)
  if (strength === 'weak') {
    parts.push('Н/У');
  }
  // Усиленный по умолчанию - не показываем

  return parts.join('');
}

/**
 * Форматирует низ ковра
 */
function formatBottom(bottomCode?: string): string {
  if (!bottomCode) return '';
  
  // Преобразуем английские коды в русские
  const codeMap: Record<string, string> = {
    'spike_0': 'ШИП0',
    'spike_2': 'ШИП2',
    'spike_5': 'ШИП5',
    'spike_7': 'ШИП7',
    'spike_11': 'ШИП11'
  };
  
  const normalizedCode = bottomCode.toLowerCase();
  return codeMap[normalizedCode] || bottomCode.toUpperCase();
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

// ==================== РУЛОННЫЕ ПОКРЫТИЯ ====================

/**
 * Генерация артикула для рулонных покрытий
 * Формат: РУЛ-{НАЗВАНИЕ}-{ШИР}x{ДЛН}x{ВЫС}-{ПОВЕРХ}-{НИЗ}-{СОСТАВ}
 * Аналогично ковровым изделиям, но для рулонных покрытий
 */
export function generateRollCoveringArticle(productData: RollCoveringData): string {
  const parts: string[] = [];
  
  // 1. Префикс для рулонных покрытий (русскими буквами)
  parts.push('РУЛ');
  
  // 2. Название (сокращенно, как у ковров)
  const namePart = formatRollName(productData.name);
  if (namePart) parts.push(namePart);
  
  // 3. Размеры: {ШИР}x{ДЛН}x{ВЫС} (только если указаны)
  const dimensionsPart = formatRollDimensions(productData.dimensions);
  if (dimensionsPart) parts.push(dimensionsPart);
  
  // 4. Поверхности (русскими буквами, множественный выбор как у ковров)
  const surfaceCode = formatRollSurfaces(productData.surfaces);
  if (surfaceCode) parts.push(surfaceCode);
  
  // 5. Низ ковра (используем коды из справочника)
  const bottomCode = formatRollBottom(productData.bottomType);
  if (bottomCode) parts.push(bottomCode);
  
  // 6. Состав (количество ковров)
  const compositionCode = formatRollComposition(productData.composition);
  if (compositionCode) parts.push(compositionCode);
  
  return parts.join('-');
}

/**
 * Форматирует название для рулонных покрытий (аналогично ковровым)
 */
function formatRollName(name: string): string {
  if (!name) return '';

  // Специальные правила для "коровка" (аналогично ковровым изделиям)
  const lowerName = name.toLowerCase();
  
  // "коровка" → "1КОР"
  if (lowerName.includes('коровка') && !lowerName.match(/\d/)) {
    return '1КОР';
  }
  
  // "1 коровка" → "1КОР", "3 коровки" → "3КОР"
  const match1 = lowerName.match(/(\d+)\s*коровк[а-я]*/);
  if (match1) {
    return `${match1[1]}КОР`;
  }

  // Для рулонных покрытий берем первое слово в сокращенном виде
  const firstWord = name.split(' ')[0].toUpperCase();
  
  // Сокращения для типичных рулонных покрытий
  const rollMappings: Record<string, string> = {
    'РУЛОННОЕ': 'РУЛ',
    'ПОКРЫТИЕ': 'ПОКР',
    'ЛИНОЛЕУМ': 'ЛИН',
    'КОВРОЛИН': 'КОВР',
    'ПАРКЕТ': 'ПАРК',
    'ЛАМИНАТ': 'ЛАМ'
  };

  return rollMappings[firstWord] || firstWord.substring(0, 4);
}

/**
 * Форматирует размеры для рулонных покрытий (только если заполнены)
 */
function formatRollDimensions(dimensions?: { length?: number; width?: number; thickness?: number }): string {
  if (!dimensions) return '';
  
  const { length = 0, width = 0, thickness = 0 } = dimensions;
  
  // Показываем размеры только если хотя бы один из них больше 0
  if (length > 0 || width > 0 || thickness > 0) {
    return `${width}x${length}x${thickness}`;
  }
  
  return '';
}

/**
 * Форматирует поверхности для рулонных покрытий (множественный выбор, русскими буквами как у ковров)
 */
function formatRollSurfaces(surfaces?: Array<{ name: string }>): string {
  if (!surfaces || surfaces.length === 0) return '';
  
  // Используем те же русские коды что и для ковровых изделий
  const surfaceMappings: { [key: string]: string } = {
    'чешуйки': 'ЧЕШУЙ',
    'черточки': 'ЧЕРТ',
    'гладкая': 'ГЛАД',
    '1 коровка': '1КОР',
    '3 коровки': '3КОР',
    'чешуйка с лого': 'ЧЕШУЙ-ЛОГО'
  };
  
  const formattedSurfaces = surfaces.map(surface => {
    const normalized = surface.name.toLowerCase().trim();
    return surfaceMappings[normalized] || surface.name.toUpperCase().substring(0, 5);
  });
  
  // Объединяем поверхности через дефис (как у ковров)
  return formattedSurfaces.join('-');
}

/**
 * Форматирует низ ковра для рулонных покрытий
 */
function formatRollBottom(bottomType?: { code?: string }): string {
  if (!bottomType?.code) return '';
  
  // Используем коды из справочника низов (как они есть)
  return bottomType.code.toUpperCase();
}

/**
 * Форматирует состав рулонного покрытия
 */
function formatRollComposition(composition?: Array<{ carpetId: number; quantity: number; sortOrder: number }>): string {
  if (!composition || composition.length === 0) return '';
  
  // Считаем общее количество ковров в составе
  const totalQuantity = composition.reduce((sum, item) => sum + item.quantity, 0);
  
  // Показываем состав только если есть ковры
  return totalQuantity > 0 ? `СОСТАВ${totalQuantity}` : '';
}



/**
 * Предварительный просмотр артикула для рулонных покрытий
 */
export function previewRollCoveringArticle(productData: Partial<RollCoveringData>): string {
  const defaultData: RollCoveringData = {
    name: productData.name || '',
    dimensions: {
      width: productData.dimensions?.width || 0,
      length: productData.dimensions?.length || 0,
      thickness: productData.dimensions?.thickness || 0
    },
    surfaces: productData.surfaces,
    bottomType: productData.bottomType,
    composition: productData.composition || []
  };
  
  return generateRollCoveringArticle(defaultData);
}
