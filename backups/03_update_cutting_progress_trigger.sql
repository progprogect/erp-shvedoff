-- ==============================================
-- МИГРАЦИЯ 3: Обновление триггера update_stock_from_cutting_progress
-- Дата: 23.10.2025
-- Описание: Добавление поддержки Liberty Grade и исправление логики создания товаров
-- ==============================================

\echo '=== МИГРАЦИЯ 3: Обновление триггера для Liberty Grade ==='

BEGIN;

-- Удаляем старый триггер и функцию
DROP TRIGGER IF EXISTS trigger_update_stock_from_cutting_progress ON cutting_progress_log;
DROP FUNCTION IF EXISTS update_stock_from_cutting_progress();

-- Создаем обновленную функцию триггера
CREATE OR REPLACE FUNCTION update_stock_from_cutting_progress()
RETURNS TRIGGER AS $$
DECLARE
    _source_product_id INTEGER;
    _target_product_id INTEGER;
    _second_grade_product_id INTEGER;
    _liberty_grade_product_id INTEGER;
    _target_product_name VARCHAR;
    _product_diff INTEGER;
    _second_grade_diff INTEGER;
    _liberty_grade_diff INTEGER;
    _waste_diff INTEGER;
    _total_produced_diff INTEGER;
    _source_quantity INTEGER;
    _user_id INTEGER;
BEGIN
    -- Получаем информацию об операции резки
    SELECT co.source_product_id, co.target_product_id, co.source_quantity, co.operator_id, p.name
    INTO _source_product_id, _target_product_id, _source_quantity, _user_id, _target_product_name
    FROM cutting_operations co
    LEFT JOIN products p ON p.id = co.target_product_id
    WHERE co.id = NEW.operation_id;

    -- Товары 2-го сорта и Либерти теперь создаются и обновляются в API endpoint
    -- с правильными характеристиками и полными артикулами

    -- Вычисляем разность для обновления остатков
    IF TG_OP = 'INSERT' THEN
        _product_diff := NEW.product_quantity;
        _second_grade_diff := NEW.second_grade_quantity;
        _liberty_grade_diff := NEW.liberty_grade_quantity;
        _waste_diff := NEW.waste_quantity;
    ELSIF TG_OP = 'UPDATE' THEN
        _product_diff := NEW.product_quantity - OLD.product_quantity;
        _second_grade_diff := NEW.second_grade_quantity - OLD.second_grade_quantity;
        _liberty_grade_diff := NEW.liberty_grade_quantity - OLD.liberty_grade_quantity;
        _waste_diff := NEW.waste_quantity - OLD.waste_quantity;
    ELSE -- DELETE
        _product_diff := -OLD.product_quantity;
        _second_grade_diff := -OLD.second_grade_quantity;
        _liberty_grade_diff := -OLD.liberty_grade_quantity;
        _waste_diff := -OLD.waste_quantity;
    END IF;

    -- Вычисляем общее количество произведенного товара (готовый + 2 сорт + Либерти + брак)
    _total_produced_diff := _product_diff + _second_grade_diff + _liberty_grade_diff + _waste_diff;

    -- Списываем исходный товар пропорционально произведенному количеству
    IF _total_produced_diff != 0 THEN
        UPDATE stock
        SET
            current_stock = current_stock - _total_produced_diff,
            updated_at = NOW()
        WHERE product_id = _source_product_id;

        -- Логируем списание исходного товара
        INSERT INTO stock_movements (
            product_id,
            movement_type,
            quantity,
            reference_id,
            reference_type,
            comment,
            user_id
        ) VALUES (
            _source_product_id,
            'cutting_out'::movement_type,
            ABS(_total_produced_diff),
            NEW.operation_id,
            'cutting_progress',
            'Списание исходного товара по операции резки #' || NEW.operation_id || ' (прогресс: товар=' || _product_diff || ', 2сорт=' || _second_grade_diff || ', Либерти=' || _liberty_grade_diff || ', брак=' || _waste_diff || ')',
            _user_id
        );
    END IF;

    -- Обновляем остатки для готового товара
    IF _product_diff != 0 THEN
        UPDATE stock 
        SET 
            current_stock = current_stock + _product_diff,
            updated_at = NOW()
        WHERE product_id = _target_product_id;

        -- Логируем движение товара
        INSERT INTO stock_movements (
            product_id, 
            movement_type, 
            quantity, 
            reference_id, 
            reference_type, 
            comment, 
            user_id
        ) VALUES (
            _target_product_id,
            (CASE WHEN _product_diff > 0 THEN 'cutting_in' ELSE 'outgoing' END)::movement_type,
            ABS(_product_diff),
            NEW.operation_id,
            'cutting_progress',
            'Корректировка готового товара по операции резки #' || NEW.operation_id || ' (прогресс)',
            _user_id
        );
    END IF;

    -- Товары 2-го сорта и Либерти создаются в API endpoint с правильными характеристиками
    -- Trigger функция только обновляет остатки готового товара и списывает исходный товар
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер заново
CREATE TRIGGER trigger_update_stock_from_cutting_progress
    AFTER INSERT OR UPDATE OR DELETE ON cutting_progress_log
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_from_cutting_progress();

COMMIT;

\echo '=== МИГРАЦИЯ 3 ЗАВЕРШЕНА УСПЕШНО ==='
\echo 'Триггер update_stock_from_cutting_progress обновлен'
\echo 'Добавлена поддержка Liberty Grade'
\echo 'Удалена логика создания товаров (теперь в API)'

-- Проверка
SELECT 'Триггер обновлен: ' || COUNT(*) || ' триггер(ов) на cutting_progress_log'
FROM pg_trigger 
WHERE tgname = 'trigger_update_stock_from_cutting_progress';




