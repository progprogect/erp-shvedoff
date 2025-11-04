-- Миграция: Обновление формата комментария для движений готового товара в операциях резки
-- Дата: 2025-11-04
-- Описание: Изменение формата комментария с "Корректировка готового товара..." на "Операция резки #X: поступление готового товара (промежуточный результат)" для консистентности

-- Обновляем функцию триггера для нового формата комментария
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
    _operation_id INTEGER;
BEGIN
    -- Определяем operation_id в зависимости от типа операции
    IF TG_OP = 'DELETE' THEN
        _operation_id := OLD.operation_id;
    ELSE
        _operation_id := NEW.operation_id;
    END IF;

    -- Получаем информацию об операции резки
    SELECT co.source_product_id, co.target_product_id, co.source_quantity, co.operator_id, p.name
    INTO _source_product_id, _target_product_id, _source_quantity, _user_id, _target_product_name
    FROM cutting_operations co
    LEFT JOIN products p ON p.id = co.target_product_id
    WHERE co.id = _operation_id;

    -- Товары 2-го сорта и Либерти теперь создаются в API endpoint с правильными характеристиками
    -- Trigger функция только обновляет остатки готового товара и списывает исходный товар

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
    ELSIF TG_OP = 'DELETE' THEN
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
            _operation_id,
            'cutting_progress',
            'Операция резки #' || _operation_id || ': списание исходного товара (прогресс: товар=' || _product_diff || ', 2сорт=' || _second_grade_diff || ', Либерти=' || _liberty_grade_diff || ', брак=' || _waste_diff || ')',
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
            _operation_id,
            'cutting_progress',
            'Операция резки #' || _operation_id || ': поступление готового товара (промежуточный результат)',
            _user_id
        );
    END IF;

    -- Товары 2-го сорта и Либерти создаются в API endpoint с правильными характеристиками
    -- Trigger функция только обновляет остатки готового товара и списывает исходный товар
    
    -- Возвращаем правильную запись в зависимости от типа операции
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Логирование выполнения миграции
SELECT 'Миграция update_cutting_progress_comment выполнена успешно' as status;

