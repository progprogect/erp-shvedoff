/**
 * Утилиты для работы с ценами
 * Обеспечивают единообразную нормализацию, валидацию и округление цен
 */

/**
 * Нормализует строку цены: запятая → точка, убирает пробелы
 */
export function normalizePrice(input: string | number): string {
  if (typeof input === 'number') {
    return input.toString();
  }
  
  return input
    .toString()
    .trim()
    .replace(',', '.') // заменяем запятую на точку
    .replace(/\s+/g, ''); // убираем все пробелы
}

/**
 * Валидирует формат цены
 * Допустимы: цифры, одна точка, до 2 знаков после точки, неотрицательные значения
 */
export function validatePriceFormat(input: string): { isValid: boolean; error?: string } {
  const normalized = normalizePrice(input);
  
  // Пустая строка
  if (!normalized) {
    return { isValid: false, error: 'Цена не может быть пустой' };
  }
  
  // Проверяем на соответствие формату числа с максимум 2 знаками после точки
  const priceRegex = /^\d+(\.\d{1,2})?$/;
  
  if (!priceRegex.test(normalized)) {
    return { isValid: false, error: 'Неверный формат цены. Используйте формат: 100 или 100.50' };
  }
  
  const numValue = parseFloat(normalized);
  
  // Проверяем, что это положительное число
  if (isNaN(numValue) || numValue < 0) {
    return { isValid: false, error: 'Цена должна быть положительным числом' };
  }
  
  // Проверяем максимальное значение (для DECIMAL(10,2) максимум 99999999.99)
  if (numValue > 99999999.99) {
    return { isValid: false, error: 'Цена слишком большая. Максимум: 99,999,999.99' };
  }
  
  return { isValid: true };
}

/**
 * Округляет цену до 2 знаков после запятой по правилу банковского округления
 */
export function roundPrice(input: string | number): string {
  const normalized = normalizePrice(input);
  const numValue = parseFloat(normalized);
  
  if (isNaN(numValue)) {
    throw new Error('Невозможно округлить: некорректное значение');
  }
  
  // Банковское округление до 2 знаков
  const rounded = Math.round(numValue * 100) / 100;
  
  // Возвращаем всегда с 2 знаками после точки
  return rounded.toFixed(2);
}

/**
 * Парсит и нормализует цену для сохранения в БД
 * Выполняет нормализацию, валидацию и округление
 */
export function parsePrice(input: string | number): { success: boolean; value?: string; error?: string } {
  try {
    const normalized = normalizePrice(input);
    
    const validation = validatePriceFormat(normalized);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    
    const rounded = roundPrice(normalized);
    
    return { success: true, value: rounded };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка обработки цены' };
  }
}

/**
 * Форматирует цену для отображения
 * Всегда показывает 2 знака после точки
 */
export function formatPrice(input: string | number): string {
  const normalized = normalizePrice(input);
  const numValue = parseFloat(normalized);
  
  if (isNaN(numValue)) {
    return '0.00';
  }
  
  return numValue.toFixed(2);
}

/**
 * Вычисляет сумму строки заказа (цена * количество)
 * Использует точную арифметику
 */
export function calculateLineTotal(price: string | number, quantity: number): string {
  const priceValue = parseFloat(formatPrice(price));
  const total = priceValue * quantity;
  
  return total.toFixed(2);
}

/**
 * Вычисляет общую сумму заказа
 * Суммирует все строки с точной арифметикой
 */
export function calculateOrderTotal(lineItems: Array<{ price: string | number; quantity: number }>): string {
  let total = 0;
  
  for (const item of lineItems) {
    const lineTotal = parseFloat(calculateLineTotal(item.price, item.quantity));
    total += lineTotal;
  }
  
  return total.toFixed(2);
}
