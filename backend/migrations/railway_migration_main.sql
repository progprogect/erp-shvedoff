-- =====================================================
-- ОСНОВНАЯ МИГРАЦИЯ ДЛЯ RAILWAY - ОБНОВЛЕНИЕ ДО ВЕРСИИ DEV
-- =====================================================
-- ВАЖНО: Этот скрипт обновляет структуру БД, сохраняя все существующие данные

BEGIN;

-- Логируем начало миграции
DO $$
BEGIN
    RAISE NOTICE 'Начинаем миграцию базы данных до версии Dev...';
    RAISE NOTICE 'Время начала: %', NOW();
END $$;

-- =====================================================
-- 1. СОЗДАНИЕ НОВЫХ ТИПОВ И ENUM
-- =====================================================

-- Создаем ENUM для типов края ковра
DO $$ BEGIN
    CREATE TYPE carpet_edge_type AS ENUM ('straight_cut', 'puzzle');
    RAISE NOTICE 'ENUM carpet_edge_type создан';
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'ENUM carpet_edge_type уже существует';
END $$;

-- Создаем ENUM для прочности края
DO $$ BEGIN
    CREATE TYPE carpet_edge_strength AS ENUM ('weak', 'normal', 'strong', 'reinforced');
    RAISE NOTICE 'ENUM carpet_edge_strength создан';
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'ENUM carpet_edge_strength уже существует';
END $$;

-- Создаем ENUM для типов низа ковра
DO $$ BEGIN
    CREATE TYPE bottom_type_code AS ENUM ('spike_0', 'spike_2', 'spike_5', 'spike_7', 'spike_11');
    RAISE NOTICE 'ENUM bottom_type_code создан';
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'ENUM bottom_type_code уже существует';
END $$;

-- =====================================================
-- 2. СОЗДАНИЕ НОВЫХ ТАБЛИЦ
-- =====================================================

-- Создаем таблицу типов края ковра
CREATE TABLE IF NOT EXISTS carpet_edge_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Создаем таблицу типов низа ковра
CREATE TABLE IF NOT EXISTS bottom_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. ДОБАВЛЕНИЕ НОВЫХ ПОЛЕЙ В СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ
-- =====================================================

-- Добавляем новые поля в таблицу products
DO $$
BEGIN
    -- Проверяем, есть ли уже поле carpet_edge_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'carpet_edge_type') THEN
        ALTER TABLE products ADD COLUMN carpet_edge_type carpet_edge_type DEFAULT 'straight_cut';
        RAISE NOTICE 'Поле carpet_edge_type добавлено';
    ELSE
        RAISE NOTICE 'Поле carpet_edge_type уже существует';
    END IF;
    
    -- Проверяем, есть ли уже поле carpet_edge_sides
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'carpet_edge_sides') THEN
        ALTER TABLE products ADD COLUMN carpet_edge_sides INTEGER DEFAULT 1;
        RAISE NOTICE 'Поле carpet_edge_sides добавлено';
    ELSE
        RAISE NOTICE 'Поле carpet_edge_sides уже существует';
    END IF;
    
    -- Проверяем, есть ли уже поле carpet_edge_strength
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'carpet_edge_strength') THEN
        ALTER TABLE products ADD COLUMN carpet_edge_strength VARCHAR(50) DEFAULT 'normal';
        RAISE NOTICE 'Поле carpet_edge_strength добавлено';
    ELSE
        RAISE NOTICE 'Поле carpet_edge_strength уже существует';
    END IF;
    
    -- Проверяем, есть ли уже поле bottom_type_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'bottom_type_id') THEN
        ALTER TABLE products ADD COLUMN bottom_type_id INTEGER REFERENCES bottom_types(id);
        RAISE NOTICE 'Поле bottom_type_id добавлено';
    ELSE
        RAISE NOTICE 'Поле bottom_type_id уже существует';
    END IF;
    
    -- Проверяем, есть ли уже поле puzzle_type_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'puzzle_type_id') THEN
        ALTER TABLE products ADD COLUMN puzzle_type_id INTEGER REFERENCES puzzle_types(id);
        RAISE NOTICE 'Поле puzzle_type_id добавлено';
    ELSE
        RAISE NOTICE 'Поле puzzle_type_id уже существует';
    END IF;
    
    -- Проверяем, есть ли уже поле puzzle_sides
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'puzzle_sides') THEN
        ALTER TABLE products ADD COLUMN puzzle_sides INTEGER DEFAULT 1;
        RAISE NOTICE 'Поле puzzle_sides добавлено';
    ELSE
        RAISE NOTICE 'Поле puzzle_sides уже существует';
    END IF;
