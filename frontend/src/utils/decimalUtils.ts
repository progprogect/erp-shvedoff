/**
 * Утилиты для работы с дробными значениями количества
 * Поддержка ввода через точку и запятую
 */

/**
 * Нормализует ввод пользователя для дробных значений
 * Конвертирует запятую в точку и обеспечивает правильное форматирование
 */
export function normalizeDecimalInput(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  // Конвертируем в строку
  const stringValue = String(value);
  
  // Заменяем запятую на точку
  const normalizedString = stringValue.replace(',', '.');
  
  // Парсим как число
  const parsedValue = parseFloat(normalizedString);
  
  // Проверяем на валидность
  if (isNaN(parsedValue) || parsedValue < 0) {
    return 0;
  }
  
  // Округляем до 2 знаков после запятой
  return Math.round(parsedValue * 100) / 100;
}

/**
 * Форматирует число для отображения
 * Целые числа без .00, дробные с нужной точностью
 */
export function formatQuantityDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) {
    return '0';
  }

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
 * Форматирует количество для артикула
 * Целые числа без .00, дробные с точностью
 */
export function formatQuantityForArticle(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) {
    return '0';
  }

  return formatQuantityDisplay(value);
}

/**
 * Валидирует дробное значение количества
 */
export function validateQuantity(value: number): { isValid: boolean; error?: string } {
  if (isNaN(value) || value < 0.01) {
    return {
      isValid: false,
      error: 'Количество должно быть не менее 0.01'
    };
  }

  if (value > 9999999.99) {
    return {
      isValid: false,
      error: 'Количество не может превышать 9999999.99'
    };
  }

  // Проверяем, что не более 2 знаков после запятой
  const decimals = (value.toString().split('.')[1] || '').length;
  if (decimals > 2) {
    return {
      isValid: false,
      error: 'Количество может иметь не более 2 знаков после запятой'
    };
  }

  return { isValid: true };
}
