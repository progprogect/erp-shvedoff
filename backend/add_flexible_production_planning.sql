-- Миграция для добавления гибкой системы планирования производства
-- Дата: 2025-01-22
-- Описание: Добавляет гибкие поля планирования и удаляет устаревшие

-- 1. Добавляем новые поля планирования
ALTER TABLE production_tasks 
ADD COLUMN planned_start_date TIMESTAMP,
ADD COLUMN planned_end_date TIMESTAMP,
ADD COLUMN estimated_duration_days INTEGER,
ADD COLUMN planning_status VARCHAR(20) DEFAULT 'draft',
ADD COLUMN is_flexible BOOLEAN DEFAULT false,
ADD COLUMN auto_adjust_end_date BOOLEAN DEFAULT true,
ADD COLUMN planning_notes TEXT;

-- 2. Создаем индекс для оптимизации запросов по датам
CREATE INDEX idx_production_tasks_planned_start_date ON production_tasks(planned_start_date);
CREATE INDEX idx_production_tasks_planned_end_date ON production_tasks(planned_end_date);
CREATE INDEX idx_production_tasks_planning_status ON production_tasks(planning_status);

-- 3. Мигрируем существующие данные
-- Конвертируем plannedDate в planned_end_date и устанавливаем planned_start_date на день раньше
UPDATE production_tasks 
SET 
  planned_end_date = planned_date,
  planned_start_date = CASE 
    WHEN planned_date IS NOT NULL THEN planned_date - INTERVAL '1 day'
    ELSE NULL
  END,
  planning_status = CASE 
    WHEN planned_date IS NOT NULL THEN 'confirmed'
    ELSE 'draft'
  END,
  is_flexible = false,
  estimated_duration_days = CASE 
    WHEN planned_date IS NOT NULL THEN 1
    ELSE NULL
  END,
  planning_notes = CASE 
    WHEN planned_date IS NOT NULL THEN 'Migrated from planned_date'
    ELSE NULL
  END
WHERE planned_date IS NOT NULL;

-- 4. Удаляем устаревшие поля
ALTER TABLE production_tasks DROP COLUMN IF EXISTS planned_date;
ALTER TABLE production_tasks DROP COLUMN IF EXISTS planned_start_time;

-- 5. Добавляем комментарии к новым полям
COMMENT ON COLUMN production_tasks.planned_start_date IS 'Планируемая дата начала производства';
COMMENT ON COLUMN production_tasks.planned_end_date IS 'Планируемая дата завершения производства';
COMMENT ON COLUMN production_tasks.estimated_duration_days IS 'Расчетная длительность производства в днях';
COMMENT ON COLUMN production_tasks.planning_status IS 'Статус планирования: draft, confirmed, started, completed';
COMMENT ON COLUMN production_tasks.is_flexible IS 'Гибкое планирование - можно ли менять даты';
COMMENT ON COLUMN production_tasks.auto_adjust_end_date IS 'Автоматическая коррекция даты завершения';
COMMENT ON COLUMN production_tasks.planning_notes IS 'Заметки по планированию';

