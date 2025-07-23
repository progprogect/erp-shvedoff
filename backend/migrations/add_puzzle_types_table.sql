-- Миграция для добавления таблицы типов паззлов
-- Дата: 2025-07-23
-- Описание: Создание справочника типов паззлов для динамического управления

BEGIN;

-- 1. Создаем таблицу типов паззлов
CREATE TABLE IF NOT EXISTS puzzle_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Добавляем комментарий к таблице
COMMENT ON TABLE puzzle_types IS 'Справочник типов паззлов для динамического управления в интерфейсе';

-- 3. Заполняем предустановленными типами паззлов
INSERT INTO puzzle_types (name, code, description, is_system, created_at) VALUES
('Старый', 'old', 'Стандартный старый тип паззла', true, NOW()),
('Старый 04.2025', 'old_04_2025', 'Обновленная версия старого типа паззла', true, NOW()),
('Новый', 'new', 'Новый тип паззла с улучшенными характеристиками', true, NOW()),
('Узкий', 'narrow', 'Узкий паззл для специальных применений', true, NOW()),
('Широкий', 'wide', 'Широкий паззл для больших площадей', true, NOW())
ON CONFLICT (code) DO NOTHING;

-- 4. Создаем индекс для быстрого поиска по коду
CREATE INDEX IF NOT EXISTS idx_puzzle_types_code ON puzzle_types(code);

-- 5. Создаем индекс для системных типов
CREATE INDEX IF NOT EXISTS idx_puzzle_types_system ON puzzle_types(is_system);

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_puzzle_types_table выполнена успешно' as status; 