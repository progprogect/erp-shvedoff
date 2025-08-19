-- ЭТАП 3: DRY-RUN И ПЛАН ОЧИСТКИ
-- Цель: Показать что будет очищено и получить подтверждение

-- 1. ПОДСЧЕТ ДАННЫХ ДЛЯ ОЧИСТКИ
SELECT '=== ДАННЫЕ ДЛЯ ОЧИСТКИ ===' as info;

SELECT 'products' as table_name, COUNT(*) as rows_count FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'production_tasks', COUNT(*) FROM production_tasks
UNION ALL
SELECT 'cutting_operations', COUNT(*) FROM cutting_operations
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'shipment_items', COUNT(*) FROM shipment_items
UNION ALL
SELECT 'stock', COUNT(*) FROM stock
UNION ALL
SELECT 'stock_movements', COUNT(*) FROM stock_movements
UNION ALL
SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL
SELECT 'defect_products', COUNT(*) FROM defect_products
UNION ALL
SELECT 'operation_reversals', COUNT(*) FROM operation_reversals
UNION ALL
SELECT 'order_messages', COUNT(*) FROM order_messages
UNION ALL
SELECT 'product_relations', COUNT(*) FROM product_relations
UNION ALL
SELECT 'production_queue', COUNT(*) FROM production_queue
UNION ALL
SELECT 'production_task_extras', COUNT(*) FROM production_task_extras
UNION ALL
SELECT 'telegram_notifications', COUNT(*) FROM telegram_notifications;

-- 2. ПРИМЕРЫ ДАННЫХ (первые 3 строки)
SELECT '=== ПРИМЕРЫ ТОВАРОВ ===' as info;
SELECT id, name, sku, category_id FROM products LIMIT 3;

SELECT '=== ПРИМЕРЫ ОСТАТКОВ ===' as info;
SELECT id, product_id, quantity, reserved FROM stock LIMIT 3;

SELECT '=== ПРИМЕРЫ ИСТОРИИ ===' as info;
SELECT id, user_id, action, table_name, record_id FROM audit_log LIMIT 3;

-- 3. ПЛАН ОЧИСТКИ (ПОРЯДОК)
SELECT '=== ПЛАН ОЧИСТКИ ===' as info;
SELECT 
    '1. Зависимые таблицы (0 строк)' as step,
    'order_items, shipment_items, production_task_extras' as tables
UNION ALL
SELECT 
    '2. Основные таблицы данных',
    'products, orders, production_tasks, cutting_operations, shipments'
UNION ALL
SELECT 
    '3. Склад и движения',
    'stock, stock_movements'
UNION ALL
SELECT 
    '4. История и логи',
    'audit_log, defect_products, operation_reversals, order_messages'
UNION ALL
SELECT 
    '5. Очереди и уведомления',
    'production_queue, telegram_notifications';

-- 4. ПОДТВЕРЖДЕНИЕ СОХРАНЕНИЯ
SELECT '=== СОХРАНЯЕМЫЕ ТАБЛИЦЫ ===' as info;
SELECT 
    'users' as table_name,
    COUNT(*) as rows_count,
    'ПОЛЬЗОВАТЕЛИ' as description
FROM users
UNION ALL
SELECT 
    'permissions',
    COUNT(*),
    'ПРАВА ДОСТУПА'
FROM permissions
UNION ALL
SELECT 
    'categories',
    COUNT(*),
    'КАТЕГОРИИ ТОВАРОВ'
FROM categories
UNION ALL
SELECT 
    'product_surfaces',
    COUNT(*),
    'ТИПЫ ПОВЕРХНОСТЕЙ'
FROM product_surfaces
UNION ALL
SELECT 
    'product_logos',
    COUNT(*),
    'ЛОГОТИПЫ'
FROM product_logos
UNION ALL
SELECT 
    'product_materials',
    COUNT(*),
    'МАТЕРИАЛЫ'
FROM product_materials
UNION ALL
SELECT 
    'puzzle_types',
    COUNT(*),
    'ТИПЫ ПАЗЗЛОВ'
FROM puzzle_types;


