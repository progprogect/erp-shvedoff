-- Скрипт для анализа схемы БД
-- Получение информации о таблицах, колонках, типах данных, индексах

-- 1. Список всех таблиц
\echo '=== ТАБЛИЦЫ ==='
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Структура всех таблиц
\echo '=== СТРУКТУРА ТАБЛИЦ ==='
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 3. Первичные ключи
\echo '=== ПЕРВИЧНЫЕ КЛЮЧИ ==='
SELECT 
    tc.table_name,
    kc.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kc 
    ON tc.constraint_name = kc.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 4. Внешние ключи
\echo '=== ВНЕШНИЕ КЛЮЧИ ==='
SELECT 
    tc.table_name,
    kc.column_name,
    tc.constraint_name,
    rc.unique_constraint_name,
    rc.match_option,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kc 
    ON tc.constraint_name = kc.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 5. Индексы
\echo '=== ИНДЕКСЫ ==='
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 6. Счетчики записей в таблицах
\echo '=== КОЛИЧЕСТВО ЗАПИСЕЙ ==='
SELECT 
    schemaname,
    relname as tablename,
    n_tup_ins as total_inserts,
    n_tup_upd as total_updates,
    n_tup_del as total_deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
