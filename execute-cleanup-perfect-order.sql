-- ЭТАП 4: ВЫПОЛНЕНИЕ ОЧИСТКИ БД ERP SHVEDOFF (ИДЕАЛЬНЫЙ ПОРЯДОК FK)
-- Цель: Безопасная очистка данных с сохранением пользователей, ACL и справочников
-- Дата: 2025-08-18
-- Бэкап: Создан (18 CSV файлов)
-- Анализ FK: Выполнен - определен правильный порядок очистки

-- НАЧАЛО ТРАНЗАКЦИИ
BEGIN;

-- 1. ОЧИСТКА ТАБЛИЦ БЕЗ ЗАВИСИМОСТЕЙ (можно очищать первыми)
-- Эти таблицы ссылаются на другие, но на них никто не ссылается
TRUNCATE TABLE 
    cutting_operations,
    defect_products,
    operation_reversals,
    order_items,
    order_messages,
    product_relations,
    production_queue,
    production_task_extras,
    stock,
    stock_movements,
    telegram_notifications
RESTART IDENTITY;

-- 2. ОЧИСТКА ТАБЛИЦ С ЗАВИСИМОСТЯМИ (очищаем после зависимых)
-- Сначала таблицы, которые ссылаются на products
TRUNCATE TABLE 
    orders,
    production_tasks,
    shipments
RESTART IDENTITY;

-- 3. ОЧИСТКА ТОВАРОВ (влияет на все связанные таблицы)
-- CASCADE автоматически очистит все зависимости
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

-- 4. ОЧИСТКА АУДИТА (ссылается на users, но users сохраняем)
TRUNCATE TABLE audit_log RESTART IDENTITY;

-- ФИКСАЦИЯ ТРАНЗАКЦИИ
COMMIT;

-- 5. ОПТИМИЗАЦИЯ БД
VACUUM ANALYZE;

-- 6. ВЕРИФИКАЦИЯ РЕЗУЛЬТАТА
SELECT '=== ВЕРИФИКАЦИЯ ОЧИСТКИ ===' as status;

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
SELECT 'stock_movements', COUNT(*) FROM stock_movements
UNION ALL
SELECT 'cutting_operations', COUNT(*) FROM cutting_operations
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments;

-- 7. ПОДТВЕРЖДЕНИЕ СОХРАНЕНИЯ КРИТИЧЕСКИХ ДАННЫХ
SELECT '=== СОХРАНЕННЫЕ ДАННЫЕ ===' as status;

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

SELECT '🎉 ОЧИСТКА ЗАВЕРШЕНА УСПЕШНО!' as final_status;


