/**
 * Утилиты для автогенерации артикула товара
 * Формат для ковровых изделий: [Название] - [Размеры] - [Поверхности] - [Лого] - [Низ] - [Края] - [Доп.характеристики] - [Сорт]
 * Пример: "Лежак - 1200x800x12 - Чеш - GEA - 3Кор - Край4ст - СБорт,НеУсил - 1С"
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
  logo?: {
    name: string;
  };
  bottomType?: {
    code?: string;
  };
  composition?: Array<{
    carpetId: number;
    quantity: number;
    sortOrder: number;
  }>;
  grade?: string; // 🔥 НОВОЕ: сорт товара для рулонных покрытий
}

/**
 * Генерирует артикул на основе характеристик товара для ковровых изделий
 * Формат: [Название] - [Размеры] - [Поверхности] - [Лого] - [Низ] - [Края] - [Доп.характеристики] - [Сорт]
 */
export function generateArticle(product: ProductData): string {
  const parts: string[] = [];

  // 1. НАЗВАНИЕ (краткое)
  const namePart = formatName(product.name);
  if (namePart) parts.push(namePart);

  // 2. РАЗМЕРЫ (длина x ширина x высота)
  const dimensionsPart = formatDimensions(product.dimensions);
  if (dimensionsPart) parts.push(dimensionsPart);

  // 3. ПОВЕРХНОСТИ (краткие коды через +)
  const surfacesPart = formatSurfaces(product.surfaces);
  if (surfacesPart) parts.push(surfacesPart);

  // 4. ЛОГОТИП (краткий код, только если выбран)
  const logoPart = formatLogo(product.logo?.name);
  if (logoPart) parts.push(logoPart);

  // 5. НИЗ КОВРА (краткий код, только если выбран)
  const bottomPart = formatBottom(product.bottomType?.code);
  if (bottomPart) parts.push(bottomPart);

  // 6. КРАЯ (тип + стороны + пазл, только если не литой)
  const edgePart = formatEdge(
    product.carpetEdgeType,
    product.carpetEdgeSides,
    product.carpetEdgeStrength,
    product.puzzleType
  );
  if (edgePart) parts.push(edgePart);

  // 7. ДОПОЛНИТЕЛЬНЫЕ ХАРАКТЕРИСТИКИ (борт, усиление, пресс, материал через запятую)
  const additionalPart = formatAdditionalCharacteristics(
    product.borderType,
    product.carpetEdgeStrength,
    product.pressType,
    product.material?.name
  );
  if (additionalPart) parts.push(additionalPart);

  // 8. СОРТ (только если не обычный)
  const gradePart = formatGrade(product.grade);
  if (gradePart) parts.push(gradePart);

  return parts.join(' - ');
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

  // По умолчанию берем первое слово с заглавной буквы
  const firstWord = name.split(' ')[0];
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

/**
 * Форматирует размеры: LENGTH x WIDTH x HEIGHT
 */
function formatDimensions(dimensions: { length?: number; width?: number; thickness?: number; height?: number }): string {
  if (!dimensions) return '';

  const { length, width, thickness, height } = dimensions;
  const parts = [];

  if (length) parts.push(length.toString());
  if (width) parts.push(width.toString());
  // Используем height или thickness (для совместимости)
  const heightValue = height || thickness;
  if (heightValue) parts.push(heightValue.toString());

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
 * Форматирует поверхности (множественный выбор через +)
 */
function formatSurfaces(surfaces?: Array<{ name: string }>): string {
  if (!surfaces || surfaces.length === 0) return '';

  const surfaceMap: Record<string, string> = {
    'чешуйки': 'Чеш',
    'черточки': 'Черт',
    'гладкая': 'Глад',
    '1 коровка': '1Кор',
    '3 коровки': '3Кор',
    'чешуйка с лого': 'ЧешЛого'
  };

  const formattedSurfaces = surfaces.map(surface => {
    const normalized = surface.name.toLowerCase();
    return surfaceMap[normalized] || surface.name;
  });

  return formattedSurfaces.join('+');
}

/**
 * Форматирует логотип
 */
function formatLogo(logoName?: string): string {
  if (!logoName) return '';

  const logoMap: Record<string, string> = {
    'gea': 'GEA',
    'maximilk': 'Max', 
    'veles': 'VEL',
    'агротек': 'Агр',
    'арнтьен': 'Арн'
  };

  const normalized = logoName.toLowerCase().trim();
  
  // Сначала пытаемся найти точное совпадение
  if (logoMap[normalized]) {
    return logoMap[normalized];
  }
  
  // Если не найдено, ищем частичное совпадение (содержит)
  for (const [key, value] of Object.entries(logoMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  // Если ничего не найдено, возвращаем сокращенную версию оригинального названия
  // Для русских названий берем первые 3 символа, для английских - как есть если короткие
  if (/[а-яё]/i.test(logoName)) {
    return logoName.slice(0, 3).toUpperCase();
  } else {
    return logoName.length <= 4 ? logoName.toUpperCase() : logoName.slice(0, 4).toUpperCase();
  }
}

/**
 * Форматирует борт
 */
function formatBorder(borderType?: string): string {
  return borderType === 'with_border' ? 'СБорт' : '';
}

/**
 * Форматирует дополнительные характеристики (борт, усиление, пресс, материал)
 */
function formatAdditionalCharacteristics(
  borderType?: string,
  edgeStrength?: string,
  pressType?: string,
  material?: string
): string {
  const characteristics: string[] = [];

  // Борт (только если с бортом)
  if (borderType === 'with_border') {
    characteristics.push('СБорт');
  }

  // Усиление (только если не усиленный)
  if (edgeStrength === 'weak') {
    characteristics.push('НеУсил');
  }

  // Пресс (только если выбран)
  if (pressType && pressType !== 'not_selected') {
    const pressMap: Record<string, string> = {
      'ukrainian': 'УкрПресс',
      'chinese': 'КитПресс'
    };
    const pressCode = pressMap[pressType];
    if (pressCode) characteristics.push(pressCode);
  }

  // Материал (только если выбран)
  if (material) {
    const materialMap: Record<string, string> = {
      'дробленка': 'Дроб',
      'протектор': 'Прот'
    };
    const normalizedMaterial = material.toLowerCase();
    const materialCode = materialMap[normalizedMaterial] || material;
    characteristics.push(materialCode);
  }

  return characteristics.length > 0 ? characteristics.join(',') : '';
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

  const edgePrefix = edgeMap[edgeType] || edgeType;
  if (edgePrefix) parts.push(edgePrefix);

  // Количество сторон (для всех краев кроме литого)
  if (sides && edgeType !== 'straight_cut') {
    parts.push(`${sides}ст`);
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

  return parts.join('');
}

/**
 * Форматирует низ ковра
 */
function formatBottom(bottomCode?: string): string {
  if (!bottomCode || bottomCode.trim() === '') return '';
  
  // Преобразуем коды в краткие обозначения
  const codeMap: Record<string, string> = {
    'not_selected': '', // Не выбрано - не отображаем в артикуле
    'spike_0': 'Шип0', // Шип-0 - отображаем как Шип0
    'spike_1': 'Шип1',
    'spike_2': 'Шип2',
    'spike_3': 'Шип3',
    'spike_4': 'Шип4',
    'spike_5': 'Шип5',
    'spike_7': 'Шип7',
    'spike_11': 'Шип11'
  };
  
  const normalizedCode = bottomCode.toLowerCase().trim();
  return codeMap[normalizedCode] || '';
}

/**
 * Форматирует сорт товара
 */
function formatGrade(grade?: string): string {
  const gradeMap: Record<string, string> = {
    'usual': '', // Обычный не указываем в артикуле
    'grade_2': '2СОРТ',
    'telyatnik': 'Телят',
    'liber': 'Либер'
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
 * Формат: [Название] - [Размеры] - [Поверхности] - [Логотип] - [Низ] - [Количество ковров] - [Сорт]
 * Пример: "Покрытие - 1500x10000x3 - Глад - GEA - 0Шип - 2Ковр - 2СОРТ"
 */
export function generateRollCoveringArticle(productData: RollCoveringData): string {
  const parts: string[] = [];
  
  // 1. Название (краткое)
  const namePart = formatRollName(productData.name);
  if (namePart) parts.push(namePart);
  
  // 2. Размеры: {ширина}x{длина}x{толщина}
  const dimensionsPart = formatRollDimensions(productData.dimensions);
  if (dimensionsPart) parts.push(dimensionsPart);
  
  // 3. Поверхности (краткие коды через +)
  const surfaceCode = formatRollSurfaces(productData.surfaces);
  if (surfaceCode) parts.push(surfaceCode);
  
  // 4. ЛОГОТИП (краткий код, только если выбран)
  const logoPart = formatLogo(productData.logo?.name);
  if (logoPart) parts.push(logoPart);
  
  // 5. Низ ковра (краткие коды)
  const bottomCode = formatRollBottom(productData.bottomType);
  if (bottomCode) parts.push(bottomCode);
  
  // 6. Количество ковров в составе
  const compositionCode = formatRollComposition(productData.composition);
  if (compositionCode) parts.push(compositionCode);
  
  // 7. СОРТ (только если не обычный) - 🔥 НОВОЕ
  const gradePart = formatGrade(productData.grade);
  if (gradePart) parts.push(gradePart);
  
  return parts.join(' - ');
}

/**
 * Форматирует название для рулонных покрытий
 */
function formatRollName(name: string): string {
  if (!name) return '';

  // Для рулонных покрытий используем краткое название
  const firstWord = name.split(' ')[0];
  
  // Сокращения для типичных рулонных покрытий
  const rollMappings: Record<string, string> = {
    'рулонное': 'Покрытие',
    'покрытие': 'Покрытие',
    'линолеум': 'Линолеум',
    'ковролин': 'Ковролин',
    'паркет': 'Паркет',
    'ламинат': 'Ламинат',
    'антискольз': 'Антискольз',
    'резиновое': 'Резиновое'
  };

  const normalized = firstWord.toLowerCase();
  return rollMappings[normalized] || firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

/**
 * Форматирует размеры для рулонных покрытий (только если заполнены)
 */
function formatRollDimensions(dimensions?: { length?: number; width?: number; thickness?: number }): string {
  if (!dimensions) return '';
  
  const { length = 0, width = 0, thickness = 0 } = dimensions;
  
  // Показываем размеры только если хотя бы один из них больше 0
  if (length > 0 || width > 0 || thickness > 0) {
    return `${length}x${width}x${thickness}`;
  }
  
  return '';
}

/**
 * Форматирует поверхности для рулонных покрытий (используем те же коды что и для ковров)
 */
function formatRollSurfaces(surfaces?: Array<{ name: string }>): string {
  if (!surfaces || surfaces.length === 0) return '';
  
  // Используем те же краткие коды что и для ковровых изделий
  const surfaceMappings: { [key: string]: string } = {
    'чешуйки': 'Чеш',
    'черточки': 'Черт',
    'гладкая': 'Глад',
    '1 коровка': '1Кор',
    '3 коровки': '3Кор',
    'чешуйка с лого': 'ЧешЛого'
  };
  
  const formattedSurfaces = surfaces.map(surface => {
    const normalized = surface.name.toLowerCase().trim();
    return surfaceMappings[normalized] || surface.name;
  });
  
  // Объединяем поверхности через + (как у ковров)
  return formattedSurfaces.join('+');
}

/**
 * Форматирует низ ковра для рулонных покрытий (аналогично ковровым изделиям)
 */
function formatRollBottom(bottomType?: { code?: string }): string {
  if (!bottomType?.code) return '';
  
  // Используем ту же логику что и для ковровых изделий
  return formatBottom(bottomType.code);
}

/**
 * Форматирует количество для отображения в артикуле
 * Целые числа без .00, дробные с нужной точностью
 */
function formatQuantityForArticle(value: number): string {
  if (value === 0) return '0';
  
  // Округляем до 2 знаков после запятой
  const rounded = Math.round(value * 100) / 100;
  
  // Если целое число, показываем без десятичных знаков
  if (rounded % 1 === 0) {
    return rounded.toString();
  }
  
  // Иначе показываем с нужной точностью (убираем лишние нули)
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Форматирует состав рулонного покрытия (количество ковров)
 * 🔥 ОБНОВЛЕНО: поддержка дробных значений
 */
function formatRollComposition(composition?: Array<{ carpetId: number; quantity: number; sortOrder: number }>): string {
  if (!composition || composition.length === 0) return '';
  
  // Считаем общее количество ковров в составе
  const totalQuantity = composition.reduce((sum, item) => sum + item.quantity, 0);
  
  // Показываем количество ковров в формате "5Ковр" или "1.5Ковр"
  return totalQuantity > 0 ? `${formatQuantityForArticle(totalQuantity)}Ковр` : '';
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
    logo: productData.logo, // 🔥 НОВОЕ: добавляем логотип
    bottomType: productData.bottomType,
    composition: productData.composition || []
  };
  
  return generateRollCoveringArticle(defaultData);
}
