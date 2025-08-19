-- Миграция для добавления таблицы конфигураций краёв
-- Дата: 2025-01-22
-- Описание: Создание справочника конфигураций краёв для упрощения выбора пользователя

BEGIN;

-- 1. Создаем таблицу конфигураций краёв
CREATE TABLE IF NOT EXISTS edge_configurations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    edge_type VARCHAR(20) NOT NULL, -- 'puzzle' или 'straight'
    puzzle_sides INTEGER, -- количество сторон паззла (1, 2, 3, 4) или NULL для прямого реза
    puzzle_type_code VARCHAR(50), -- код типа паззла или NULL для прямого реза
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Добавляем комментарий к таблице
COMMENT ON TABLE edge_configurations IS 'Справочник конфигураций краёв для упрощения выбора пользователя';

-- 3. Заполняем предустановленными конфигурациями согласно требованиям
INSERT INTO edge_configurations (name, code, edge_type, puzzle_sides, puzzle_type_code, description, is_system, created_at) VALUES
-- Паззловые края
('1ст. пазл (нов.)', 'puzzle_1_new', 'puzzle', 1, 'new', 'Односторонний паззл нового типа', true, NOW()),
('2ст. пазл (стар.)', 'puzzle_2_old', 'puzzle', 2, 'old', 'Двусторонний паззл старого типа', true, NOW()),
('3ст. пазл (узкий)', 'puzzle_3_narrow', 'puzzle', 3, 'narrow', 'Трехсторонний паззл узкого типа', true, NOW()),
('4ст. пазл (шир.)', 'puzzle_4_wide', 'puzzle', 4, 'wide', 'Четырехсторонний паззл широкого типа', true, NOW()),
-- Прямые края
('Прям. рез', 'straight_cut', 'straight', NULL, NULL, 'Прямой рез без дополнительных опций', true, NOW())
ON CONFLICT (code) DO NOTHING;

-- 4. Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_edge_configurations_code ON edge_configurations(code);
CREATE INDEX IF NOT EXISTS idx_edge_configurations_edge_type ON edge_configurations(edge_type);
CREATE INDEX IF NOT EXISTS idx_edge_configurations_puzzle_sides ON edge_configurations(puzzle_sides);
CREATE INDEX IF NOT EXISTS idx_edge_configurations_puzzle_type ON edge_configurations(puzzle_type_code);
CREATE INDEX IF NOT EXISTS idx_edge_configurations_system ON edge_configurations(is_system);

-- 5. Добавляем внешний ключ на типы паззлов
ALTER TABLE edge_configurations 
ADD CONSTRAINT fk_edge_configurations_puzzle_type 
FOREIGN KEY (puzzle_type_code) REFERENCES puzzle_types(code) ON DELETE RESTRICT;

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_edge_configurations_table выполнена успешно' as status;


