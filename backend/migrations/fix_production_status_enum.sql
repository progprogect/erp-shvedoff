-- Исправляем только enum тип для статуса production_tasks

-- 1. Проверяем какие enum типы есть
\dT+ production_task_status*

-- 2. Обновляем данные: меняем старые статусы на новые
UPDATE production_tasks 
SET status = CASE 
  WHEN status::text = 'suggested' THEN 'pending'
  WHEN status::text = 'approved' THEN 'pending'
  WHEN status::text = 'rejected' THEN 'cancelled'
  WHEN status::text = 'postponed' THEN 'cancelled'
  ELSE status::text
END::production_task_status_old;

-- 3. Создаем правильный enum
DROP TYPE IF EXISTS production_task_status;
CREATE TYPE production_task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- 4. Обновляем колонку на новый тип
ALTER TABLE production_tasks 
ALTER COLUMN status TYPE production_task_status 
USING status::text::production_task_status;

-- 5. Удаляем старый тип
DROP TYPE production_task_status_old;

-- 6. Устанавливаем правильный дефолт
ALTER TABLE production_tasks ALTER COLUMN status SET DEFAULT 'pending';

-- 7. Проверяем результат
SELECT status, COUNT(*) as count FROM production_tasks GROUP BY status; 