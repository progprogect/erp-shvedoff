-- ДЕТАЛЬНЫЙ АНАЛИЗ ВСЕХ FK СВЯЗЕЙ В БД ERP SHVEDOFF
-- Цель: Понять правильный порядок очистки

SELECT '=== ПОЛНЫЙ АНАЛИЗ FK СВЯЗЕЙ ===' as info;

-- Все FK связи с деталями
SELECT
    tc.table_name as child_table,
    kcu.column_name as child_column,
    ccu.table_name as parent_table,
    ccu.column_name as parent_column,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- Группировка по зависимостям
SELECT '=== ГРУППИРОВКА ПО ЗАВИСИМОСТЯМ ===' as info;

-- Таблицы без зависимостей (можно очищать первыми)
SELECT 'БЕЗ ЗАВИСИМОСТЕЙ' as dependency_level, table_name
FROM (
    SELECT DISTINCT tc.table_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
) AS tables_with_fk
WHERE table_name NOT IN (
    SELECT DISTINCT ccu.table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
);

-- Таблицы с зависимостями (нужно очищать после зависимых)
SELECT 'С ЗАВИСИМОСТЯМИ' as dependency_level, table_name
FROM (
    SELECT DISTINCT ccu.table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
) AS parent_tables;


