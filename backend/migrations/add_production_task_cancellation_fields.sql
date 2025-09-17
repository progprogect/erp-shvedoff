-- Миграция: Добавление полей для отмены производственных заданий
-- Дата: 2025-09-17
-- Описание: Добавляет поля cancelled_by и cancel_reason в таблицу production_tasks

-- Добавляем поле cancelled_by (кто отменил задание)
ALTER TABLE production_tasks 
ADD COLUMN cancelled_by integer REFERENCES users(id);

-- Добавляем поле cancel_reason (причина отмены)
ALTER TABLE production_tasks 
ADD COLUMN cancel_reason text;

-- Создаем индекс для быстрого поиска отмененных заданий
CREATE INDEX idx_production_tasks_cancelled 
ON production_tasks (status, cancelled_by) 
WHERE status = 'cancelled';

-- Комментарии к полям
COMMENT ON COLUMN production_tasks.cancelled_by IS 'ID пользователя, который отменил задание';
COMMENT ON COLUMN production_tasks.cancel_reason IS 'Причина отмены производственного задания';

-- Проверка результата
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'production_tasks' 
    AND column_name IN ('cancelled_by', 'cancel_reason')
ORDER BY column_name;
