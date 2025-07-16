-- Финальное исправление enum типа для production_tasks

-- 1. Сначала убираем дефолт, чтобы не было конфликтов
ALTER TABLE production_tasks ALTER COLUMN status DROP DEFAULT;

-- 2. Обновляем данные (если еще есть старые статусы)
UPDATE production_tasks 
SET status = CASE 
  WHEN status::text = 'suggested' THEN 'pending'
  WHEN status::text = 'approved' THEN 'pending'
  WHEN status::text = 'rejected' THEN 'cancelled'
  WHEN status::text = 'postponed' THEN 'cancelled'
  ELSE status::text
END::production_task_status_old;

-- 3. Обновляем колонку на новый тип
ALTER TABLE production_tasks 
ALTER COLUMN status TYPE production_task_status 
USING 
  CASE status::text
    WHEN 'suggested' THEN 'pending'::production_task_status
    WHEN 'approved' THEN 'pending'::production_task_status
    WHEN 'rejected' THEN 'cancelled'::production_task_status
    WHEN 'postponed' THEN 'cancelled'::production_task_status
    ELSE status::text::production_task_status
  END;

-- 4. Теперь можем удалить старый тип
DROP TYPE production_task_status_old;

-- 5. Устанавливаем правильный дефолт
ALTER TABLE production_tasks ALTER COLUMN status SET DEFAULT 'pending';

-- 6. Проверяем результат
\d production_tasks
SELECT status, COUNT(*) as count FROM production_tasks GROUP BY status; 