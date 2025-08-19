-- Создание бэкапа через SQL экспорт
-- Это альтернатива pg_dump для Railway

-- 1. Экспорт пользователей (СОХРАНЯЕМ)
\copy (SELECT * FROM users) TO 'users_backup.csv' WITH CSV HEADER;

-- 2. Экспорт разрешений (СОХРАНЯЕМ)
\copy (SELECT * FROM permissions) TO 'permissions_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM role_permissions) TO 'role_permissions_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM user_permissions) TO 'user_permissions_backup.csv' WITH CSV HEADER;

-- 3. Экспорт справочников (СОХРАНЯЕМ)
\copy (SELECT * FROM categories) TO 'categories_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM product_surfaces) TO 'product_surfaces_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM product_logos) TO 'product_logos_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM product_materials) TO 'product_materials_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM puzzle_types) TO 'puzzle_types_backup.csv' WITH CSV HEADER;

-- 4. Экспорт данных для очистки (БЭКАП)
\copy (SELECT * FROM products) TO 'products_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM orders) TO 'orders_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM order_items) TO 'order_items_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM production_tasks) TO 'production_tasks_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM cutting_operations) TO 'cutting_operations_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM shipments) TO 'shipments_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM stock) TO 'stock_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM stock_movements) TO 'stock_movements_backup.csv' WITH CSV HEADER;
\copy (SELECT * FROM audit_log) TO 'audit_log_backup.csv' WITH CSV HEADER;

SELECT 'BACKUP COMPLETED' as status;


