-- Миграция для добавления полей сорта Либерти в операции резки
-- Дата: 2025-01-17
-- Описание: Добавление полей для учета товара сорта Либерти в операциях резки

BEGIN;

-- 1. Добавляем поле в таблицу cutting_operations
ALTER TABLE cutting_operations 
ADD COLUMN IF NOT EXISTS actual_liberty_grade_quantity INTEGER DEFAULT 0;

-- 2. Добавляем поле в таблицу cutting_progress_log
ALTER TABLE cutting_progress_log 
ADD COLUMN IF NOT EXISTS liberty_grade_quantity INTEGER DEFAULT 0;

-- 3. Добавляем комментарии к колонкам для документации
COMMENT ON COLUMN cutting_operations.actual_liberty_grade_quantity IS 'Фактическое количество товара сорта Либерти при завершении операции резки';
COMMENT ON COLUMN cutting_progress_log.liberty_grade_quantity IS 'Количество товара сорта Либерти в промежуточных результатах резки (может быть отрицательным)';

-- 4. Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_cutting_operations_liberty_grade ON cutting_operations(actual_liberty_grade_quantity);
CREATE INDEX IF NOT EXISTS idx_cutting_progress_log_liberty_grade ON cutting_progress_log(liberty_grade_quantity);

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_liberty_grade_fields выполнена успешно' as status;
