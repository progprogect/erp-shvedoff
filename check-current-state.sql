-- Проверка текущего состояния БД после частичной очистки
SELECT '=== ТЕКУЩЕЕ СОСТОЯНИЕ БД ===' as status;

-- 1. Структура audit_log
SELECT '=== СТРУКТУРА audit_log ===' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'audit_log' 
ORDER BY ordinal_position;

-- 2. Данные для очистки (текущее состояние)
SELECT '=== ДАННЫЕ ДЛЯ ОЧИСТКИ ===' as info;
SELECT 'products' as table_name, COUNT(*) as rows_count FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'stock', COUNT(*) FROM stock
UNION ALL
SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL
SELECT 'production_tasks', COUNT(*) FROM production_tasks
UNION ALL
SELECT 'cutting_operations', COUNT(*) FROM cutting_operations
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'stock_movements', COUNT(*) FROM stock_movements;

-- 3. Сохраненные данные
SELECT '=== СОХРАНЕННЫЕ ДАННЫЕ ===' as info;
SELECT 'users' as table_name, COUNT(*) as rows_count FROM users
UNION ALL
SELECT 'permissions', COUNT(*) FROM permissions
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'product_surfaces', COUNT(*) FROM product_surfaces
UNION ALL
SELECT 'product_logos', COUNT(*) FROM product_logos
UNION ALL
SELECT 'product_materials', COUNT(*) FROM product_materials
UNION ALL
SELECT 'puzzle_types', COUNT(*) FROM puzzle_types;