END $$;

-- =====================================================
-- 4. ЗАПОЛНЕНИЕ СПРАВОЧНИКОВ
-- =====================================================

-- Вставляем базовые типы края ковра
INSERT INTO carpet_edge_types (name, code, description, is_system) VALUES
('Прямой рез', 'straight_cut', 'Обычный прямой край ковра', true),
('Паззл', 'puzzle', 'Паззловый край ковра с дополнительными опциями', true)
ON CONFLICT (code) DO NOTHING;

-- Вставляем базовые типы низа ковра
INSERT INTO bottom_types (code, name, description, is_system) VALUES
('spike_0', 'Шип-0', 'Без шипов', true),
('spike_2', 'Шип-2', '2 шипа', true),
('spike_5', 'Шип-5', '5 шипов', true),
('spike_7', 'Шип-7', '7 шипов', true),
('spike_11', 'Шип-11', '11 шипов', true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 5. ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ДАННЫХ
-- =====================================================

-- Устанавливаем тип низа по умолчанию для существующих товаров
UPDATE products
SET bottom_type_id = (SELECT id FROM bottom_types WHERE code = 'spike_0')
WHERE bottom_type_id IS NULL;

-- Устанавливаем значения по умолчанию для новых полей
UPDATE products SET
    carpet_edge_type = COALESCE(carpet_edge_type, 'straight_cut'),
    carpet_edge_sides = COALESCE(carpet_edge_sides, 1),
    carpet_edge_strength = COALESCE(carpet_edge_strength, 'normal'),
    puzzle_sides = COALESCE(puzzle_sides, 1)
WHERE carpet_edge_type IS NULL
   OR carpet_edge_sides IS NULL
   OR carpet_edge_strength IS NULL
   OR puzzle_sides IS NULL;

-- =====================================================
-- 6. СОЗДАНИЕ ИНДЕКСОВ
-- =====================================================

-- Создаем индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_products_carpet_edge_type ON products(carpet_edge_type);
CREATE INDEX IF NOT EXISTS idx_products_carpet_edge_sides ON products(carpet_edge_sides);
CREATE INDEX IF NOT EXISTS idx_products_carpet_edge_strength ON products(carpet_edge_strength);
CREATE INDEX IF NOT EXISTS idx_products_bottom_type_id ON products(bottom_type_id);
CREATE INDEX IF NOT EXISTS idx_products_puzzle_type_id ON products(puzzle_type_id);

-- =====================================================
-- 7. ДОБАВЛЕНИЕ КОММЕНТАРИЕВ
-- =====================================================

-- Добавляем комментарии к новым полям
COMMENT ON COLUMN products.carpet_edge_type IS 'Тип края ковра: прямой рез или паззл';
COMMENT ON COLUMN products.carpet_edge_sides IS 'Количество сторон для паззлового края';
COMMENT ON COLUMN products.carpet_edge_strength IS 'Усиление края: обычный или усиленный';
COMMENT ON COLUMN products.bottom_type_id IS 'Ссылка на тип низа ковра';
COMMENT ON COLUMN products.puzzle_type_id IS 'Ссылка на тип паззла';
COMMENT ON COLUMN products.puzzle_sides IS 'Количество сторон паззла';

-- =====================================================
-- 8. ФИНАЛЬНАЯ ПРОВЕРКА
-- =====================================================

-- Проверяем, что все поля добавлены
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Проверяем наличие всех новых полей
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'carpet_edge_type') THEN
        missing_columns := array_append(missing_columns, 'carpet_edge_type');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'bottom_type_id') THEN
        missing_columns := array_append(missing_columns, 'bottom_type_id');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'puzzle_type_id') THEN
        missing_columns := array_append(missing_columns, 'puzzle_type_id');
    END IF;

    -- Выводим результат
    IF array_length(missing_columns, 1) IS NULL THEN
        RAISE NOTICE 'Все новые поля успешно добавлены!';
    ELSE
        RAISE NOTICE 'Отсутствуют поля: %', array_to_string(missing_columns, ', ');
    END IF;
END $$;

-- Логируем завершение миграции
DO $$
BEGIN
    RAISE NOTICE 'Миграция завершена успешно!';
    RAISE NOTICE 'Время завершения: %', NOW();
    RAISE NOTICE 'База данных обновлена до версии Dev';
END $$;

COMMIT;

