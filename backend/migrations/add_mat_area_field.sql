-- Миграция для добавления поля площади мата
-- Дата: 2025-07-23
-- Описание: Добавление поля mat_area для автоматического расчета площади мата

BEGIN;

-- 1. Добавляем колонку mat_area в таблицу products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS mat_area DECIMAL(10,4) DEFAULT NULL;

-- 2. Добавляем комментарий к колонке для документации
COMMENT ON COLUMN products.mat_area IS 'Площадь мата в квадратных метрах. Автоматически рассчитывается как (length * width) / 1000000, но может быть откорректирована вручную';

-- 3. Создаем функцию для автоматического расчета площади мата
CREATE OR REPLACE FUNCTION calculate_mat_area(dimensions_json JSONB) 
RETURNS DECIMAL(10,4) AS $$
DECLARE
    length_mm DECIMAL;
    width_mm DECIMAL;
    area_m2 DECIMAL(10,4);
BEGIN
    -- Извлекаем длину и ширину из JSON
    length_mm := (dimensions_json->>'length')::DECIMAL;
    width_mm := (dimensions_json->>'width')::DECIMAL;
    
    -- Если размеры указаны, рассчитываем площадь в м²
    IF length_mm IS NOT NULL AND width_mm IS NOT NULL AND length_mm > 0 AND width_mm > 0 THEN
        area_m2 := (length_mm * width_mm) / 1000000.0;
        RETURN ROUND(area_m2, 4);
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Создаем триггер для автоматического обновления mat_area при изменении dimensions
-- (только если mat_area не было установлено вручную)
CREATE OR REPLACE FUNCTION update_mat_area_trigger() 
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем mat_area только если оно NULL или не было установлено вручную
    -- (предполагаем, что если mat_area = calculated_area, то это автоматический расчет)
    IF NEW.dimensions IS NOT NULL AND 
       (OLD.mat_area IS NULL OR 
        OLD.mat_area = calculate_mat_area(OLD.dimensions) OR
        NEW.mat_area IS NULL) THEN
        NEW.mat_area := calculate_mat_area(NEW.dimensions);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Создаем триггер на обновление
DROP TRIGGER IF EXISTS trigger_update_mat_area ON products;
CREATE TRIGGER trigger_update_mat_area 
    BEFORE INSERT OR UPDATE OF dimensions 
    ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION update_mat_area_trigger();

-- 6. Заполняем mat_area для существующих товаров с размерами
UPDATE products 
SET mat_area = calculate_mat_area(dimensions)
WHERE dimensions IS NOT NULL 
  AND mat_area IS NULL;

-- 7. Создаем индекс для эффективного поиска по площади
CREATE INDEX IF NOT EXISTS idx_products_mat_area 
ON products (mat_area) 
WHERE mat_area IS NOT NULL;

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_mat_area_field выполнена успешно' as status; 