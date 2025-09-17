-- Backup production БД через SQL команды
-- Дата: $(date)

\echo '=== СОЗДАНИЕ BACKUP PRODUCTION ==='

-- Backup критически важных справочников
\echo '--- BACKUP: categories ---'
\copy categories TO 'production_categories_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: bottom_types ---'
\copy bottom_types TO 'production_bottom_types_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: carpet_edge_types ---'
\copy carpet_edge_types TO 'production_carpet_edge_types_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: product_materials ---'
\copy product_materials TO 'production_materials_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: product_surfaces ---'
\copy product_surfaces TO 'production_surfaces_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: product_logos ---'
\copy product_logos TO 'production_logos_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: puzzle_types ---'
\copy puzzle_types TO 'production_puzzle_types_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: users ---'
\copy users TO 'production_users_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: products ---'
\copy products TO 'production_products_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: stock ---'
\copy stock TO 'production_stock_backup.csv' WITH CSV HEADER;

\echo '--- BACKUP: roll_covering_composition ---'
\copy roll_covering_composition TO 'production_roll_composition_backup.csv' WITH CSV HEADER;

\echo '=== BACKUP ЗАВЕРШЕН ==='






