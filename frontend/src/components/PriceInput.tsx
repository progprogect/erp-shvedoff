import React, { useState, useEffect } from 'react';
import { InputNumber, InputNumberProps } from 'antd';
import { normalizePrice, validatePriceFormat, formatPrice, parsePriceInput } from '../utils/priceUtils';

interface PriceInputProps extends Omit<InputNumberProps, 'value' | 'onChange' | 'formatter' | 'parser'> {
  value?: number | string;
  onChange?: (value: number | null) => void;
  currency?: string;
  allowEmpty?: boolean;
}

/**
 * Компонент для ввода цен с автоматической нормализацией и валидацией
 * - Автоматически заменяет запятую на точку
 * - Валидирует формат (только 2 знака после точки)
 * - Показывает цену с валютой
 * - Поддерживает копирование и вставку с запятой
 */
const PriceInput: React.FC<PriceInputProps> = ({
  value,
  onChange,
  currency = '₽',
  allowEmpty = true,
  ...props
}) => {
  const [error, setError] = useState<string | undefined>();

  // Нормализуем входное значение
  const normalizedValue = React.useMemo(() => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    
    const stringValue = value.toString();
    const normalized = normalizePrice(stringValue);
    return parseFloat(normalized) || undefined;
  }, [value]);

  // Валидация при изменении значения
  const handleChange = (newValue: number | null) => {
    setError(undefined);
    
    if (newValue === null || newValue === undefined) {
      if (allowEmpty) {
        onChange?.(null);
        return;
      } else {
        setError('Цена обязательна');
        return;
      }
    }

    // Валидируем формат
    const validation = validatePriceFormat(newValue.toString());
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    onChange?.(newValue);
  };

  // Обработка вставки текста (например, с запятой)
  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedData = e.clipboardData.getData('text');
    if (pastedData.includes(',')) {
      e.preventDefault();
      const normalized = normalizePrice(pastedData);
      const numValue = parseFloat(normalized);
      if (!isNaN(numValue)) {
        handleChange(numValue);
      }
    }
  };

  // Форматтер для отображения
  const formatter = (val: number | undefined): string => {
    if (val === undefined || val === null || isNaN(val)) {
      return '';
    }
    
    // Форматируем с валютой и разделителями тысяч
    const formatted = val.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `${formatted} ${currency}`;
  };

  // Парсер для извлечения числа из отформатированной строки
  const parser = (val: string | undefined): number => {
    if (!val) return 0;
    return parsePriceInput(val);
  };

  return (
    <InputNumber
      {...props}
      value={normalizedValue}
      onChange={handleChange}
      onPaste={handlePaste}
      formatter={formatter}
      parser={parser}
      precision={2}
      min={0}
      max={99999999.99}
      step={0.01}
      status={error ? 'error' : undefined}
      style={{
        width: '100%',
        ...props.style
      }}
    />
  );
};

export default PriceInput;
