-- Миграция для добавления поверхности "Паззл" и опций паззла
-- Дата: 2025-07-23
-- Описание: Добавление поверхности "Паззл" с дополнительными опциями

BEGIN;

-- 1. Добавляем поверхность "Паззл" в справочник
INSERT INTO product_surfaces (name, description, is_system, created_at) VALUES
('Паззл', 'Поверхность с паззловой текстурой и дополнительными опциями', true, NOW())
ON CONFLICT (name) DO NOTHING;

-- 2. Добавляем колонку puzzle_options в таблицу products для хранения опций паззла
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS puzzle_options JSONB DEFAULT NULL;

-- 3. Добавляем комментарий к колонке для документации
COMMENT ON COLUMN products.puzzle_options IS 'Опции для поверхности "Паззл": {sides: "1_side|2_sides|3_sides|4_sides", type: "old|old_04_2025|new|narrow|wide", enabled: boolean}';

-- 4. Создаем частичный индекс для быстрого поиска товаров с опциями паззла
CREATE INDEX IF NOT EXISTS idx_products_puzzle_options 
ON products USING GIN (puzzle_options) 
WHERE puzzle_options IS NOT NULL;

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_puzzle_surface_and_options выполнена успешно' as status; 