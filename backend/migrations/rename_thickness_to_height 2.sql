-- Миграция: Переименование поля "толщина" → "высота"
-- Цель: унифицировать терминологию L×W×H
-- Дата: 2025-08-19

-- Обновляем комментарий к таблице products
COMMENT ON TABLE products IS 'Товары с размерами L×W×H (длина×ширина×высота)';

-- Обновляем комментарий к полю dimensions
COMMENT ON COLUMN products.dimensions IS 'Размеры товара: {length: длина в мм, width: ширина в мм, height: высота в мм}';

-- Создаем функцию для обновления существующих данных
CREATE OR REPLACE FUNCTION update_thickness_to_height()
RETURNS void AS $$
DECLARE
    product_record RECORD;
BEGIN
    -- Обновляем все записи, где есть поле thickness
    FOR product_record IN 
        SELECT id, dimensions 
        FROM products 
        WHERE dimensions IS NOT NULL 
        AND dimensions ? 'thickness'
    LOOP
        -- Обновляем dimensions, заменяя thickness на height
        UPDATE products 
        SET dimensions = jsonb_set(
            dimensions - 'thickness', 
            '{height}', 
            dimensions->'thickness'
        )
        WHERE id = product_record.id;
        
        RAISE NOTICE 'Обновлен товар ID %: thickness → height', product_record.id;
    END LOOP;
    
    RAISE NOTICE 'Миграция thickness → height завершена';
END;
$$ LANGUAGE plpgsql;

-- Выполняем миграцию
SELECT update_thickness_to_height();

-- Удаляем функцию
DROP FUNCTION update_thickness_to_height();

-- Проверяем результат
SELECT 
    COUNT(*) as total_products,
    COUNT(CASE WHEN dimensions ? 'thickness' THEN 1 END) as with_thickness,
    COUNT(CASE WHEN dimensions ? 'height' THEN 1 END) as with_height
FROM products 
WHERE dimensions IS NOT NULL;

-- Создаем индекс для оптимизации поиска по высоте
CREATE INDEX IF NOT EXISTS idx_products_dimensions_height 
ON products USING GIN ((dimensions->'height'));

-- Удаляем старый индекс по thickness если он существует
DROP INDEX IF EXISTS idx_products_dimensions_thickness;

-- Добавляем комментарий к индексу
COMMENT ON INDEX idx_products_dimensions_height IS 'Индекс для поиска по высоте товара (L×W×H)';
