import React from 'react';
import { InputNumber, InputNumberProps } from 'antd';

interface RussianInputNumberProps extends Omit<InputNumberProps, 'formatter' | 'parser'> {
  /** Количество знаков после запятой (по умолчанию 2) */
  precision?: number;
  /** Отображать символ валюты */
  showCurrency?: boolean;
  /** Настраиваемый суффикс */
  customSuffix?: string;
}

/**
 * InputNumber компонент с русской локализацией
 * - Поддерживает точку и запятую как десятичный разделитель
 * - Отображает числа в российском формате: 1 234,56
 * - Строгая точность для денежных значений
 */
const RussianInputNumber: React.FC<RussianInputNumberProps> = ({
  precision = 2,
  showCurrency = false,
  customSuffix,
  step = 0.01,
  ...props
}) => {
  // Функция для форматирования числа в российском стиле
  const formatter = (value: number | string | undefined): string => {
    if (value === undefined || value === null || value === '') {
      return '';
    }

    let numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return '';
    }

    // Округляем до нужной точности
    numValue = Math.round(numValue * Math.pow(10, precision)) / Math.pow(10, precision);
    
    // Разделяем на целую и дробную части
    const parts = numValue.toFixed(precision).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    // Форматируем целую часть с пробелами для тысяч
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    // Собираем результат
    let result = precision > 0 && decimalPart && decimalPart !== '0'.repeat(precision)
      ? `${formattedInteger},${decimalPart}`
      : formattedInteger;

    if (showCurrency) {
      result = `${result} ₽`;
    } else if (customSuffix) {
      result = `${result} ${customSuffix}`;
    }

    return result;
  };

  // Функция для парсинга введенного значения
  const parser = (value: string | undefined): string => {
    if (!value) return '';
    
    // Убираем все, кроме цифр, точек, запятых и знака минус
    let cleanValue = value.replace(/[^\d.,-]/g, '');
    
    // Заменяем запятую на точку для парсинга
    cleanValue = cleanValue.replace(',', '.');
    
    // Убираем пробелы (разделители тысяч)
    cleanValue = cleanValue.replace(/\s/g, '');
    
    // Парсим как число
    const parsed = parseFloat(cleanValue);
    
    return isNaN(parsed) ? '' : parsed.toString();
  };

  return (
    <InputNumber
      {...props}
      step={step}
      precision={precision}
      formatter={formatter}
      parser={parser}
    />
  );
};

export default RussianInputNumber;
