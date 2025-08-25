-- Миграция: Переименование поля "thickness_mm" → "height_mm"
-- Цель: унифицировать терминологию L×W×H
-- Дата: 2025-08-19

-- Обновляем комментарий к таблице products
COMMENT ON TABLE products IS 'Товары с размерами L×W×H (длина×ширина×высота)';

-- Переименовываем колонку thickness_mm в height_mm
ALTER TABLE products RENAME COLUMN thickness_mm TO height_mm;

-- Обновляем комментарий к колонке
COMMENT ON COLUMN products.height_mm IS 'Высота товара в миллиметрах (L×W×H)';

-- Создаем индекс для оптимизации поиска по высоте
CREATE INDEX IF NOT EXISTS idx_products_height_mm ON products(height_mm);

-- Удаляем старый индекс по thickness_mm если он существует
DROP INDEX IF EXISTS idx_products_thickness_mm;

-- Добавляем комментарий к индексу
COMMENT ON INDEX idx_products_height_mm IS 'Индекс для поиска по высоте товара (L×W×H)';

-- Проверяем результат
SELECT 
    COUNT(*) as total_products,
    COUNT(height_mm) as with_height
FROM products;

-- Показываем несколько примеров
SELECT id, name, length_mm, width_mm, height_mm 
FROM products 
WHERE height_mm IS NOT NULL 
LIMIT 5;
