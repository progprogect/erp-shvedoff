-- ==============================================
-- ПРОВЕРКА УСПЕШНОСТИ МИГРАЦИИ
-- Дата: 23.10.2025
-- ==============================================

\echo '=== ПРОВЕРКА МИГРАЦИИ ==='

-- 1. Проверяем наличие всех колонок Liberty
\echo '=== 1. ПРОВЕРКА КОЛОНОК LIBERTY ==='
SELECT 
    table_name, 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('cutting_operations', 'cutting_progress_log', 'production_tasks')
  AND (column_name LIKE '%liberty%' OR column_name LIKE '%second_grade%')
ORDER BY table_name, column_name;

-- 2. Проверяем наличие всех колонок Second Grade в production_tasks
\echo '=== 2. ПРОВЕРКА КОЛОНОК SECOND GRADE ==='
SELECT 
    table_name, 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'production_tasks'
  AND column_name IN ('second_grade_quantity', 'liberty_grade_quantity')
ORDER BY column_name;

-- 3. Проверяем триггер
\echo '=== 3. ПРОВЕРКА ТРИГГЕРА ==='
SELECT 
    tgname as trigger_name,
    tgtype as trigger_type,
    tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'cutting_progress_log'
  AND tgname LIKE '%cutting%progress%';

-- 4. Проверяем функцию триггера (краткая версия)
\echo '=== 4. ПРОВЕРКА ФУНКЦИИ ТРИГГЕРА ==='
SELECT 
    proname as function_name,
    pronargs as num_args,
    prorettype::regtype as return_type,
    CASE 
        WHEN prosrc LIKE '%_liberty_grade_diff%' THEN 'ДА'
        ELSE 'НЕТ'
    END as has_liberty_support,
    CASE 
        WHEN prosrc LIKE '%Товары 2-го сорта и Либерти создаются в API endpoint%' THEN 'ДА'
        ELSE 'НЕТ'
    END as has_correct_logic
FROM pg_proc 
WHERE proname = 'update_stock_from_cutting_progress';

-- 5. Проверяем индексы
\echo '=== 5. ПРОВЕРКА ИНДЕКСОВ ==='
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE tablename IN ('cutting_operations', 'cutting_progress_log', 'production_tasks')
  AND (indexname LIKE '%liberty%' OR indexname LIKE '%grade%')
ORDER BY tablename, indexname;

-- 6. Подсчитываем записи в основных таблицах
\echo '=== 6. КОЛИЧЕСТВО ЗАПИСЕЙ ==='
SELECT 'cutting_operations: ' || COUNT(*) FROM cutting_operations;
SELECT 'cutting_progress_log: ' || COUNT(*) FROM cutting_progress_log;
SELECT 'production_tasks: ' || COUNT(*) FROM production_tasks;

-- 7. Проверяем, что бэкапы на месте
\echo '=== 7. ПРОВЕРКА БЭКАПОВ ==='
SELECT 
    tablename
FROM pg_tables
WHERE tablename LIKE '%backup_20251023%'
ORDER BY tablename;

-- 8. Проверяем значения в новых колонках
\echo '=== 8. ПРОВЕРКА ЗНАЧЕНИЙ LIBERTY (должны быть 0 или NULL) ==='
SELECT 
    'cutting_operations' as table_name,
    COUNT(*) as total_rows,
    COUNT(actual_liberty_grade_quantity) as non_null_liberty,
    SUM(COALESCE(actual_liberty_grade_quantity, 0)) as total_liberty
FROM cutting_operations
UNION ALL
SELECT 
    'cutting_progress_log' as table_name,
    COUNT(*) as total_rows,
    COUNT(liberty_grade_quantity) as non_null_liberty,
    SUM(COALESCE(liberty_grade_quantity, 0)) as total_liberty
FROM cutting_progress_log
UNION ALL
SELECT 
    'production_tasks' as table_name,
    COUNT(*) as total_rows,
    COUNT(liberty_grade_quantity) as non_null_liberty,
    SUM(COALESCE(liberty_grade_quantity, 0)) as total_liberty
FROM production_tasks;

\echo '=== ПРОВЕРКА ЗАВЕРШЕНА ==='
\echo ''
\echo 'КРИТЕРИИ УСПЕХА:'
\echo '1. Все таблицы должны иметь колонки liberty_grade_quantity'
\echo '2. production_tasks должна иметь second_grade_quantity'
\echo '3. Триггер trigger_update_stock_from_cutting_progress должен существовать'
\echo '4. Функция update_stock_from_cutting_progress должна иметь поддержку Liberty (has_liberty_support = ДА)'
\echo '5. Функция должна иметь правильную логику (has_correct_logic = ДА)'
\echo '6. Все бэкапы должны быть на месте'
\echo '7. Значения liberty в существующих записях должны быть 0'




