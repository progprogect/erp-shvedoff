-- Скрипт для сравнения справочных данных между staging и production
-- Справочные таблицы: categories, product_materials, product_surfaces, product_logos, bottom_types, puzzle_types, carpet_edge_types

\echo '=== КАТЕГОРИИ ==='
SELECT 'categories' as table_name, count(*) as total_count FROM categories;
SELECT id, name, parent_id, sort_order FROM categories ORDER BY id;

\echo '=== МАТЕРИАЛЫ ==='
SELECT 'product_materials' as table_name, count(*) as total_count FROM product_materials;
SELECT id, name, description FROM product_materials ORDER BY id;

\echo '=== ПОВЕРХНОСТИ ==='
SELECT 'product_surfaces' as table_name, count(*) as total_count FROM product_surfaces;
SELECT id, name, description FROM product_surfaces ORDER BY id;

\echo '=== ЛОГОТИПЫ ==='
SELECT 'product_logos' as table_name, count(*) as total_count FROM product_logos;
SELECT id, name, description FROM product_logos ORDER BY id;

\echo '=== ТИПЫ НИЗА ==='
SELECT 'bottom_types' as table_name, count(*) as total_count FROM bottom_types;
SELECT id, code, name, description, is_system FROM bottom_types ORDER BY id;

\echo '=== ТИПЫ ПАЗЗЛОВ ==='
SELECT 'puzzle_types' as table_name, count(*) as total_count FROM puzzle_types;
SELECT id, name, code, description FROM puzzle_types ORDER BY id;

\echo '=== ТИПЫ КРОМОК КОВРОВ ==='
SELECT 'carpet_edge_types' as table_name, count(*) as total_count FROM carpet_edge_types;
SELECT id, name, code, description FROM carpet_edge_types ORDER BY id;

\echo '=== ПОЛЬЗОВАТЕЛИ ==='
SELECT 'users' as table_name, count(*) as total_count FROM users;
SELECT id, username, role, created_at FROM users ORDER BY id;

\echo '=== ТОВАРЫ ==='
SELECT 'products' as table_name, count(*) as total_count FROM products;
SELECT 
    product_type,
    count(*) as count_by_type
FROM products 
GROUP BY product_type 
ORDER BY product_type;

\echo '=== ОСТАТКИ НА СКЛАДЕ ==='
SELECT 'stock' as table_name, count(*) as total_count FROM stock;
SELECT 
    sum(current_stock) as total_quantity,
    sum(reserved_stock) as total_reserved
FROM stock;

\echo '=== ЗАКАЗЫ ==='
SELECT 'orders' as table_name, count(*) as total_count FROM orders;
SELECT 
    status,
    count(*) as count_by_status
FROM orders 
GROUP BY status 
ORDER BY status;

\echo '=== АУДИТ ==='
SELECT 'audit_log' as table_name, count(*) as total_count FROM audit_log;
SELECT 
    table_name,
    count(*) as operations_count
FROM audit_log 
GROUP BY table_name 
ORDER BY operations_count DESC 
LIMIT 10;
