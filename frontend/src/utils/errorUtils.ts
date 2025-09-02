/**
 * Утилиты для унифицированной обработки ошибок API
 * Дата создания: 2025-01-20
 * 
 * Основные принципы:
 * - Backward compatibility с существующими форматами
 * - Русскоязычные сообщения
 * - Подсветка полей форм при ошибках валидации
 * - Централизованная логика извлечения сообщений
 */

import { message } from 'antd';
import { FormInstance } from 'antd/es/form';

// Типизация структуры ошибки API
export interface ApiError {
  response?: {
    status?: number;
    data?: {
      // Новый формат (через errorHandler middleware)
      error?: {
        message: string;
        statusCode: number;
        timestamp: string;
        path: string;
        method: string;
      };
      // Старый формат (для обратной совместимости)
      message?: string;
      success?: boolean;
    };
  };
  message?: string;
}

// Типизация поля формы для подсветки ошибок
export interface FormFieldError {
  name: string | string[];
  errors: string[];
}

/**
 * Извлекает сообщение об ошибке из различных форматов API ответов
 * Поддерживает backward compatibility с существующими форматами
 */
export function extractErrorMessage(error: ApiError): string {
  // Сначала пробуем новый формат (через errorHandler)
  if (error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  
  // Fallback к старому формату API
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  // Fallback к основному сообщению ошибки
  if (error.message) {
    return error.message;
  }
  
  // Generic fallback с информацией о статусе
  const statusCode = error.response?.status;
  if (statusCode) {
    return `Ошибка сервера (${statusCode}). Попробуйте позже или обратитесь к администратору.`;
  }
  
  return 'Ошибка связи с сервером. Проверьте интернет-соединение.';
}

/**
 * Определяет тип ошибки для специальной обработки
 */
export function getErrorType(error: ApiError): 'validation' | 'duplicate' | 'not_found' | 'permission' | 'server' | 'network' {
  const message = extractErrorMessage(error);
  const statusCode = error.response?.status;
  
  // Ошибки валидации (400)
  if (statusCode === 400) {
    if (message.includes('уже существует') || message.includes('already exists')) {
      return 'duplicate';
    }
    return 'validation';
  }
  
  // Ошибки доступа
  if (statusCode === 401 || statusCode === 403) {
    return 'permission';
  }
  
  // Ресурс не найден
  if (statusCode === 404) {
    return 'not_found';
  }
  
  // Серверные ошибки
  if (statusCode && statusCode >= 500) {
    return 'server';
  }
  
  // Сетевые ошибки (нет статуса)
  if (!statusCode) {
    return 'network';
  }
  
  return 'server';
}

/**
 * Показывает уведомление об ошибке с правильным типом и форматированием
 */
export function showErrorNotification(error: ApiError, options?: {
  duration?: number;
  key?: string;
}): void {
  const errorMessage = extractErrorMessage(error);
  const errorType = getErrorType(error);
  
  const config = {
    content: errorMessage,
    duration: options?.duration || 6, // Чуть дольше для чтения подробных сообщений
    key: options?.key,
  };
  
  switch (errorType) {
    case 'validation':
    case 'duplicate':
      message.warning(config);
      break;
      
    case 'permission':
      message.error({
        ...config,
        content: `🔒 ${errorMessage}`,
      });
      break;
      
    case 'not_found':
      message.warning({
        ...config,
        content: `❓ ${errorMessage}`,
      });
      break;
      
    case 'network':
      message.error({
        ...config,
        content: `🌐 ${errorMessage}`,
      });
      break;
      
    case 'server':
    default:
      message.error(config);
      break;
  }
}

/**
 * Подсвечивает поле формы красным с сообщением об ошибке
 */
export function highlightFormField(
  form: FormInstance,
  fieldName: string | string[],
  errorMessage: string
): void {
  form.setFields([{
    name: fieldName,
    errors: [errorMessage]
  }]);
}

/**
 * Определяет поле формы для подсветки на основе сообщения об ошибке
 */
export function getFieldNameFromError(errorMessage: string): string | null {
  const message = errorMessage.toLowerCase();
  
  // Артикул
  if (message.includes('артикул') || message.includes('article')) {
    return 'article';
  }
  
  // Название
  if (message.includes('название') || message.includes('name')) {
    return 'name';
  }
  
  // Email
  if (message.includes('email') || message.includes('почта')) {
    return 'email';
  }
  
  // Телефон
  if (message.includes('телефон') || message.includes('phone')) {
    return 'phone';
  }
  
  // Цена
  if (message.includes('цена') || message.includes('price')) {
    return 'price';
  }
  
  // Количество
  if (message.includes('количество') || message.includes('quantity')) {
    return 'quantity';
  }
  
  // Категория
  if (message.includes('категор') || message.includes('category')) {
    return 'categoryId';
  }
  
  return null;
}

/**
 * Комбинированная функция для полной обработки ошибки:
 * - Показывает уведомление
 * - Подсвечивает поле формы (если возможно)
 * - Логирует в консоль для debugging
 */
export function handleFormError(
  error: ApiError, 
  form?: FormInstance,
  options?: {
    fieldName?: string | string[];
    duration?: number;
    key?: string;
    logToConsole?: boolean;
  }
): void {
  const errorMessage = extractErrorMessage(error);
  const errorType = getErrorType(error);
  
  // Логирование для debugging (по умолчанию включено)
  if (options?.logToConsole !== false) {
    console.error('🚨 Form Error:', {
      message: errorMessage,
      type: errorType,
      status: error.response?.status,
      url: error.response?.data?.error?.path,
      timestamp: new Date().toISOString(),
      fullError: error
    });
  }
  
  // Показываем уведомление
  showErrorNotification(error, {
    duration: options?.duration,
    key: options?.key
  });
  
  // Подсвечиваем поле формы
  if (form) {
    let fieldName = options?.fieldName;
    
    // Автоматическое определение поля, если не указано
    if (!fieldName) {
      const autoDetectedField = getFieldNameFromError(errorMessage);
      if (autoDetectedField) {
        fieldName = autoDetectedField;
      }
    }
    
    if (fieldName) {
      highlightFormField(form, fieldName, errorMessage);
    }
  }
}

/**
 * Предопределенные сообщения для частых ошибок
 * Можно расширять по мере необходимости
 */
export const ERROR_MESSAGES = {
  NETWORK: 'Ошибка связи с сервером. Проверьте интернет-соединение.',
  SERVER: 'Внутренняя ошибка сервера. Попробуйте позже или обратитесь к администратору.',
  VALIDATION: 'Проверьте правильность заполнения полей формы.',
  PERMISSION: 'У вас недостаточно прав для выполнения данного действия.',
  NOT_FOUND: 'Запрашиваемый ресурс не найден.',
  DUPLICATE: 'Запись с такими данными уже существует.',
  
  // Специфичные для товаров
  PRODUCT_ARTICLE_DUPLICATE: 'Товар с таким артикулом уже существует. Выберите другой артикул.',
  PRODUCT_NAME_REQUIRED: 'Название товара обязательно для заполнения.',
  PRODUCT_CATEGORY_REQUIRED: 'Выберите категорию товара.',
  
  // Специфичные для заказов
  ORDER_ITEMS_REQUIRED: 'Добавьте хотя бы один товар в заказ.',
  ORDER_CUSTOMER_REQUIRED: 'Укажите информацию о заказчике.',
  
  // Специфичные для пользователей
  USER_EMAIL_DUPLICATE: 'Пользователь с таким email уже существует.',
  USER_USERNAME_DUPLICATE: 'Пользователь с таким логином уже существует.',
} as const;

/**
 * Хелпер для быстрого показа предопределенных сообщений
 */
export function showPredefinedError(
  messageKey: keyof typeof ERROR_MESSAGES,
  options?: {
    duration?: number;
    key?: string;
  }
): void {
  message.error({
    content: ERROR_MESSAGES[messageKey],
    duration: options?.duration || 6,
    key: options?.key,
  });
}
