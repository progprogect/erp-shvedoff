-- Миграция для обновления схемы production_tasks
-- Безопасное обновление enum типов и структуры

-- 1. Сначала добавляем новые значения к существующему enum
ALTER TYPE production_task_status ADD VALUE IF NOT EXISTS 'pending';

-- 2. Обновляем данные: преобразуем старые статусы в новые
UPDATE production_tasks 
SET status = CASE 
  WHEN status = 'suggested' THEN 'pending'
  WHEN status = 'approved' THEN 'pending'
  WHEN status = 'rejected' THEN 'cancelled'
  WHEN status = 'postponed' THEN 'cancelled'
  ELSE status::text
END::production_task_status;

-- 3. Переименовываем suggested_by в created_by
ALTER TABLE production_tasks RENAME COLUMN suggested_by TO created_by;

-- 4. Обновляем данные: если suggested_at есть, но created_at нет, используем suggested_at
UPDATE production_tasks 
SET created_at = suggested_at 
WHERE created_at IS NULL AND suggested_at IS NOT NULL;

-- 5. Удаляем ненужные колонки
ALTER TABLE production_tasks DROP COLUMN IF EXISTS approved_quantity;
ALTER TABLE production_tasks DROP COLUMN IF EXISTS suggested_at;
ALTER TABLE production_tasks DROP COLUMN IF EXISTS approved_at;
ALTER TABLE production_tasks DROP COLUMN IF EXISTS approved_by;
ALTER TABLE production_tasks DROP COLUMN IF EXISTS reject_reason;

-- 6. Обновляем ограничения
ALTER TABLE production_tasks DROP CONSTRAINT IF EXISTS production_tasks_suggested_by_users_id_fk;
ALTER TABLE production_tasks DROP CONSTRAINT IF EXISTS production_tasks_approved_by_users_id_fk;

ALTER TABLE production_tasks 
ADD CONSTRAINT production_tasks_created_by_users_id_fk 
FOREIGN KEY (created_by) REFERENCES users(id);

-- 7. Обновляем значения по умолчанию
ALTER TABLE production_tasks ALTER COLUMN status SET DEFAULT 'pending';

-- 8. Создаем новый enum только с нужными значениями
CREATE TYPE production_task_status_new AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- 9. Обновляем колонку на новый тип
ALTER TABLE production_tasks 
ALTER COLUMN status TYPE production_task_status_new 
USING status::text::production_task_status_new;

-- 10. Удаляем старый тип и переименовываем новый
DROP TYPE production_task_status;
ALTER TYPE production_task_status_new RENAME TO production_task_status;

-- 11. Устанавливаем дефолт снова
ALTER TABLE production_tasks ALTER COLUMN status SET DEFAULT 'pending'; 