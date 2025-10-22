-- Исправление trigger функции для операций резки
-- Проблема: товары создаются с неправильными артикулами в trigger функции
-- Решение: убираем создание товаров из trigger, оставляем только обновление остатков
-- Создание товаров будет происходить в API endpoints с правильной генерацией артикулов

BEGIN;

-- Обновляем trigger функцию - убираем создание товаров, оставляем только обновление остатков
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

    -- Определяем ID товара 2-го сорта (если он существует)
    SELECT p.id INTO _second_grade_product_id
    FROM products p
    WHERE p.name = _target_product_name AND p.grade = 'grade_2' AND p.is_active = TRUE;

    -- Определяем ID товара сорта Либерти (если он существует)
    SELECT p.id INTO _liberty_grade_product_id
    FROM products p
    WHERE p.name = _target_product_name AND p.grade = 'liber' AND p.is_active = TRUE;

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

    -- Обновляем остатки для товара 2-го сорта (только если товар существует)
    IF _second_grade_diff != 0 AND _second_grade_product_id IS NOT NULL THEN
        UPDATE stock
        SET
            current_stock = current_stock + _second_grade_diff,
            updated_at = NOW()
        WHERE product_id = _second_grade_product_id;

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
            _second_grade_product_id,
            (CASE WHEN _second_grade_diff > 0 THEN 'cutting_in' ELSE 'outgoing' END)::movement_type,
            ABS(_second_grade_diff),
            NEW.operation_id,
            'cutting_progress',
            'Корректировка 2-го сорта по операции резки #' || NEW.operation_id || ' (прогресс)',
            _user_id
        );
    END IF;

    -- Обновляем остатки для товара сорта Либерти (только если товар существует)
    IF _liberty_grade_diff != 0 AND _liberty_grade_product_id IS NOT NULL THEN
        UPDATE stock
        SET
            current_stock = current_stock + _liberty_grade_diff,
            updated_at = NOW()
        WHERE product_id = _liberty_grade_product_id;

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
            _liberty_grade_product_id,
            (CASE WHEN _liberty_grade_diff > 0 THEN 'cutting_in' ELSE 'outgoing' END)::movement_type,
            ABS(_liberty_grade_diff),
            NEW.operation_id,
            'cutting_progress',
            'Корректировка сорта Либерти по операции резки #' || NEW.operation_id || ' (прогресс)',
            _user_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

SELECT 'Миграция fix_cutting_progress_trigger выполнена успешно' as status;
