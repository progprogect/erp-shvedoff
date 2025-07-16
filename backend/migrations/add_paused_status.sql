-- Добавляем статус "paused" (на паузе) для операций резки и производственных заданий
-- Дата: 16.07.2025

-- Добавляем статус "paused" в enum для операций резки
ALTER TYPE cutting_status ADD VALUE IF NOT EXISTS 'paused';

-- Добавляем статус "paused" в enum для производственных заданий  
ALTER TYPE production_task_status ADD VALUE IF NOT EXISTS 'paused';

-- Комментарий для аудита
INSERT INTO audit_log (table_name, operation, new_values, comment)
VALUES ('system', 'MIGRATION', '{"migration": "add_paused_status", "date": "2025-07-16"}', 'Добавлен статус "На паузе" для заявок и заданий'); 