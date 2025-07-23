-- Миграция для добавления полей "вес" и "сорт" в товары
-- Дата: 2025-07-23
-- Описание: Добавление веса (опционально) и сорта товара (обычный по умолчанию)

BEGIN;

-- 1. Создаем enum для сортов товаров
CREATE TYPE product_grade AS ENUM ('usual', 'grade_2');

-- 2. Добавляем колонку для веса товара (опционально)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS weight DECIMAL(8,3) DEFAULT NULL;

-- 3. Добавляем колонку для сорта товара (обычный по умолчанию) 
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS grade product_grade DEFAULT 'usual';

-- 4. Добавляем комментарии к колонкам для документации
COMMENT ON COLUMN products.weight IS 'Вес товара в килограммах (опционально)';
COMMENT ON COLUMN products.grade IS 'Сорт товара: usual (обычный) или grade_2 (2 сорт)';

-- 5. Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_products_grade ON products(grade);
CREATE INDEX IF NOT EXISTS idx_products_weight ON products(weight);

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_weight_and_grade_to_products выполнена успешно' as status; 