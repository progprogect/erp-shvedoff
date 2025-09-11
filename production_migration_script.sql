-- Миграция production БД под staging
-- Дата: $(date)
-- Цель: Добавить недостающие справочники

BEGIN;

\echo '=== НАЧАЛО МИГРАЦИИ PRODUCTION ==='

-- 1. Добавить недостающий тип низа "Не выбрано"
\echo '--- Добавление типа низа "Не выбрано" ---'
INSERT INTO bottom_types (id, code, name, description, is_system, created_at) 
VALUES (6, 'not_selected', 'Не выбрано', 'Низ ковра не выбран', true, now())
ON CONFLICT (id) DO UPDATE SET 
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system;

-- 2. Добавить недостающий тип кромки "Литой"
\echo '--- Добавление типа кромки "Литой" ---'
INSERT INTO carpet_edge_types (id, name, code, description, is_system, created_at) 
VALUES (5, 'Литой', 'litoy_cut', 'Литой край ковра (по умолчанию)', false, now())
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system;

-- 3. Проверить и улучшить ограничения roll_covering_composition (если нужно)
\echo '--- Проверка ограничений roll_covering_composition ---'

-- Добавить ограничение на предотвращение самореференции (если его нет)
DO $$
BEGIN
    -- Проверяем, есть ли уже ограничение check_no_self_reference
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'check_no_self_reference' 
        AND table_name = 'roll_covering_composition'
    ) THEN
        ALTER TABLE roll_covering_composition 
        ADD CONSTRAINT check_no_self_reference 
        CHECK (roll_covering_id <> carpet_id);
        RAISE NOTICE 'Добавлено ограничение check_no_self_reference';
    ELSE
        RAISE NOTICE 'Ограничение check_no_self_reference уже существует';
    END IF;
END $$;

-- Добавить уникальный индекс для sort_order (если его нет)
DO $$
BEGIN
    -- Проверяем, есть ли уже уникальный индекс
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'unique_roll_covering_sort_order'
    ) THEN
        CREATE UNIQUE INDEX unique_roll_covering_sort_order 
        ON roll_covering_composition (roll_covering_id, sort_order);
        RAISE NOTICE 'Добавлен уникальный индекс unique_roll_covering_sort_order';
    ELSE
        RAISE NOTICE 'Индекс unique_roll_covering_sort_order уже существует';
    END IF;
END $$;

-- 4. Проверка результатов
\echo '--- ПРОВЕРКА РЕЗУЛЬТАТОВ ---'

SELECT 'bottom_types' as table_name, count(*) as total_count FROM bottom_types;
SELECT id, code, name FROM bottom_types WHERE code = 'not_selected';

SELECT 'carpet_edge_types' as table_name, count(*) as total_count FROM carpet_edge_types;
SELECT id, name, code FROM carpet_edge_types WHERE name = 'Литой';

\echo '=== МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО ==='

COMMIT;
