-- ЭТАП 1: Добавляем значение к enum (должно быть в отдельной транзакции)
ALTER TYPE product_type ADD VALUE 'pur';

-- ЭТАП 2: Добавляем поле и ограничения
BEGIN;

-- Добавляем поле pur_number для номера ПУР
ALTER TABLE products ADD COLUMN pur_number INTEGER;

-- Добавляем комментарий для документации
COMMENT ON COLUMN products.pur_number IS 'Номер ПУР (только для товаров типа pur)';

-- Добавляем индекс для быстрого поиска по номеру ПУР
CREATE INDEX idx_products_pur_number ON products (pur_number) WHERE pur_number IS NOT NULL;

-- Добавляем проверочное ограничение: pur_number должен быть положительным
ALTER TABLE products ADD CONSTRAINT check_pur_number_positive 
  CHECK (pur_number IS NULL OR pur_number > 0);

COMMIT;
