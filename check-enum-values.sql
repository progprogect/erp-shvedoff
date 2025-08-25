-- Проверка допустимых значений enum audit_operation
SELECT '=== ЗНАЧЕНИЯ ENUM audit_operation ===' as info;

SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_operation')
ORDER BY enumsortorder;

-- Проверка текущего состояния БД
SELECT '=== ТЕКУЩЕЕ СОСТОЯНИЕ ===' as info;
SELECT 'products' as table_name, COUNT(*) as rows_count FROM products
UNION ALL
SELECT 'stock', COUNT(*) FROM stock
UNION ALL
SELECT 'stock_movements', COUNT(*) FROM stock_movements
UNION ALL
SELECT 'audit_log', COUNT(*) FROM audit_log;