-- 6. Создаем функцию для валидации планирования
CREATE OR REPLACE FUNCTION validate_production_planning(
  p_planned_start_date TIMESTAMP,
  p_planned_end_date TIMESTAMP,
  p_estimated_duration_days INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  -- Минимум одно поле должно быть заполнено
  IF p_planned_start_date IS NULL AND p_planned_end_date IS NULL AND p_estimated_duration_days IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Дата завершения должна быть позже даты начала
  IF p_planned_start_date IS NOT NULL AND p_planned_end_date IS NOT NULL THEN
    IF p_planned_end_date <= p_planned_start_date THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 7. Создаем функцию для проверки перекрытий
CREATE OR REPLACE FUNCTION check_production_overlaps(
  p_task_id INTEGER,
  p_planned_start_date TIMESTAMP,
  p_planned_end_date TIMESTAMP
) RETURNS TABLE(
  overlapping_task_id INTEGER,
  product_name VARCHAR,
  overlap_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pt.id,
    p.name,
    EXTRACT(DAY FROM LEAST(pt.planned_end_date, p_planned_end_date) - GREATEST(pt.planned_start_date, p_planned_start_date))::INTEGER
  FROM production_tasks pt
  JOIN products p ON pt.product_id = p.id
  WHERE pt.id != p_task_id
    AND pt.status IN ('pending', 'in_progress', 'paused')
    AND pt.planned_start_date IS NOT NULL
    AND pt.planned_end_date IS NOT NULL
    AND pt.planned_start_date < p_planned_end_date
    AND pt.planned_end_date > p_planned_start_date;
END;
$$ LANGUAGE plpgsql;

-- 8. Добавляем триггер для автоматической валидации
CREATE OR REPLACE FUNCTION trigger_validate_planning() RETURNS TRIGGER AS $$
BEGIN
  -- Проверяем валидность планирования
  IF NOT validate_production_planning(
    NEW.planned_start_date,
    NEW.planned_end_date,
    NEW.estimated_duration_days
  ) THEN
    RAISE EXCEPTION 'Invalid production planning: dates are inconsistent';
  END IF;
  
  -- Автоматически рассчитываем длительность если не указана
  IF NEW.estimated_duration_days IS NULL 
     AND NEW.planned_start_date IS NOT NULL 
     AND NEW.planned_end_date IS NOT NULL THEN
    NEW.estimated_duration_days = EXTRACT(DAY FROM NEW.planned_end_date - NEW.planned_start_date)::INTEGER + 1;
  END IF;
  
  -- Автоматически рассчитываем дату завершения если не указана
  IF NEW.planned_end_date IS NULL 
     AND NEW.planned_start_date IS NOT NULL 
     AND NEW.estimated_duration_days IS NOT NULL
     AND NEW.auto_adjust_end_date THEN
    NEW.planned_end_date = NEW.planned_start_date + (NEW.estimated_duration_days - 1) * INTERVAL '1 day';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_production_tasks_validate_planning
  BEFORE INSERT OR UPDATE ON production_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validate_planning();

-- 9. Создаем представление для удобного получения заданий с планированием
CREATE OR REPLACE VIEW production_tasks_with_planning AS
SELECT 
  pt.*,
  p.name as product_name,
  p.article as product_article,
  c.name as category_name,
  u_created.username as created_by_username,
  u_assigned.username as assigned_to_username,
  u_started.username as started_by_username,
  u_completed.username as completed_by_username,
  o.order_number,
  o.customer_name,
  -- Расчетные поля
  CASE 
    WHEN pt.planned_start_date IS NOT NULL AND pt.planned_end_date IS NOT NULL THEN
      EXTRACT(DAY FROM pt.planned_end_date - pt.planned_start_date)::INTEGER + 1
    ELSE pt.estimated_duration_days
  END as calculated_duration_days,
  -- Статус планирования
  CASE 
    WHEN pt.planned_start_date IS NULL AND pt.planned_end_date IS NULL THEN 'unplanned'
    WHEN pt.planning_status = 'draft' THEN 'draft'
    WHEN pt.planning_status = 'confirmed' THEN 'confirmed'
    WHEN pt.status = 'in_progress' THEN 'in_progress'
    WHEN pt.status = 'completed' THEN 'completed'
    ELSE pt.planning_status
  END as planning_status_display
FROM production_tasks pt
LEFT JOIN products p ON pt.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN users u_created ON pt.created_by = u_created.id
LEFT JOIN users u_assigned ON pt.assigned_to = u_assigned.id
LEFT JOIN users u_started ON pt.started_by = u_started.id
LEFT JOIN users u_completed ON pt.completed_by = u_completed.id
LEFT JOIN orders o ON pt.order_id = o.id;

-- 10. Создаем функцию для получения статистики планирования
CREATE OR REPLACE FUNCTION get_production_planning_stats(
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT CURRENT_DATE + INTERVAL '30 days'
) RETURNS TABLE(
  total_tasks INTEGER,
  planned_tasks INTEGER,
  flexible_tasks INTEGER,
  strict_tasks INTEGER,
  overlapping_tasks INTEGER,
  avg_duration_days NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_tasks,
    COUNT(CASE WHEN planned_start_date IS NOT NULL THEN 1 END)::INTEGER as planned_tasks,
    COUNT(CASE WHEN is_flexible = true THEN 1 END)::INTEGER as flexible_tasks,
    COUNT(CASE WHEN is_flexible = false AND planned_start_date IS NOT NULL THEN 1 END)::INTEGER as strict_tasks,
    (
      SELECT COUNT(*)::INTEGER
      FROM production_tasks pt1
      WHERE pt1.id IN (
        SELECT DISTINCT overlapping_task_id
        FROM production_tasks pt2
        CROSS JOIN LATERAL check_production_overlaps(pt2.id, pt2.planned_start_date, pt2.planned_end_date)
        WHERE pt2.planned_start_date BETWEEN p_start_date AND p_end_date
      )
    ) as overlapping_tasks,
    ROUND(AVG(estimated_duration_days), 2) as avg_duration_days
  FROM production_tasks
  WHERE planned_start_date BETWEEN p_start_date AND p_end_date
     OR planned_end_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Миграция завершена
INSERT INTO audit_log (table_name, record_id, old_values, new_values, user_id, created_at)
VALUES (
  'production_tasks',
  NULL,
  '{"planned_date": "timestamp", "planned_start_time": "varchar"}'::jsonb,
  '{"planned_start_date": "timestamp", "planned_end_date": "timestamp", "estimated_duration_days": "integer", "planning_status": "varchar", "is_flexible": "boolean"}'::jsonb,
  1,
  NOW()
);
