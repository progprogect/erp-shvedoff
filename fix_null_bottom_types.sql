-- Исправление NULL значений bottom_type_id в товарах
-- NULL → not_selected (ID=6)

BEGIN;

\echo '=== ИСПРАВЛЕНИЕ NULL ЗНАЧЕНИЙ BOTTOM_TYPE_ID ==='

-- Проверяем текущее состояние
\echo '--- СОСТОЯНИЕ ДО ИСПРАВЛЕНИЯ ---'
SELECT 
    CASE WHEN bottom_type_id IS NULL THEN 'NULL' ELSE bottom_type_id::text END as bottom_type_id,
    count(*) as количество
FROM products 
WHERE product_type = 'carpet'
GROUP BY bottom_type_id
ORDER BY count(*) DESC;

-- Создаем backup
\echo '--- СОЗДАНИЕ BACKUP ---'
CREATE TABLE IF NOT EXISTS products_bottom_type_fix_backup AS 
SELECT id, article, bottom_type_id, created_at, updated_at 
FROM products 
WHERE product_type = 'carpet' AND bottom_type_id IS NULL;

SELECT count(*) as backup_records FROM products_bottom_type_fix_backup;

-- Обновляем NULL значения на not_selected (ID=6)
\echo '--- ОБНОВЛЕНИЕ NULL → NOT_SELECTED ---'
UPDATE products 
SET 
    bottom_type_id = 6, -- ID для "Не выбрано"
    updated_at = now()
WHERE product_type = 'carpet' 
AND bottom_type_id IS NULL;

-- Проверяем результат
\echo '--- РЕЗУЛЬТАТ ПОСЛЕ ИСПРАВЛЕНИЯ ---'
SELECT 
    CASE WHEN bottom_type_id IS NULL THEN 'NULL' ELSE bottom_type_id::text END as bottom_type_id,
    bt.name as bottom_type_name,
    count(*) as количество
FROM products p
LEFT JOIN bottom_types bt ON p.bottom_type_id = bt.id
WHERE p.product_type = 'carpet'
GROUP BY p.bottom_type_id, bt.name
ORDER BY count(*) DESC;

\echo '=== ИСПРАВЛЕНИЕ ЗАВЕРШЕНО ==='

COMMIT;


