-- ЭТАП 4: ВЫПОЛНЕНИЕ ОЧИСТКИ БД ERP SHVEDOFF (ФИНАЛЬНАЯ ВЕРСИЯ С CASCADE)
-- Цель: Безопасная очистка данных с сохранением пользователей, ACL и справочников
-- Дата: 2025-08-18
-- Бэкап: Создан (18 CSV файлов)
-- Стратегия: Используем CASCADE для автоматического разрешения FK связей

-- НАЧАЛО ТРАНЗАКЦИИ
BEGIN;

-- 1. ОЧИСТКА ВСЕХ ТАБЛИЦ С ДАННЫМИ ОДНИМ CASCADE
-- Это автоматически очистит все зависимости в правильном порядке
TRUNCATE TABLE 
    products,
    orders,
    production_tasks,
    cutting_operations,
    shipments,
    stock,
    stock_movements,
    audit_log,
    defect_products,
    operation_reversals,
    order_items,
    order_messages,
    product_relations,
    production_queue,
    production_task_extras,
    shipment_items,
    telegram_notifications
RESTART IDENTITY CASCADE;

-- ФИКСАЦИЯ ТРАНЗАКЦИИ
COMMIT;

-- 2. ОПТИМИЗАЦИЯ БД
VACUUM ANALYZE;

-- 3. ВЕРИФИКАЦИЯ РЕЗУЛЬТАТА
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
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'shipment_items', COUNT(*) FROM shipment_items;

-- 4. ПОДТВЕРЖДЕНИЕ СОХРАНЕНИЯ КРИТИЧЕСКИХ ДАННЫХ
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


