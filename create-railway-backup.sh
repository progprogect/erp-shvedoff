#!/bin/bash

# Скрипт для создания бэкапа базы данных Railway
echo "🔧 Создание бэкапа базы данных Railway..."

# Создаем бэкап через railway connect
echo "📊 Подключение к базе данных Railway..."
railway connect Postgres << 'EOF'
\copy (SELECT '-- Railway Database Backup' as comment) TO '/tmp/backup_header.sql';
\copy (SELECT '-- Generated at: ' || now() as timestamp) TO '/tmp/backup_timestamp.sql';
\copy (SELECT '-- Database: ' || current_database() as db_info) TO '/tmp/backup_db_info.sql';

-- Создаем бэкап схемы
\copy (SELECT '-- SCHEMA BACKUP' as comment) TO '/tmp/backup_schema.sql';
\copy (SELECT '-- ' || table_name || ' table' FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name) TO '/tmp/backup_schema.sql';

-- Создаем бэкап данных
\copy (SELECT '-- DATA BACKUP' as comment) TO '/tmp/backup_data.sql';

-- Бэкап пользователей
\copy (SELECT '-- Users table' as comment) TO '/tmp/backup_data.sql';
\copy users TO '/tmp/users_backup.csv' CSV HEADER;

-- Бэкап категорий
\copy (SELECT '-- Categories table' as comment) TO '/tmp/backup_data.sql';
\copy categories TO '/tmp/categories_backup.csv' CSV HEADER;

-- Бэкап товаров
\copy (SELECT '-- Products table' as comment) TO '/tmp/backup_data.sql';
\copy products TO '/tmp/products_backup.csv' CSV HEADER;

-- Бэкап остатков
\copy (SELECT '-- Stock table' as comment) TO '/tmp/backup_data.sql';
\copy stock TO '/tmp/stock_backup.csv' CSV HEADER;

-- Бэкап заказов
\copy (SELECT '-- Orders table' as comment) TO '/tmp/backup_data.sql';
\copy orders TO '/tmp/orders_backup.csv' CSV HEADER;

-- Бэкап элементов заказов
\copy (SELECT '-- Order items table' as comment) TO '/tmp/backup_data.sql';
\copy order_items TO '/tmp/order_items_backup.csv' CSV HEADER;

-- Бэкап производственных заданий
\copy (SELECT '-- Production tasks table' as comment) TO '/tmp/backup_data.sql';
\copy production_tasks TO '/tmp/production_tasks_backup.csv' CSV HEADER;

-- Бэкап операций резки
\copy (SELECT '-- Cutting operations table' as comment) TO '/tmp/backup_data.sql';
\copy cutting_operations TO '/tmp/cutting_operations_backup.csv' CSV HEADER;

-- Бэкап отгрузок
\copy (SELECT '-- Shipments table' as comment) TO '/tmp/backup_data.sql';
\copy shipments TO '/tmp/shipments_backup.csv' CSV HEADER;

-- Бэкап справочников
\copy (SELECT '-- Surfaces table' as comment) TO '/tmp/backup_data.sql';
\copy product_surfaces TO '/tmp/product_surfaces_backup.csv' CSV HEADER;

\copy (SELECT '-- Logos table' as comment) TO '/tmp/backup_data.sql';
\copy product_logos TO '/tmp/product_logos_backup.csv' CSV HEADER;

\copy (SELECT '-- Materials table' as comment) TO '/tmp/backup_data.sql';
\copy product_materials TO '/tmp/product_materials_backup.csv' CSV HEADER;

\copy (SELECT '-- Puzzle types table' as comment) TO '/tmp/backup_data.sql';
\copy puzzle_types TO '/tmp/puzzle_types_backup.csv' CSV HEADER;

\copy (SELECT '-- Permissions table' as comment) TO '/tmp/backup_data.sql';
\copy permissions TO '/tmp/permissions_backup.csv' CSV HEADER;

\copy (SELECT '-- Role permissions table' as comment) TO '/tmp/backup_data.sql';
\copy role_permissions TO '/tmp/role_permissions_backup.csv' CSV HEADER;

\copy (SELECT '-- User permissions table' as comment) TO '/tmp/backup_data.sql';
\copy user_permissions TO '/tmp/user_permissions_backup.csv' CSV HEADER;

\copy (SELECT '-- Audit log table' as comment) TO '/tmp/backup_data.sql';
\copy audit_log TO '/tmp/audit_log_backup.csv' CSV HEADER;

\copy (SELECT '-- Stock movements table' as comment) TO '/tmp/backup_data.sql';
\copy stock_movements TO '/tmp/stock_movements_backup.csv' CSV HEADER;

\copy (SELECT '-- Bottom types table' as comment) TO '/tmp/backup_data.sql';
\copy bottom_types TO '/tmp/bottom_types_backup.csv' CSV HEADER;

\copy (SELECT '-- Product edges table' as comment) TO '/tmp/backup_data.sql';
\copy product_edges TO '/tmp/product_edges_backup.csv' CSV HEADER;

\copy (SELECT '-- Edge configurations table' as comment) TO '/tmp/backup_data.sql';
\copy edge_configurations TO '/tmp/edge_configurations_backup.csv' CSV HEADER;

\copy (SELECT '-- BOTTOM BACKUP COMPLETE' as comment) TO '/tmp/backup_data.sql';
\q
EOF

echo "✅ Бэкап создан успешно!"
echo "📁 Файлы бэкапа сохранены в /tmp/"
echo "📋 Список файлов:"
ls -la /tmp/*_backup.csv /tmp/backup_*.sql 2>/dev/null || echo "Файлы не найдены"

echo "🔧 Создание SQL скрипта для восстановления..."
cat > restore_railway_backup.sql << 'EOF'
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
EOF

echo "✅ SQL скрипт восстановления создан: restore_railway_backup.sql"
echo "📋 Теперь вы можете использовать этот скрипт для восстановления данных локально"
