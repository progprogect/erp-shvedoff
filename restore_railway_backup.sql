-- Скрипт восстановления бэкапа Railway
-- Используйте: psql -d your_local_db < restore_railway_backup.sql

-- Очистка существующих данных
TRUNCATE TABLE edge_configurations CASCADE;
TRUNCATE TABLE product_edges CASCADE;
TRUNCATE TABLE bottom_types CASCADE;
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE user_permissions CASCADE;
TRUNCATE TABLE role_permissions CASCADE;
TRUNCATE TABLE permissions CASCADE;
TRUNCATE TABLE puzzle_types CASCADE;
TRUNCATE TABLE product_materials CASCADE;
TRUNCATE TABLE product_logos CASCADE;
TRUNCATE TABLE product_surfaces CASCADE;
TRUNCATE TABLE shipments CASCADE;
TRUNCATE TABLE cutting_operations CASCADE;
TRUNCATE TABLE production_tasks CASCADE;
TRUNCATE TABLE order_items CASCADE;
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE stock CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE categories CASCADE;
TRUNCATE TABLE users CASCADE;

-- Восстановление данных (замените пути на актуальные)
-- \copy users FROM 'users_backup.csv' CSV HEADER;
-- \copy categories FROM 'categories_backup.csv' CSV HEADER;
-- \copy products FROM 'products_backup.csv' CSV HEADER;
-- \copy stock FROM 'stock_backup.csv' CSV HEADER;
-- \copy orders FROM 'orders_backup.csv' CSV HEADER;
-- \copy order_items FROM 'order_items_backup.csv' CSV HEADER;
-- \copy production_tasks FROM 'production_tasks_backup.csv' CSV HEADER;
-- \copy cutting_operations FROM 'cutting_operations_backup.csv' CSV HEADER;
-- \copy shipments FROM 'shipments_backup.csv' CSV HEADER;
-- \copy product_surfaces FROM 'product_surfaces_backup.csv' CSV HEADER;
-- \copy product_logos FROM 'product_logos_backup.csv' CSV HEADER;
-- \copy product_materials FROM 'product_materials_backup.csv' CSV HEADER;
-- \copy puzzle_types FROM 'puzzle_types_backup.csv' CSV HEADER;
-- \copy permissions FROM 'permissions_backup.csv' CSV HEADER;
-- \copy role_permissions FROM 'role_permissions_backup.csv' CSV HEADER;
-- \copy user_permissions FROM 'user_permissions_backup.csv' CSV HEADER;
-- \copy audit_log FROM 'audit_log_backup.csv' CSV HEADER;
-- \copy stock_movements FROM 'stock_movements_backup.csv' CSV HEADER;
-- \copy bottom_types FROM 'bottom_types_backup.csv' CSV HEADER;
-- \copy product_edges FROM 'product_edges_backup.csv' CSV HEADER;
-- \copy edge_configurations FROM 'edge_configurations_backup.csv' CSV HEADER;

-- Сброс последовательностей
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders));
SELECT setval('production_tasks_id_seq', (SELECT MAX(id) FROM production_tasks));
SELECT setval('cutting_operations_id_seq', (SELECT MAX(id) FROM cutting_operations));
SELECT setval('shipments_id_seq', (SELECT MAX(id) FROM shipments));

SELECT 'Восстановление завершено!' as status;
