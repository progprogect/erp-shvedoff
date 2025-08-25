-- Миграция: Добавление параметра "Низ ковра"
-- Дата: 2025-08-19

-- 1. Создание ENUM для типов низа ковра
CREATE TYPE bottom_type_code AS ENUM ('spike_0', 'spike_2', 'spike_5', 'spike_7', 'spike_11');

-- 2. Создание таблицы bottom_types
CREATE TABLE bottom_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Добавление поля bottomTypeId в таблицу products
ALTER TABLE products ADD COLUMN bottom_type_id INTEGER REFERENCES bottom_types(id);

-- 4. Создание индекса для оптимизации запросов
CREATE INDEX idx_products_bottom_type_id ON products(bottom_type_id);

-- 5. Вставка стандартных типов низа ковра
INSERT INTO bottom_types (code, name, description, is_system) VALUES
    ('spike_0', 'Шип-0', 'Без шипов', true),
    ('spike_2', 'Шип-2', '2 шипа', true),
    ('spike_5', 'Шип-5', '5 шипов', true),
    ('spike_7', 'Шип-7', '7 шипов', true),
    ('spike_11', 'Шип-11', '11 шипов', true);

-- 6. Установка значения по умолчанию для существующих товаров
UPDATE products SET bottom_type_id = (SELECT id FROM bottom_types WHERE code = 'spike_0') WHERE bottom_type_id IS NULL;

-- 7. Сделать поле обязательным для новых товаров
ALTER TABLE products ALTER COLUMN bottom_type_id SET NOT NULL;

-- 8. Добавление комментариев
COMMENT ON TABLE bottom_types IS 'Справочник типов низа ковра';
COMMENT ON COLUMN products.bottom_type_id IS 'ID типа низа ковра (обязательное поле)';
COMMENT ON COLUMN bottom_types.code IS 'Код типа низа ковра (spike_0, spike_2, spike_5, spike_7, spike_11)';
COMMENT ON COLUMN bottom_types.name IS 'Название типа низа ковра';
COMMENT ON COLUMN bottom_types.is_system IS 'Системный тип (нельзя удалить)';
