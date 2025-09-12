#!/bin/bash

# Скрипт для выполнения миграции shipment_orders на Railway
# Добавляет таблицу связи many-to-many между отгрузками и заказами

echo "🚀 Начинаем миграцию shipment_orders..."

# URL базы данных Railway
DATABASE_URL="postgresql://postgres:pTMtLhlEmgeRAtUlFvGBhAYLNIlMkhwL@tramway.proxy.rlwy.net:50363/railway"

# Проверяем подключение к БД
echo "📡 Проверяем подключение к базе данных..."
psql "$DATABASE_URL" -c "SELECT version();" || {
    echo "❌ Ошибка подключения к базе данных"
    exit 1
}

echo "✅ Подключение к базе данных успешно"

# Выполняем миграцию
echo "🔄 Выполняем миграцию..."

psql "$DATABASE_URL" << 'EOF'
-- Создание таблицы shipment_orders для many-to-many связи между отгрузками и заказами
-- Миграция для добавления функционала множественных заказов в отгрузках

-- 1. Создаем таблицу shipment_orders
CREATE TABLE IF NOT EXISTS shipment_orders (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Уникальная комбинация shipment_id + order_id
    UNIQUE(shipment_id, order_id)
);

-- 2. Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_shipment_orders_shipment_id ON shipment_orders(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_orders_order_id ON shipment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_shipment_orders_composite ON shipment_orders(shipment_id, order_id);

-- 3. Переносим существующие данные из shipments.orderId в shipment_orders
INSERT INTO shipment_orders (shipment_id, order_id, created_at)
SELECT 
    id as shipment_id,
    order_id,
    created_at
FROM shipments 
WHERE order_id IS NOT NULL
ON CONFLICT (shipment_id, order_id) DO NOTHING;

-- 4. Удаляем колонку order_id из таблицы shipments
ALTER TABLE shipments DROP COLUMN IF EXISTS order_id;

-- 5. Добавляем комментарии для документации
COMMENT ON TABLE shipment_orders IS 'Связь many-to-many между отгрузками и заказами';
COMMENT ON COLUMN shipment_orders.shipment_id IS 'ID отгрузки';
COMMENT ON COLUMN shipment_orders.order_id IS 'ID заказа';
COMMENT ON COLUMN shipment_orders.created_at IS 'Дата создания связи';

-- 6. Проверяем результат
SELECT 
    'shipment_orders' as table_name,
    COUNT(*) as total_records
FROM shipment_orders
UNION ALL
SELECT 
    'shipments' as table_name,
    COUNT(*) as total_records
FROM shipments;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Миграция успешно выполнена!"
    echo "📊 Результат миграции:"
    psql "$DATABASE_URL" -c "
        SELECT 
            'shipment_orders' as table_name,
            COUNT(*) as total_records
        FROM shipment_orders
        UNION ALL
        SELECT 
            'shipments' as table_name,
            COUNT(*) as total_records
        FROM shipments;
    "
else
    echo "❌ Ошибка при выполнении миграции"
    exit 1
fi

echo "🎉 Миграция завершена успешно!"
