-- Миграция: Перенос данных паззла в новые поля края ковра
-- Цель: сохранить целостность после вывода "пазла" в отдельный параметр
-- Дата: 2025-08-19

-- Обновляем существующие товары с паззловыми опциями
UPDATE products 
SET 
    carpet_edge_type = 'puzzle',
    carpet_edge_sides = COALESCE(puzzle_sides, 4),
    carpet_edge_strength = 'normal'
WHERE puzzle_type_id IS NOT NULL OR puzzle_sides IS NOT NULL;

-- Обновляем остальные товары на прямой рез
UPDATE products 
SET 
    carpet_edge_type = 'straight_cut',
    carpet_edge_sides = 1,
    carpet_edge_strength = 'normal'
WHERE puzzle_type_id IS NULL AND puzzle_sides IS NULL;

-- Проверяем результат миграции
SELECT 
    'До миграции' as status,
    COUNT(*) as total_products,
    COUNT(CASE WHEN puzzle_type_id IS NOT NULL THEN 1 END) as with_puzzle_type,
    COUNT(CASE WHEN puzzle_sides IS NOT NULL THEN 1 END) as with_puzzle_sides
FROM products;

SELECT 
    'После миграции' as status,
    carpet_edge_type,
    carpet_edge_sides,
    carpet_edge_strength,
    COUNT(*) as products_count
FROM products 
GROUP BY carpet_edge_type, carpet_edge_sides, carpet_edge_strength
ORDER BY carpet_edge_type, carpet_edge_sides;

-- Показываем несколько примеров мигрированных товаров
SELECT 
    id,
    name,
    sku,
    carpet_edge_type,
    carpet_edge_sides,
    carpet_edge_strength,
    puzzle_type_id,
    puzzle_sides
FROM products 
ORDER BY carpet_edge_type DESC, id
LIMIT 10;
