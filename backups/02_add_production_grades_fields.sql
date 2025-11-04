-- Миграция для добавления полей второго сорта и Либерти в производственные задания
-- Дата: 2025-01-17
-- Описание: Добавляет поддержку учета товаров второго сорта и сорта Либерти в производственных заданиях

BEGIN;

-- Добавляем поля в таблицу production_tasks
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS second_grade_quantity INTEGER DEFAULT 0;
COMMENT ON COLUMN production_tasks.second_grade_quantity IS 'Количество товара 2-го сорта (может быть отрицательным для корректировки)';

ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS liberty_grade_quantity INTEGER DEFAULT 0;
COMMENT ON COLUMN production_tasks.liberty_grade_quantity IS 'Количество товара сорта Либерти (может быть отрицательным для корректировки)';

COMMIT;

SELECT 'Миграция add_production_grades_fields выполнена успешно' as status;
