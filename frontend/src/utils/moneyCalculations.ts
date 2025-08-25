/**
 * Утилиты для точных расчетов с денежными суммами
 * Избегает проблем с плавающей точкой в JavaScript
 */

/**
 * Умножение с точностью до копеек
 */
export const multiplyMoney = (price: number, quantity: number): number => {
  // Приводим к копейкам, умножаем, затем делим обратно
  const priceInCents = Math.round(price * 100);
  const totalInCents = priceInCents * quantity;
  return totalInCents / 100;
};

/**
 * Сложение денежных сумм с точностью до копеек
 */
export const addMoney = (...amounts: number[]): number => {
  const totalInCents = amounts.reduce((sum, amount) => {
    return sum + Math.round(amount * 100);
  }, 0);
  return totalInCents / 100;
};

/**
 * Вычитание денежных сумм с точностью до копеек
 */
export const subtractMoney = (amount1: number, amount2: number): number => {
  const amount1InCents = Math.round(amount1 * 100);
  const amount2InCents = Math.round(amount2 * 100);
  return (amount1InCents - amount2InCents) / 100;
};

/**
 * Форматирование денежной суммы в российском стиле
 * Возвращает строку вида "1 234,56 ₽"
 */
export const formatMoney = (amount: number, showCurrency: boolean = true): string => {
  // Округляем до копеек
  const roundedAmount = Math.round(amount * 100) / 100;
  
  // Разделяем на целую и дробную части
  const parts = roundedAmount.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Форматируем целую часть с пробелами для тысяч
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  // Собираем результат
  const formattedNumber = `${formattedInteger},${decimalPart}`;
  
  return showCurrency ? `${formattedNumber} ₽` : formattedNumber;
};

/**
 * Форматирование числа в российском стиле (для веса, размеров и т.д.)
 * Возвращает строку вида "1 234,56"
 */
export const formatNumber = (value: number, precision: number = 2): string => {
  // Округляем до нужной точности
  const roundedValue = Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
  
  // Разделяем на целую и дробную части
  const parts = roundedValue.toFixed(precision).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Форматируем целую часть с пробелами для тысяч
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  // Собираем результат
  if (precision > 0 && decimalPart && decimalPart !== '0'.repeat(precision)) {
    return `${formattedInteger},${decimalPart}`;
  } else {
    return formattedInteger;
  }
};

/**
 * Парсинг российского формата числа в number
 * Принимает строки вида "1 234,56" или "1,234.56" или "1234.56"
 */
export const parseRussianNumber = (value: string): number => {
  if (!value || typeof value !== 'string') return 0;
  
  // Убираем все, кроме цифр, точек, запятых и знака минус
  let cleanValue = value.replace(/[^\d.,-]/g, '');
  
  // Определяем, что является десятичным разделителем
  // Если есть и точка, и запятая, то последняя - десятичный разделитель
  const lastComma = cleanValue.lastIndexOf(',');
  const lastDot = cleanValue.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    // Запятая является десятичным разделителем
    cleanValue = cleanValue.substring(0, lastComma).replace(/[,.]/g, '') + '.' + cleanValue.substring(lastComma + 1);
  } else if (lastDot > lastComma) {
    // Точка является десятичным разделителем
    cleanValue = cleanValue.substring(0, lastDot).replace(/[,.]/g, '') + '.' + cleanValue.substring(lastDot + 1);
  } else {
    // Нет десятичного разделителя или только один тип
    cleanValue = cleanValue.replace(/,/g, '.');
    cleanValue = cleanValue.replace(/\s/g, '');
  }
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
};
