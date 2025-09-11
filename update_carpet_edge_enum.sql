-- Обновление ENUM carpet_edge_type и исправление товаров
-- ВАЖНО: Сначала добавляем новые значения в ENUM, потом обновляем товары

BEGIN;

\echo '=== ОБНОВЛЕНИЕ ENUM CARPET_EDGE_TYPE ==='

-- 1. Добавляем новые значения в ENUM
\echo '--- Добавление новых значений в ENUM ---'

-- Добавляем direct_cut (для Прямой рез)
ALTER TYPE carpet_edge_type ADD VALUE IF NOT EXISTS 'direct_cut';

-- Добавляем sub_puzzle (для Подпазл)  
ALTER TYPE carpet_edge_type ADD VALUE IF NOT EXISTS 'sub_puzzle';

-- Добавляем cast_puzzle (для Литой пазл)
ALTER TYPE carpet_edge_type ADD VALUE IF NOT EXISTS 'cast_puzzle';

\echo '--- Проверка обновленного ENUM ---'
SELECT enumlabel as доступные_значения
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'carpet_edge_type'
ORDER BY e.enumsortorder;

-- 2. Создание backup таблицы
\echo '--- Создание backup таблицы ---'
DROP TABLE IF EXISTS products_carpet_edge_backup;
CREATE TABLE products_carpet_edge_backup AS 
SELECT id, article, name, carpet_edge_type, created_at, updated_at 
FROM products 
WHERE carpet_edge_type IN ('straight_cut', 'podpuzzle', 'litoy_puzzle');

SELECT count(*) as backup_records FROM products_carpet_edge_backup;

-- 3. ОБНОВЛЕНИЕ ТОВАРОВ
\echo '--- ОБНОВЛЕНИЕ ТОВАРОВ ---'

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

-- 4. Финальная проверка
\echo '--- ФИНАЛЬНАЯ ПРОВЕРКА ---'

-- Старых кодов не должно остаться
SELECT 
    'СТАРЫЕ КОДЫ' as проверка,
    count(*) as должно_быть_ноль
FROM products 
WHERE carpet_edge_type IN ('straight_cut', 'podpuzzle', 'litoy_puzzle');

-- Новое распределение
SELECT 
    carpet_edge_type,
    count(*) as количество
FROM products 
WHERE product_type = 'carpet'
GROUP BY carpet_edge_type
ORDER BY count(*) DESC;

\echo '=== ОБНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО ==='

COMMIT;

