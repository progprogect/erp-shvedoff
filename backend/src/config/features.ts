// Конфигурация фича-флагов для ERP Shvedoff
// Дата: 2025-08-18

export interface FeatureFlags {
  edges_v2: boolean; // Расширенная модель товара с краями и бортами
}

// Текущие настройки фича-флагов
export const featureFlags: FeatureFlags = {
  edges_v2: true, // Включаем новую модель товара
};

// Функция для проверки включен ли фича-флаг
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return featureFlags[feature] === true;
}

// Функция для получения значения фича-флага
export function getFeatureFlag<T extends boolean>(feature: keyof FeatureFlags, defaultValue: T): T {
  return (featureFlags[feature] as T) ?? defaultValue;
}
