-- Создание таблицы shipment_orders для many-to-many связи между отгрузками и заказами
-- Миграция для добавления функционала множественных заказов в отгрузках

-- 1. Создаем таблицу shipment_orders
CREATE TABLE shipment_orders (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Уникальная комбинация shipment_id + order_id
    UNIQUE(shipment_id, order_id)
);

-- 2. Создаем индексы для производительности
CREATE INDEX idx_shipment_orders_shipment_id ON shipment_orders(shipment_id);
CREATE INDEX idx_shipment_orders_order_id ON shipment_orders(order_id);
CREATE INDEX idx_shipment_orders_composite ON shipment_orders(shipment_id, order_id);

-- 3. Переносим существующие данные из shipments.orderId в shipment_orders
INSERT INTO shipment_orders (shipment_id, order_id, created_at)
SELECT 
    id as shipment_id,
    order_id,
    created_at
FROM shipments 
WHERE order_id IS NOT NULL;

-- 4. Удаляем колонку order_id из таблицы shipments (как запрошено)
ALTER TABLE shipments DROP COLUMN order_id;

-- 5. Обновляем связи в схеме (это будет сделано в schema.ts)
-- shipmentsRelations больше не будет ссылаться на orders через orderId

-- 6. Добавляем комментарии для документации
COMMENT ON TABLE shipment_orders IS 'Связь many-to-many между отгрузками и заказами';
COMMENT ON COLUMN shipment_orders.shipment_id IS 'ID отгрузки';
COMMENT ON COLUMN shipment_orders.order_id IS 'ID заказа';
COMMENT ON COLUMN shipment_orders.created_at IS 'Дата создания связи';

-- 7. Проверяем результат
SELECT 
    'shipment_orders' as table_name,
    COUNT(*) as total_records
FROM shipment_orders
UNION ALL
SELECT 
    'shipments' as table_name,
    COUNT(*) as total_records
FROM shipments;
