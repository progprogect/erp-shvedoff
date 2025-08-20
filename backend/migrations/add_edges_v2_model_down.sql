-- Down-миграция: Откат расширения модели товара с поддержкой краёв и бортов (edges_v2)
-- Дата: 2025-08-18
-- Цель: Откат всех изменений миграции add_edges_v2_model
-- Использование: Только в случае критических проблем

BEGIN;

-- ===== 1. УДАЛЕНИЕ ИНДЕКСОВ =====

-- Удаляем составные индексы
DROP INDEX IF EXISTS idx_product_edges_puzzle_filter;
DROP INDEX IF EXISTS idx_products_dimensions_filter;

-- Удаляем основные индексы
DROP INDEX IF EXISTS idx_product_edges_reinforced;
DROP INDEX IF EXISTS idx_product_edges_side_type;
DROP INDEX IF EXISTS idx_product_edges_edge_type;
DROP INDEX IF EXISTS idx_product_edges_product_id;
DROP INDEX IF EXISTS idx_products_bottom_type_id;
DROP INDEX IF EXISTS idx_products_height_mm;

-- ===== 2. УДАЛЕНИЕ FK СВЯЗЕЙ =====

-- Удаляем внешний ключ для bottom_type_id
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_bottom_type;

-- ===== 3. УДАЛЕНИЕ ТАБЛИЦ =====

-- Удаляем таблицу краёв товара
DROP TABLE IF EXISTS product_edges;

-- Удаляем таблицу типов нижней поверхности
DROP TABLE IF EXISTS bottom_types;

-- ===== 4. УДАЛЕНИЕ ENUM ТИПОВ =====

-- Удаляем ENUM типы
DROP TYPE IF EXISTS edge_side;
DROP TYPE IF EXISTS edge_type;

-- ===== 5. УДАЛЕНИЕ ПОЛЕЙ ИЗ PRODUCTS =====

-- Удаляем поле bottom_type_id
ALTER TABLE products DROP COLUMN IF EXISTS bottom_type_id;

-- Удаляем поле height_mm
ALTER TABLE products DROP COLUMN IF EXISTS height_mm;

-- ===== 6. ВОССТАНОВЛЕНИЕ СТАРЫХ ДАННЫХ =====

-- Восстанавливаем thickness в dimensions если нужно
-- (это можно сделать через приложение, так как данные остались в dimensions)

-- ===== 7. ЛОГИРОВАНИЕ ОТКАТА =====

-- Логируем откат миграции
INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, user_id, created_at)
VALUES (
    'SYSTEM', 
    0, 
    'MIGRATION_ROLLBACK', 
    '{}', 
    '{"migration": "add_edges_v2_model", "status": "rolled_back", "reason": "critical_issues", "tables_removed": ["bottom_types", "product_edges"], "fields_removed": ["height_mm", "bottom_type_id"]}',
    1, 
    NOW()
);

COMMIT;

-- ===== 8. ВЕРИФИКАЦИЯ ОТКАТА =====

-- Проверяем что таблицы удалены
SELECT '=== ВЕРИФИКАЦИЯ ОТКАТА ===' as status;

SELECT 'bottom_types exists' as check_item, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bottom_types') 
            THEN '❌ НЕ УДАЛЕНА' 
            ELSE '✅ УДАЛЕНА' 
       END as status
UNION ALL
SELECT 'product_edges exists', 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_edges') 
            THEN '❌ НЕ УДАЛЕНА' 
            ELSE '✅ УДАЛЕНА' 
       END
UNION ALL
SELECT 'height_mm column exists', 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'height_mm') 
            THEN '❌ НЕ УДАЛЕНА' 
            ELSE '✅ УДАЛЕНА' 
       END
UNION ALL
SELECT 'bottom_type_id column exists', 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'bottom_type_id') 
            THEN '❌ НЕ УДАЛЕНА' 
            ELSE '✅ УДАЛЕНА' 
       END;

-- Проверяем что ENUM типы удалены
SELECT '=== ПРОВЕРКА ENUM ТИПОВ ===' as status;
SELECT typname FROM pg_type WHERE typname IN ('edge_side', 'edge_type');

SELECT '🔄 ОТКАТ МИГРАЦИИ add_edges_v2_model ВЫПОЛНЕН!' as final_status;




