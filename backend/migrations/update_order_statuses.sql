-- Миграция для обновления статусов заказов
-- Дата: 2025-07-16
-- Описание: Обновление старых статусов заказов shipped/delivered на completed

-- 1. Добавляем новое значение 'completed' в enum (если его еще нет)
DO $$
BEGIN
    -- Проверяем существует ли уже 'completed' в enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'completed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
    ) THEN
        ALTER TYPE order_status ADD VALUE 'completed';
    END IF;
END $$;

-- 2. Обновляем существующие заказы
UPDATE orders 
SET status = 'completed', updated_at = NOW()
WHERE status IN ('shipped', 'delivered');

-- 3. Удаляем старые значения из enum (если они больше не используются)
-- Сначала проверяем что не осталось заказов со старыми статусами
DO $$
BEGIN
    -- Проверяем количество заказов со старыми статусами
    IF (SELECT COUNT(*) FROM orders WHERE status IN ('shipped', 'delivered')) = 0 THEN
        -- Если заказов со старыми статусами нет, удаляем значения из enum
        -- Примечание: PostgreSQL не поддерживает прямое удаление значений из enum
        -- Поэтому просто логируем информацию
        RAISE NOTICE 'Старые статусы shipped/delivered больше не используются в заказах';
    ELSE
        RAISE NOTICE 'Обнаружены заказы со старыми статусами shipped/delivered';
    END IF;
END $$;

-- 4. Логируем результаты миграции
SELECT 
    'Миграция статусов заказов завершена' AS message,
    COUNT(*) AS total_orders,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_orders,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_orders
FROM orders; 