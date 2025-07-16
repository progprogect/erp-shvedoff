-- Миграция для упрощения статусов отгрузок и добавления updatedAt

-- Добавляем поле updatedAt
ALTER TABLE shipments ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- Обновляем existing значения статусов для совместимости с новой системой
UPDATE shipments SET status = 'pending' WHERE status = 'planned';
UPDATE shipments SET status = 'completed' WHERE status IN ('shipped', 'delivered');
UPDATE shipments SET status = 'cancelled' WHERE status = 'cancelled'; -- уже правильный

-- Удаляем старый enum
DROP TYPE IF EXISTS shipment_status CASCADE;

-- Создаем новый enum со simplified статусами
CREATE TYPE shipment_status AS ENUM ('pending', 'completed', 'cancelled', 'paused');

-- Обновляем колонку статуса с новым типом
ALTER TABLE shipments ALTER COLUMN status TYPE shipment_status USING status::shipment_status;
ALTER TABLE shipments ALTER COLUMN status SET DEFAULT 'pending';

-- Устанавливаем updated_at для всех существующих записей
UPDATE shipments SET updated_at = created_at WHERE updated_at IS NULL; 