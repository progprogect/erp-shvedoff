-- Миграция: Добавление индексов для оптимизации запросов к stock_movements
-- Дата создания: 2025-01-XX
-- Описание: Индексы для ускорения запросов по referenceType и productId

-- Индекс для фильтрации по referenceType и сортировки по дате
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_type 
ON stock_movements(reference_type, created_at DESC);

-- Индекс для фильтрации по productId и сортировки по дате
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id 
ON stock_movements(product_id, created_at DESC);

-- Композитный индекс для комбинированных запросов
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_product 
ON stock_movements(reference_type, product_id, created_at DESC);

-- Комментарии к индексам
COMMENT ON INDEX idx_stock_movements_reference_type IS 'Индекс для фильтрации движений по типу ссылки (referenceType) и сортировки по дате';
COMMENT ON INDEX idx_stock_movements_product_id IS 'Индекс для фильтрации движений по товару (productId) и сортировки по дате';
COMMENT ON INDEX idx_stock_movements_reference_product IS 'Композитный индекс для оптимизации запросов с фильтрацией по referenceType и productId';

