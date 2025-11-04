-- Бэкап Production БД: $(date +%Y-%m-%d_%H:%M:%S)
-- Создается перед миграцией добавления полей Liberty Grade

\echo '=== BACKING UP PRODUCTION DATABASE ==='
\echo 'Starting backup at: ' `date`

-- Бэкап схемы всех таблиц
\echo '=== SCHEMA DUMP ==='

-- Получаем структуру таблиц
SELECT 'TABLE: ' || tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Проверяем существование колонок для Liberty Grade
\echo '=== CHECKING LIBERTY GRADE COLUMNS ==='
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('cutting_operations', 'cutting_progress_log', 'production_tasks')
  AND column_name LIKE '%liberty%'
ORDER BY table_name, column_name;

-- Проверяем существование колонок для Second Grade
\echo '=== CHECKING SECOND GRADE COLUMNS ==='
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('cutting_operations', 'cutting_progress_log', 'production_tasks')
  AND (column_name LIKE '%second%' OR column_name LIKE '%grade%')
ORDER BY table_name, column_name;

-- Проверяем триггерную функцию
\echo '=== CHECKING TRIGGER FUNCTIONS ==='
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname LIKE '%cutting%progress%';

-- Количество записей в основных таблицах
\echo '=== TABLE COUNTS ==='
SELECT 'cutting_operations: ' || COUNT(*) FROM cutting_operations;
SELECT 'cutting_progress_log: ' || COUNT(*) FROM cutting_progress_log;
SELECT 'production_tasks: ' || COUNT(*) FROM production_tasks;
SELECT 'products: ' || COUNT(*) FROM products;
SELECT 'stock: ' || COUNT(*) FROM stock;
SELECT 'stock_movements: ' || COUNT(*) FROM stock_movements;




