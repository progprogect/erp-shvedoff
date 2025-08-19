-- ИСПРАВЛЕНИЕ: Добавляем поле border_type вручную
BEGIN;

-- Создаем ENUM тип для наличия борта
CREATE TYPE border_type AS ENUM ('with_border', 'without_border');

-- Добавляем поле border_type в таблицу products
ALTER TABLE products 
ADD COLUMN border_type border_type;

-- Добавляем комментарий к полю
COMMENT ON COLUMN products.border_type IS 'Наличие борта: with_border (с бортом) или without_border (без борта)';

-- Создаем индекс для улучшения производительности фильтрации
CREATE INDEX IF NOT EXISTS idx_products_border_type ON products(border_type);

COMMIT;

-- Проверяем результат
SELECT 'MIGRATION COMPLETED' as status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'border_type';