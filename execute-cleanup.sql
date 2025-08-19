-- ЭТАП 4: ВЫПОЛНЕНИЕ ОЧИСТКИ БД ERP SHVEDOFF
-- Цель: Безопасная очистка данных с сохранением пользователей, ACL и справочников
-- Дата: 2025-08-18
-- Бэкап: Создан (18 CSV файлов)

-- НАЧАЛО ТРАНЗАКЦИИ
BEGIN;

-- ЛОГИРОВАНИЕ НАЧАЛА ОЧИСТКИ
INSERT INTO audit_log (user_id, action, table_name, record_id, details, created_at)
VALUES (1, 'CLEANUP_START', 'SYSTEM', 0, 'Начало очистки БД - удаление тестовых данных', NOW());

-- 1. ОЧИСТКА ЗАВИСИМЫХ ТАБЛИЦ (0 строк - безопасно)
-- Эти таблицы уже пустые, но очищаем для перезапуска ID
TRUNCATE TABLE order_items RESTART IDENTITY;
TRUNCATE TABLE shipment_items RESTART IDENTITY;
TRUNCATE TABLE production_task_extras RESTART IDENTITY;

-- 2. ОЧИСТКА ОСНОВНЫХ ТАБЛИЦ ДАННЫХ
TRUNCATE TABLE orders RESTART IDENTITY;
TRUNCATE TABLE production_tasks RESTART IDENTITY;
TRUNCATE TABLE cutting_operations RESTART IDENTITY;
TRUNCATE TABLE shipments RESTART IDENTITY;

-- 3. ОЧИСТКА ТОВАРОВ (влияет на склад через FK)
-- CASCADE автоматически очистит связанные записи
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

-- 4. ОЧИСТКА СКЛАДА И ДВИЖЕНИЙ
TRUNCATE TABLE stock RESTART IDENTITY;
TRUNCATE TABLE stock_movements RESTART IDENTITY;

-- 5. ОЧИСТКА ИСТОРИИ И ЛОГОВ
TRUNCATE TABLE defect_products RESTART IDENTITY;
TRUNCATE TABLE operation_reversals RESTART IDENTITY;
TRUNCATE TABLE order_messages RESTART IDENTITY;

-- 6. ОЧИСТКА ОЧЕРЕДЕЙ И УВЕДОМЛЕНИЙ
TRUNCATE TABLE production_queue RESTART IDENTITY;
TRUNCATE TABLE telegram_notifications RESTART IDENTITY;

-- 7. ОЧИСТКА СВЯЗЕЙ ТОВАРОВ
TRUNCATE TABLE product_relations RESTART IDENTITY;

-- ЛОГИРОВАНИЕ УСПЕШНОГО ЗАВЕРШЕНИЯ
INSERT INTO audit_log (user_id, action, table_name, record_id, details, created_at)
VALUES (1, 'CLEANUP_SUCCESS', 'SYSTEM', 0, 'Очистка БД завершена успешно', NOW());

-- ФИКСАЦИЯ ТРАНЗАКЦИИ
COMMIT;

-- 8. ОПТИМИЗАЦИЯ БД (после транзакции)
VACUUM ANALYZE;

-- 9. ВЕРИФИКАЦИЯ РЕЗУЛЬТАТА
SELECT '=== ВЕРИФИКАЦИЯ ОЧИСТКИ ===' as status;

SELECT 'products' as table_name, COUNT(*) as rows_count FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'stock', COUNT(*) FROM stock
UNION ALL
SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL
SELECT 'production_tasks', COUNT(*) FROM production_tasks;

-- 10. ПОДТВЕРЖДЕНИЕ СОХРАНЕНИЯ КРИТИЧЕСКИХ ДАННЫХ
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


