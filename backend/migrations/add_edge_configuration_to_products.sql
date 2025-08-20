-- Миграция для добавления поля edge_configuration_id в таблицу products
-- Дата: 2025-01-22
-- Описание: Добавление поля для связи с конфигурацией края товара

BEGIN;

-- 1. Добавляем поле edge_configuration_id в таблицу products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS edge_configuration_id INTEGER;

-- 2. Добавляем внешний ключ на таблицу edge_configurations
ALTER TABLE products 
ADD CONSTRAINT fk_products_edge_configuration 
FOREIGN KEY (edge_configuration_id) REFERENCES edge_configurations(id) ON DELETE SET NULL;

-- 3. Добавляем комментарий к колонке
COMMENT ON COLUMN products.edge_configuration_id IS 'ID конфигурации края товара для упрощения выбора пользователя';

-- 4. Создаем индекс для быстрого поиска по конфигурации края
CREATE INDEX IF NOT EXISTS idx_products_edge_configuration 
ON products(edge_configuration_id) 
WHERE edge_configuration_id IS NOT NULL;

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_edge_configuration_to_products выполнена успешно' as status;



