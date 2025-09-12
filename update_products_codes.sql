-- Обновление товаров с новыми кодами carpet_edge_type

BEGIN;

\echo '=== ОБНОВЛЕНИЕ ТОВАРОВ ==='

-- Создание backup
\echo '--- Создание backup ---'
DROP TABLE IF EXISTS products_carpet_edge_backup;
CREATE TABLE products_carpet_edge_backup AS 
SELECT id, article, name, carpet_edge_type, created_at, updated_at 
FROM products 
WHERE carpet_edge_type IN ('straight_cut', 'podpuzzle', 'litoy_puzzle');

SELECT count(*) as backup_records FROM products_carpet_edge_backup;

-- Показать состояние ДО
\echo '--- СОСТОЯНИЕ ДО ОБНОВЛЕНИЯ ---'
SELECT 
    carpet_edge_type,
    count(*) as количество
FROM products 
WHERE carpet_edge_type IN ('straight_cut', 'podpuzzle', 'litoy_puzzle')
GROUP BY carpet_edge_type;

-- ОБНОВЛЕНИЕ
\echo '--- ВЫПОЛНЕНИЕ ОБНОВЛЕНИЯ ---'

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

-- ПРОВЕРКА
\echo '--- ФИНАЛЬНАЯ ПРОВЕРКА ---'

-- Старых кодов не должно остаться
SELECT 
    'СТАРЫЕ КОДЫ (должно быть 0)' as проверка,
    count(*) as осталось
FROM products 
WHERE carpet_edge_type IN ('straight_cut', 'podpuzzle', 'litoy_puzzle');

-- Новое распределение всех кодов
\echo '--- ИТОГОВОЕ РАСПРЕДЕЛЕНИЕ КОДОВ ---'
SELECT 
    carpet_edge_type,
    count(*) as количество
FROM products 
WHERE product_type = 'carpet'
GROUP BY carpet_edge_type
ORDER BY count(*) DESC;

\echo '=== ОБНОВЛЕНИЕ ТОВАРОВ ЗАВЕРШЕНО ==='

COMMIT;



