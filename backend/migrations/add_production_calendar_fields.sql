-- Миграция для добавления полей календарного планирования производственных заданий
-- Дата: 2025-07-23
-- Описание: Добавление полей planned_date, planned_start_time, estimated_duration для календарного планирования

BEGIN;

-- 1. Добавляем поля календарного планирования в таблицу production_tasks
ALTER TABLE production_tasks 
ADD COLUMN IF NOT EXISTS planned_date TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS planned_start_time VARCHAR(8) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT NULL;

-- 2. Добавляем комментарии к новым полям для документации
COMMENT ON COLUMN production_tasks.planned_date IS 'Планируемая дата выполнения задания';
COMMENT ON COLUMN production_tasks.planned_start_time IS 'Планируемое время начала выполнения в формате HH:MM (например, 09:30)';
COMMENT ON COLUMN production_tasks.estimated_duration IS 'Ожидаемая продолжительность выполнения задания в минутах';

-- 3. Создаем индексы для эффективного поиска заданий по планируемым датам
CREATE INDEX IF NOT EXISTS idx_production_tasks_planned_date 
ON production_tasks (planned_date) 
WHERE planned_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_tasks_planned_date_status 
ON production_tasks (planned_date, status) 
WHERE planned_date IS NOT NULL;

-- 4. Создаем функцию для получения заданий за определенный период
CREATE OR REPLACE FUNCTION get_production_tasks_by_date_range(
    start_date DATE,
    end_date DATE
) RETURNS TABLE (
    task_id INTEGER,
    planned_date TIMESTAMP,
    planned_start_time VARCHAR(8),
    estimated_duration INTEGER,
    product_name VARCHAR(500),
    requested_quantity INTEGER,
    status VARCHAR(50),
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id as task_id,
        pt.planned_date,
        pt.planned_start_time,
        pt.estimated_duration,
        p.name as product_name,
        pt.requested_quantity,
        pt.status::VARCHAR(50) as status,
        pt.priority
    FROM production_tasks pt
    LEFT JOIN products p ON pt.product_id = p.id
    WHERE pt.planned_date IS NOT NULL 
      AND DATE(pt.planned_date) BETWEEN start_date AND end_date
    ORDER BY pt.planned_date, pt.planned_start_time NULLS LAST, pt.priority DESC;
END;
$$ LANGUAGE plpgsql;

-- 5. Создаем функцию для получения статистики по дням
CREATE OR REPLACE FUNCTION get_production_stats_by_day(
    start_date DATE,
    end_date DATE
) RETURNS TABLE (
    day_date DATE,
    total_tasks INTEGER,
    pending_tasks INTEGER,
    in_progress_tasks INTEGER,
    completed_tasks INTEGER,
    total_quantity INTEGER,
    total_estimated_hours DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(pt.planned_date) as day_date,
        COUNT(*)::INTEGER as total_tasks,
        COUNT(CASE WHEN pt.status = 'pending' THEN 1 END)::INTEGER as pending_tasks,
        COUNT(CASE WHEN pt.status = 'in_progress' THEN 1 END)::INTEGER as in_progress_tasks,
        COUNT(CASE WHEN pt.status = 'completed' THEN 1 END)::INTEGER as completed_tasks,
        SUM(pt.requested_quantity)::INTEGER as total_quantity,
        ROUND(SUM(COALESCE(pt.estimated_duration, 0)) / 60.0, 2) as total_estimated_hours
    FROM production_tasks pt
    WHERE pt.planned_date IS NOT NULL 
      AND DATE(pt.planned_date) BETWEEN start_date AND end_date
    GROUP BY DATE(pt.planned_date)
    ORDER BY day_date;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_production_calendar_fields выполнена успешно' as status; 