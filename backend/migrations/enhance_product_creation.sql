-- Миграция: Усовершенствование функционала создания товара
-- Добавляет новые характеристики и сорта товаров

-- 1. Добавляем новые сорта в enum product_grade
ALTER TYPE product_grade ADD VALUE 'telyatnik';
ALTER TYPE product_grade ADD VALUE 'liber';

-- 2. Добавляем поле "пресс" как enum
CREATE TYPE press_type AS ENUM ('not_selected', 'ukrainian', 'chinese');

-- 3. Изменяем surface_id на массив для множественного выбора поверхностей
-- Сначала создаем новое поле
ALTER TABLE products ADD COLUMN surface_ids integer[];

-- Мигрируем существующие данные из surface_id в surface_ids
UPDATE products 
SET surface_ids = ARRAY[surface_id] 
WHERE surface_id IS NOT NULL;

-- 4. Добавляем новые поля
ALTER TABLE products ADD COLUMN press_type press_type DEFAULT 'not_selected';

-- 5. Делаем bottom_type_id опциональным (уже nullable, добавляем комментарий)
COMMENT ON COLUMN products.bottom_type_id IS 'Тип низа ковра (опциональное поле, может быть NULL)';

-- 6. Добавляем индексы для новых полей
CREATE INDEX idx_products_surface_ids ON products USING GIN (surface_ids);
CREATE INDEX idx_products_press_type ON products (press_type);

-- 7. Создаем функцию для проверки валидности surface_ids
CREATE OR REPLACE FUNCTION validate_surface_ids()
RETURNS TRIGGER AS $$
BEGIN
    -- Проверяем что все surface_ids существуют в таблице product_surfaces
    IF NEW.surface_ids IS NOT NULL THEN
        IF NOT (SELECT ARRAY[NEW.surface_ids] <@ ARRAY(SELECT id FROM product_surfaces)) THEN
            RAISE EXCEPTION 'Invalid surface_id in surface_ids array';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Создаем триггер для валидации
CREATE TRIGGER trigger_validate_surface_ids
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION validate_surface_ids();

-- 9. Комментарии для новых полей
COMMENT ON COLUMN products.surface_ids IS 'Массив ID поверхностей (множественный выбор)';
COMMENT ON COLUMN products.press_type IS 'Тип пресса: не выбрано, украинский, китайский';

-- 10. Обновляем значения по умолчанию для существующих enum полей
-- grade по умолчанию уже 'usual', это корректно для "Обычный"

-- Миграция завершена
SELECT 'Migration enhance_product_creation completed successfully' as status;
