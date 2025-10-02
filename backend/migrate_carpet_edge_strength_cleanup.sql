-- =====================================================
-- МИГРАЦИЯ: Очистка значений carpetEdgeStrength
-- =====================================================
-- Описание: Приводит все значения carpetEdgeStrength к стандартным:
--          'weak' -> 'normal' (Не усиленный)
--          'strong' -> 'reinforced' (Усиленный)
--          'normal' и 'reinforced' остаются без изменений
--          null остается null
-- =====================================================

-- Создаем резервную копию перед миграцией
CREATE TABLE IF NOT EXISTS products_carpet_edge_backup AS 
SELECT id, carpet_edge_strength, updated_at 
FROM products 
WHERE carpet_edge_strength IS NOT NULL;

-- Добавляем колонку для отметки о резервном копировании
ALTER TABLE products_carpet_edge_backup 
ADD COLUMN IF NOT EXISTS backup_created_at TIMESTAMP DEFAULT NOW();

-- 1. Миграция 'weak' -> 'normal'
UPDATE products 
SET 
    carpet_edge_strength = 'normal',
    updated_at = NOW()
WHERE carpet_edge_strength = 'weak';

-- 2. Миграция 'strong' -> 'reinforced'  
UPDATE products 
SET 
    carpet_edge_strength = 'reinforced',
    updated_at = NOW()
WHERE carpet_edge_strength = 'strong';

-- 3. Проверяем результат миграции
SELECT 
    'Статистика после миграции:' as info,
    carpet_edge_strength,
    COUNT(*) as count
FROM products 
WHERE carpet_edge_strength IS NOT NULL
GROUP BY carpet_edge_strength
ORDER BY carpet_edge_strength;

-- 4. Проверяем, что старые значения больше не существуют
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Миграция успешна: старые значения отсутствуют'
        ELSE '❌ ОШИБКА: найдены старые значения: ' || STRING_AGG(DISTINCT carpet_edge_strength, ', ')
    END as migration_status
FROM products 
WHERE carpet_edge_strength IN ('weak', 'strong');

-- 5. Показываем общую статистику
SELECT 
    'Общая статистика carpetEdgeStrength:' as info,
    COALESCE(carpet_edge_strength, 'NULL') as value,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM products 
GROUP BY carpet_edge_strength
ORDER BY carpet_edge_strength NULLS LAST;

-- =====================================================
-- ИНСТРУКЦИИ ПО ВОССТАНОВЛЕНИЮ (при необходимости):
-- =====================================================
-- Если нужно откатить изменения:
-- 
-- UPDATE products 
-- SET carpet_edge_strength = pceb.carpet_edge_strength,
--     updated_at = NOW()
-- FROM products_carpet_edge_backup pceb
-- WHERE products.id = pceb.id;
-- 
-- DROP TABLE products_carpet_edge_backup;
-- =====================================================

COMMIT;
