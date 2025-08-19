-- Миграция: Добавление нового параметра "Край ковра"
-- Цель: отделить тип края от поверхности
-- Дата: 2025-08-19

-- Создаем enum для типов края ковра
CREATE TYPE carpet_edge_type AS ENUM ('straight_cut', 'puzzle');

-- Создаем таблицу для типов края ковра
CREATE TABLE carpet_edge_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Добавляем базовые типы края
INSERT INTO carpet_edge_types (name, code, description, is_system) VALUES
('Прямой рез', 'straight_cut', 'Обычный прямой край ковра', true),
('Паззл', 'puzzle', 'Паззловый край ковра с дополнительными опциями', true);

-- Добавляем поля в таблицу products
ALTER TABLE products ADD COLUMN carpet_edge_type carpet_edge_type DEFAULT 'straight_cut';
ALTER TABLE products ADD COLUMN carpet_edge_sides INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN carpet_edge_strength VARCHAR(50) DEFAULT 'normal';

-- Добавляем комментарии
COMMENT ON COLUMN products.carpet_edge_type IS 'Тип края ковра: прямой рез или паззл';
COMMENT ON COLUMN products.carpet_edge_sides IS 'Количество сторон для паззлового края';
COMMENT ON COLUMN products.carpet_edge_strength IS 'Усиление края: обычный или усиленный';

-- Создаем индексы
CREATE INDEX idx_products_carpet_edge_type ON products(carpet_edge_type);
CREATE INDEX idx_products_carpet_edge_sides ON products(carpet_edge_sides);
CREATE INDEX idx_products_carpet_edge_strength ON products(carpet_edge_strength);

-- Проверяем результат
SELECT * FROM carpet_edge_types ORDER BY id;
SELECT 
    carpet_edge_type,
    carpet_edge_sides,
    carpet_edge_strength,
    COUNT(*) as products_count
FROM products 
GROUP BY carpet_edge_type, carpet_edge_sides, carpet_edge_strength;
