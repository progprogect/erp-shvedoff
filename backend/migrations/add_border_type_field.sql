-- Миграция: Добавление поля "Наличие борта" к товарам
-- Задача: 7.1 - Добавление нового параметра товара "Наличие борта"
-- Дата: 2025-01-15

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