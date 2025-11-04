-- Миграция: Добавление поля liberty_grade_quantity в таблицу cutting_progress_log
-- Дата: 2025-11-04
-- Описание: Исправление ошибки в функции update_stock_from_cutting_progress() - добавление отсутствующего поля

BEGIN;

-- Добавляем поле liberty_grade_quantity в таблицу cutting_progress_log, если его нет
ALTER TABLE cutting_progress_log 
ADD COLUMN IF NOT EXISTS liberty_grade_quantity INTEGER DEFAULT 0;

-- Добавляем комментарий к колонке
COMMENT ON COLUMN cutting_progress_log.liberty_grade_quantity IS 'Количество товара сорта Либерти в промежуточных результатах резки (может быть отрицательным)';

-- Создаем индекс для быстрого поиска (если его нет)
CREATE INDEX IF NOT EXISTS idx_cutting_progress_log_liberty_grade ON cutting_progress_log(liberty_grade_quantity);

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_liberty_grade_to_cutting_progress выполнена успешно' as status;

