-- Миграция для добавления поля edge_strength в таблицу products
-- Дата: 2025-01-22
-- Описание: Добавление поля для указания типа усиленного края товара

BEGIN;

-- 1. Добавляем поле edge_strength в таблицу products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS edge_strength VARCHAR(20);

-- 2. Добавляем комментарий к полю
COMMENT ON COLUMN products.edge_strength IS 'Тип усиленного края товара: normal (обычный) или reinforced (усиленный)';

-- 3. Создаем индекс для быстрого поиска по типу края
CREATE INDEX IF NOT EXISTS idx_products_edge_strength ON products(edge_strength);

-- 4. Устанавливаем значение по умолчанию для существующих записей
UPDATE products SET edge_strength = 'normal' WHERE edge_strength IS NULL;

-- 5. Делаем поле NOT NULL после установки значений по умолчанию
ALTER TABLE products ALTER COLUMN edge_strength SET NOT NULL;

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_edge_strength_field выполнена успешно' as status;


