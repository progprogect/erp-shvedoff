-- Синхронизация ограничений roll_covering_composition production → staging
-- Staging = ЭТАЛОН

BEGIN;

\echo '=== СИНХРОНИЗАЦИЯ ROLL_COVERING_COMPOSITION ==='

-- 1. Добавить ограничение на предотвращение самореференции
\echo '--- Добавление ограничения check_no_self_reference ---'
DO $$
BEGIN
    -- Проверяем, есть ли уже ограничение
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_no_self_reference' 
        AND conrelid = 'roll_covering_composition'::regclass
    ) THEN
        ALTER TABLE roll_covering_composition 
        ADD CONSTRAINT check_no_self_reference 
        CHECK (roll_covering_id <> carpet_id);
        RAISE NOTICE 'Добавлено ограничение check_no_self_reference';
    ELSE
        RAISE NOTICE 'Ограничение check_no_self_reference уже существует';
    END IF;
END $$;

-- 2. Добавить уникальный индекс для sort_order по roll_covering_id
\echo '--- Добавление уникального индекса ---'
DO $$
BEGIN
    -- Проверяем, есть ли уже уникальный индекс
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'unique_roll_covering_sort_order'
    ) THEN
        -- Сначала удаляем обычный индекс, если он есть
        DROP INDEX IF EXISTS idx_roll_covering_composition_sort_order;
        
        -- Создаем уникальный индекс
        CREATE UNIQUE INDEX unique_roll_covering_sort_order 
        ON roll_covering_composition (roll_covering_id, sort_order);
        RAISE NOTICE 'Добавлен уникальный индекс unique_roll_covering_sort_order';
    ELSE
        RAISE NOTICE 'Индекс unique_roll_covering_sort_order уже существует';
    END IF;
END $$;

-- 3. Обновить ограничение check_sort_order_positive (если нужно)
\echo '--- Проверка ограничения check_sort_order_positive ---'
DO $$
BEGIN
    -- Проверяем, есть ли правильное ограничение sort_order
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_sort_order_positive' 
        AND conrelid = 'roll_covering_composition'::regclass
    ) THEN
        ALTER TABLE roll_covering_composition 
        ADD CONSTRAINT check_sort_order_positive 
        CHECK (sort_order >= 0);
        RAISE NOTICE 'Добавлено ограничение check_sort_order_positive';
    ELSE
        RAISE NOTICE 'Ограничение check_sort_order_positive уже существует';
    END IF;
END $$;

-- 4. Проверка финального состояния
\echo '--- ПРОВЕРКА РЕЗУЛЬТАТОВ ---'

-- Проверяем ограничения
SELECT conname as constraint_name 
FROM pg_constraint 
WHERE conrelid = 'roll_covering_composition'::regclass 
AND contype = 'c'
ORDER BY conname;

-- Проверяем индексы
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'roll_covering_composition' 
ORDER BY indexname;

\echo '=== СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА ==='

COMMIT;



