-- Миграция: Удаление поля estimated_duration из production_tasks
-- Дата: 2025-01-23
-- Описание: Убираем поле оценки длительности производства по требованиям

BEGIN;

-- 1. Удаляем поле estimated_duration из таблицы production_tasks
ALTER TABLE production_tasks DROP COLUMN IF EXISTS estimated_duration;

-- 2. Добавляем комментарий к таблице
COMMENT ON TABLE production_tasks IS 'Таблица производственных заданий с календарным планированием (без оценки длительности)';

COMMIT;

-- Результат миграции
SELECT 'Миграция remove_estimated_duration выполнена успешно' as status; 