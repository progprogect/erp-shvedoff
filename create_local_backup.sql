-- Создание локального backup затронутых товаров
\copy (SELECT id, article, name, carpet_edge_type as старый_carpet_edge_type, created_at, updated_at FROM products WHERE carpet_edge_type IN ('straight_cut', 'podpuzzle', 'litoy_puzzle') ORDER BY carpet_edge_type, id) TO 'products_carpet_edge_backup_local.csv' WITH CSV HEADER;



