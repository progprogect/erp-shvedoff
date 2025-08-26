-- Миграция: Удаление "пазл" из справочника "поверхность"
-- Цель: вывести "пазл" в отдельный параметр "край ковра"
-- Дата: 2025-08-19

-- Проверяем, есть ли товары с поверхностью "пазл"
SELECT 
    COUNT(*) as products_with_puzzle_surface,
    COUNT(CASE WHEN puzzle_type_id IS NOT NULL THEN 1 END) as with_puzzle_type,
    COUNT(CASE WHEN puzzle_sides IS NOT NULL THEN 1 END) as with_puzzle_sides
FROM products 
WHERE surface_id = (SELECT id FROM product_surfaces WHERE name = 'Паззл');

-- Удаляем "пазл" из справочника поверхностей
DELETE FROM product_surfaces WHERE name = 'Паззл';

-- Проверяем результат
SELECT * FROM product_surfaces ORDER BY id;
