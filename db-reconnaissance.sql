-- ЭТАП 1: РАЗВЕДКА БД ERP SHVEDOFF
-- Цель: Получить полную картину структуры БД для безопасной очистки

-- 1. Список всех таблиц в схеме public
SELECT '=== СПИСОК ВСЕХ ТАБЛИЦ ===' as info;
SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 2. Размер и количество строк по таблицам (топ "тяжёлых")
SELECT '=== РАЗМЕРЫ ТАБЛИЦ ===' as info;
SELECT 
    schemaname,
    tablename,
    n_live_tup as rows_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;

-- 3. Схема связей (Foreign Keys)
SELECT '=== СВЯЗИ (FOREIGN KEYS) ===' as info;
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- 4. Триггеры
SELECT '=== ТРИГГЕРЫ ===' as info;
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 5. Представления (Views)
SELECT '=== ПРЕДСТАВЛЕНИЯ (VIEWS) ===' as info;
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'VIEW'
ORDER BY table_name;

-- 6. Материализованные представления
SELECT '=== МАТЕРИАЛИЗОВАННЫЕ ПРЕДСТАВЛЕНИЯ ===' as info;
SELECT schemaname, matviewname 
FROM pg_matviews 
WHERE schemaname = 'public'
ORDER BY matviewname;


