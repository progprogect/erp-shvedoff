-- Миграция: Добавление диапазона дат для операций резки
-- Дата: 2025-01-22
-- Цель: Добавить поддержку планирования операций резки с диапазоном дат

-- 1. Добавляем новые поля для диапазона дат
ALTER TABLE cutting_operations 
ADD COLUMN planned_start_date TIMESTAMP,
ADD COLUMN planned_end_date TIMESTAMP;

-- 2. Добавляем комментарии к новым полям
COMMENT ON COLUMN cutting_operations.planned_start_date IS 'Планируемая дата начала операции резки';
COMMENT ON COLUMN cutting_operations.planned_end_date IS 'Планируемая дата окончания операции резки';

-- 3. Мигрируем существующие данные из planned_date в новые поля
-- Если planned_date существует, устанавливаем его как planned_start_date
-- planned_end_date оставляем NULL (будет заполняться пользователем)
UPDATE cutting_operations 
SET planned_start_date = planned_date 
WHERE planned_date IS NOT NULL 
  AND planned_start_date IS NULL;

-- 4. Добавляем проверочное ограничение для валидации диапазона дат
ALTER TABLE cutting_operations 
ADD CONSTRAINT chk_cutting_operations_date_range 
CHECK (
  planned_start_date IS NULL 
  OR planned_end_date IS NULL 
  OR planned_start_date <= planned_end_date
);

-- 5. Создаем индексы для оптимизации запросов по датам
CREATE INDEX idx_cutting_operations_planned_start_date 
ON cutting_operations(planned_start_date) 
WHERE planned_start_date IS NOT NULL;

CREATE INDEX idx_cutting_operations_planned_end_date 
ON cutting_operations(planned_end_date) 
WHERE planned_end_date IS NOT NULL;

-- 6. Создаем составной индекс для поиска операций в диапазоне дат
CREATE INDEX idx_cutting_operations_date_range 
ON cutting_operations(planned_start_date, planned_end_date) 
WHERE planned_start_date IS NOT NULL AND planned_end_date IS NOT NULL;

-- 7. Добавляем функцию для расчета продолжительности операции (в днях)
CREATE OR REPLACE FUNCTION get_cutting_operation_duration_days(
  start_date TIMESTAMP,
  end_date TIMESTAMP
) RETURNS INTEGER AS $$
BEGIN
  IF start_date IS NULL OR end_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN EXTRACT(DAY FROM (end_date - start_date))::INTEGER + 1;
END;
$$ LANGUAGE plpgsql;

-- 8. Создаем представление для удобного отображения операций с продолжительностью
CREATE OR REPLACE VIEW cutting_operations_with_duration AS
SELECT 
  co.*,
  get_cutting_operation_duration_days(co.planned_start_date, co.planned_end_date) as duration_days,
  CASE 
    WHEN co.planned_start_date IS NULL AND co.planned_end_date IS NULL THEN 'Без планирования'
    WHEN co.planned_start_date IS NOT NULL AND co.planned_end_date IS NULL THEN 'Начало: ' || to_char(co.planned_start_date, 'DD.MM.YYYY')
    WHEN co.planned_start_date IS NULL AND co.planned_end_date IS NOT NULL THEN 'Окончание: ' || to_char(co.planned_end_date, 'DD.MM.YYYY')
    ELSE to_char(co.planned_start_date, 'DD.MM.YYYY') || ' - ' || to_char(co.planned_end_date, 'DD.MM.YYYY')
  END as date_range_display
FROM cutting_operations co;

-- 9. Добавляем триггер для автоматического обновления planned_date при изменении диапазона
-- (для обратной совместимости)
CREATE OR REPLACE FUNCTION update_planned_date_from_range()
RETURNS TRIGGER AS $$
BEGIN
  -- Если есть диапазон дат, обновляем planned_date как дату начала
  IF NEW.planned_start_date IS NOT NULL THEN
    NEW.planned_date = NEW.planned_start_date;
  ELSIF OLD.planned_date IS NOT NULL AND NEW.planned_start_date IS NULL THEN
    -- Если убрали дату начала, но оставили planned_date, используем его как planned_start_date
    NEW.planned_start_date = NEW.planned_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_planned_date_from_range
  BEFORE INSERT OR UPDATE ON cutting_operations
  FOR EACH ROW
  EXECUTE FUNCTION update_planned_date_from_range();

-- 10. Проверяем результат миграции
SELECT 
  COUNT(*) as total_operations,
  COUNT(planned_date) as with_planned_date,
  COUNT(planned_start_date) as with_start_date,
  COUNT(planned_end_date) as with_end_date,
  COUNT(CASE WHEN planned_start_date IS NOT NULL AND planned_end_date IS NOT NULL THEN 1 END) as with_full_range
FROM cutting_operations;
