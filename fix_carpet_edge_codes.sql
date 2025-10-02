-- Исправление кодов carpet_edge_type в товарах
-- Backup создан локально: products_carpet_edge_backup_local.csv

BEGIN;

\echo '=== ИСПРАВЛЕНИЕ КОДОВ CARPET_EDGE_TYPE В ТОВАРАХ ==='

-- 1. Создание backup таблицы в БД
\echo '--- Создание backup таблицы в БД ---'
CREATE TABLE products_carpet_edge_backup AS 
SELECT id, article, name, carpet_edge_type, created_at, updated_at 
FROM products 
WHERE carpet_edge_type IN ('straight_cut', 'podpuzzle', 'litoy_puzzle');

\echo '--- Backup создан, записей в backup таблице: ---'
SELECT count(*) as backup_records FROM products_carpet_edge_backup;

-- 2. Показать текущее состояние ПЕРЕД обновлением
\echo '--- СОСТОЯНИЕ ДО ОБНОВЛЕНИЯ ---'
SELECT 
    carpet_edge_type as старый_код,
    count(*) as количество_товаров,
    CASE 
        WHEN carpet_edge_type = 'straight_cut' THEN 'direct_cut (Прямой рез)'
        WHEN carpet_edge_type = 'podpuzzle' THEN 'sub_puzzle (Подпазл)'
        WHEN carpet_edge_type = 'litoy_puzzle' THEN 'cast_puzzle (Литой пазл)'
    END as новый_код
FROM products 
WHERE carpet_edge_type IN ('straight_cut', 'podpuzzle', 'litoy_puzzle')
GROUP BY carpet_edge_type
ORDER BY count(*) DESC;

-- 3. ОБНОВЛЕНИЕ ТОВАРОВ
\echo '--- ОБНОВЛЕНИЕ КОДОВ ---'

-- 98 товаров: straight_cut → direct_cut (Прямой рез)
UPDATE products SET 
    carpet_edge_type = 'direct_cut',
    updated_at = now()
WHERE carpet_edge_type = 'straight_cut';

-- 3 товара: podpuzzle → sub_puzzle (Подпазл)  
UPDATE products SET 
    carpet_edge_type = 'sub_puzzle',
    updated_at = now()
WHERE carpet_edge_type = 'podpuzzle';

-- 4 товара: litoy_puzzle → cast_puzzle (Литой пазл)
UPDATE products SET 
    carpet_edge_type = 'cast_puzzle',
    updated_at = now()
WHERE carpet_edge_type = 'litoy_puzzle';

-- 4. Проверка результата
\echo '--- ПРОВЕРКА РЕЗУЛЬТАТА ---'

-- Убедиться, что старых кодов не осталось
SELECT 
    'СТАРЫЕ КОДЫ (должно быть 0)' as проверка,
    count(*) as осталось_товаров
FROM products 
WHERE carpet_edge_type IN ('straight_cut', 'podpuzzle', 'litoy_puzzle');

-- Показать новое распределение
\echo '--- НОВОЕ РАСПРЕДЕЛЕНИЕ КОДОВ ---'
SELECT 
    carpet_edge_type,
    count(*) as количество_товаров
FROM products 
WHERE carpet_edge_type IN ('direct_cut', 'sub_puzzle', 'cast_puzzle', 'puzzle', 'straight_cut')
GROUP BY carpet_edge_type
ORDER BY count(*) DESC;

\echo '=== ИСПРАВЛЕНИЕ ЗАВЕРШЕНО ==='

COMMIT;










