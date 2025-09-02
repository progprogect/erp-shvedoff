-- МИГРАЦИЯ: Изменение типа quantity на DECIMAL(10,2) в roll_covering_composition
-- Дата: 2025-01-20
-- Описание: Поддержка дробных значений количества ковров в составе рулонных покрытий

BEGIN;

-- Проверяем существование таблицы
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roll_covering_composition') THEN
        RAISE EXCEPTION 'Таблица roll_covering_composition не существует';
    END IF;
END $$;

-- Изменяем тип колонки quantity с INTEGER на DECIMAL(10,2)
-- Существующие INTEGER значения автоматически преобразуются в DECIMAL
ALTER TABLE roll_covering_composition 
ALTER COLUMN quantity TYPE DECIMAL(10,2);

-- Обновляем проверочное ограничение для поддержки дробных значений
-- Удаляем старое ограничение
ALTER TABLE roll_covering_composition 
DROP CONSTRAINT IF EXISTS check_quantity_positive;

-- Добавляем новое ограничение с поддержкой дробных значений (минимум 0.01)
ALTER TABLE roll_covering_composition 
ADD CONSTRAINT check_quantity_positive 
CHECK (quantity >= 0.01);

-- Обновляем комментарий для документации
COMMENT ON COLUMN roll_covering_composition.quantity IS 'Количество данного ковра в составе (поддерживает дробные значения до 2 знаков после запятой)';

-- Логирование успешного выполнения
DO $$
BEGIN
    RAISE NOTICE 'Миграция add_decimal_quantity_to_roll_composition выполнена успешно';
    RAISE NOTICE 'Колонка quantity изменена на DECIMAL(10,2)';
    RAISE NOTICE 'Проверочное ограничение обновлено для поддержки дробных значений >= 0.01';
END $$;

COMMIT;
