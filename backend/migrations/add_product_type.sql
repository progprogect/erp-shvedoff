-- Миграция: Добавление типа товара (Ковер/Другое)
-- Дата: 2025-08-26
-- Описание: Добавляет поле product_type для разделения ковровых товаров и прочих товаров

BEGIN;

-- Создаем enum для типа товара
CREATE TYPE product_type AS ENUM ('carpet', 'other');

-- Добавляем поле product_type в таблицу products
ALTER TABLE products 
ADD COLUMN product_type product_type DEFAULT 'carpet' NOT NULL;

-- Добавляем комментарий к полю
COMMENT ON COLUMN products.product_type IS 'Тип товара: carpet (ковровые изделия) или other (прочие товары)';

-- Добавляем индекс для быстрого поиска по типу товара
CREATE INDEX idx_products_product_type ON products(product_type);

-- Все существующие товары по умолчанию считаются ковровыми
UPDATE products SET product_type = 'carpet' WHERE product_type IS NULL;

COMMIT;
