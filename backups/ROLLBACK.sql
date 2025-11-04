-- ==============================================
-- СКРИПТ ОТКАТА МИГРАЦИИ
-- Дата: 23.10.2025
-- ВНИМАНИЕ: Использовать только в случае критических проблем!
-- ==============================================

\echo '=== ВНИМАНИЕ: ОТКАТ МИГРАЦИИ ==='
\echo 'Этот скрипт откатит все изменения миграции Liberty Grade'
\echo 'Нажмите Ctrl+C для отмены или Enter для продолжения'
\prompt 'Вы уверены? (yes/no): ' confirmation

-- Проверяем подтверждение (в интерактивном режиме)

\echo '=== НАЧАЛО ОТКАТА ==='

BEGIN;

-- ШАГ 1: Удаляем колонки Liberty из cutting_operations
\echo 'Удаление actual_liberty_grade_quantity из cutting_operations...'
ALTER TABLE cutting_operations DROP COLUMN IF EXISTS actual_liberty_grade_quantity CASCADE;

-- ШАГ 2: Удаляем колонки Liberty из cutting_progress_log
\echo 'Удаление liberty_grade_quantity из cutting_progress_log...'
ALTER TABLE cutting_progress_log DROP COLUMN IF EXISTS liberty_grade_quantity CASCADE;

-- ШАГ 3: Удаляем колонки из production_tasks
\echo 'Удаление second_grade_quantity и liberty_grade_quantity из production_tasks...'
ALTER TABLE production_tasks DROP COLUMN IF EXISTS second_grade_quantity CASCADE;
ALTER TABLE production_tasks DROP COLUMN IF EXISTS liberty_grade_quantity CASCADE;

-- ШАГ 4: Удаляем индексы (если они были созданы)
\echo 'Удаление индексов...'
DROP INDEX IF EXISTS idx_cutting_operations_liberty_grade;
DROP INDEX IF EXISTS idx_cutting_progress_log_liberty_grade;

-- ШАГ 5: Восстанавливаем старый триггер (из production_analysis)
\echo 'Восстановление старого триггера...'

DROP TRIGGER IF EXISTS trigger_update_stock_from_cutting_progress ON cutting_progress_log;
DROP FUNCTION IF EXISTS update_stock_from_cutting_progress();

-- Старая версия триггера (из PRODUCTION до миграции)
CREATE OR REPLACE FUNCTION update_stock_from_cutting_progress()
RETURNS TRIGGER AS $$
DECLARE
    _source_product_id INTEGER;
    _target_product_id INTEGER;
    _second_grade_product_id INTEGER;
    _target_product_name VARCHAR;
    _product_diff INTEGER;
    _second_grade_diff INTEGER;
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

    -- Вычисляем разность для обновления остатков
    IF TG_OP = 'INSERT' THEN
        _product_diff := NEW.product_quantity;
        _second_grade_diff := NEW.second_grade_quantity;
        _waste_diff := NEW.waste_quantity;
    ELSIF TG_OP = 'UPDATE' THEN
        _product_diff := NEW.product_quantity - OLD.product_quantity;
        _second_grade_diff := NEW.second_grade_quantity - OLD.second_grade_quantity;
        _waste_diff := NEW.waste_quantity - OLD.waste_quantity;
    ELSE -- DELETE
        _product_diff := -OLD.product_quantity;
        _second_grade_diff := -OLD.second_grade_quantity;
        _waste_diff := -OLD.waste_quantity;
    END IF;

    -- Вычисляем общее количество произведенного товара (готовый + 2 сорт + брак)
    _total_produced_diff := _product_diff + _second_grade_diff + _waste_diff;

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
            'Списание исходного товара по операции резки #' || NEW.operation_id || ' (прогресс: товар=' || _product_diff || ', 2сорт=' || _second_grade_diff || ', брак=' || _waste_diff || ')',
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

    -- Обновляем остатки для товара 2-го сорта
    IF _second_grade_diff != 0 THEN
        -- Если товара 2-го сорта нет, создаем его
        IF _second_grade_product_id IS NULL THEN
            INSERT INTO products (
                name,
                article,
                category_id,
                product_type,
                grade,
                is_active,
                notes
            ) VALUES (
                _target_product_name,
                '2S-' || _target_product_name,
                (SELECT category_id FROM products WHERE id = _target_product_id),
                (SELECT product_type FROM products WHERE id = _target_product_id),
                'grade_2',
                TRUE,
                'Автоматически создан для 2-го сорта по операции резки #' || NEW.operation_id
            ) RETURNING id INTO _second_grade_product_id;

            -- Создаем запись остатков для нового товара
            INSERT INTO stock (product_id, current_stock, reserved_stock)
            VALUES (_second_grade_product_id, 0, 0);
        END IF;

        UPDATE stock
        SET
            current_stock = current_stock + _second_grade_diff,
            updated_at = NOW()
        WHERE product_id = _second_grade_product_id;

        -- Логируем движение товара 2-го сорта
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер заново
CREATE TRIGGER trigger_update_stock_from_cutting_progress
    AFTER INSERT OR UPDATE OR DELETE ON cutting_progress_log
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_from_cutting_progress();

COMMIT;

\echo '=== ОТКАТ ЗАВЕРШЕН ==='
\echo ''
\echo 'ВЫПОЛНЕНО:'
\echo '1. Удалены колонки Liberty из всех таблиц'
\echo '2. Удалены колонки сортов из production_tasks'
\echo '3. Удалены индексы'
\echo '4. Восстановлена старая версия триггера'
\echo ''
\echo 'ВАЖНО: Бэкапы НЕ удалены. Их можно удалить вручную позже.'
\echo ''
\echo 'РЕКОМЕНДУЕТСЯ:'
\echo '1. Откатить backend на предыдущую версию (без Liberty в API)'
\echo '2. Откатить frontend на предыдущую версию (без Liberty в UI)'
\echo '3. Проверить работоспособность системы'




