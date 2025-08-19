-- ЭТАП 4: ВЫПОЛНЕНИЕ ОЧИСТКИ БД ERP SHVEDOFF (ПРАВИЛЬНЫЙ ПОРЯДОК FK)
-- Цель: Безопасная очистка данных с сохранением пользователей, ACL и справочников
-- Дата: 2025-08-18
-- Бэкап: Создан (18 CSV файлов)

-- НАЧАЛО ТРАНЗАКЦИИ
BEGIN;

-- 1. ОЧИСТКА ЗАВИСИМЫХ ТАБЛИЦ (сначала дети, потом родители)
-- Очищаем все зависимые таблицы одновременно с родительскими
TRUNCATE TABLE 
    order_items, 
    shipment_items, 
    production_task_extras,
    orders,
    production_tasks,
    cutting_operations,
    shipments
RESTART IDENTITY;

-- 2. ОЧИСТКА ТОВАРОВ (влияет на склад через FK)
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

-- 3. ОЧИСТКА СКЛАДА И ДВИЖЕНИЙ
TRUNCATE TABLE stock, stock_movements RESTART IDENTITY;

-- 4. ОЧИСТКА ИСТОРИИ И ЛОГОВ
TRUNCATE TABLE 
    defect_products, 
    operation_reversals, 
    order_messages
RESTART IDENTITY;

-- 5. ОЧИСТКА ОЧЕРЕДЕЙ И УВЕДОМЛЕНИЙ
TRUNCATE TABLE 
    production_queue, 
    telegram_notifications
RESTART IDENTITY;

-- 6. ОЧИСТКА СВЯЗЕЙ ТОВАРОВ
TRUNCATE TABLE product_relations RESTART IDENTITY;

-- ФИКСАЦИЯ ТРАНЗАКЦИИ
COMMIT;

-- 7. ОПТИМИЗАЦИЯ БД
VACUUM ANALYZE;

-- 8. ВЕРИФИКАЦИЯ РЕЗУЛЬТАТА
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
SELECT 'stock_movements', COUNT(*) FROM stock_movements;

-- 9. ПОДТВЕРЖДЕНИЕ СОХРАНЕНИЯ КРИТИЧЕСКИХ ДАННЫХ
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


