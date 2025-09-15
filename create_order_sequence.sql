-- Создание sequence для номеров заказов
-- Выполнить в БД перед запуском приложения

CREATE SEQUENCE IF NOT EXISTS order_number_seq 
    START 1 
    INCREMENT 1 
    MINVALUE 1 
    NO MAXVALUE 
    CACHE 1;

-- Устанавливаем текущее значение sequence на максимальный номер заказа + 1
-- Это нужно для корректной работы после миграции
DO $$
DECLARE
    max_order_num INTEGER;
BEGIN
    -- Получаем максимальный номер заказа из существующих записей
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'ORD-\d+-(\d+)') AS INTEGER)), 0) 
    INTO max_order_num 
    FROM orders 
    WHERE order_number ~ '^ORD-\d+-\d+$';
    
    -- Устанавливаем sequence на следующий номер
    IF max_order_num > 0 THEN
        PERFORM setval('order_number_seq', max_order_num + 1, false);
    END IF;
END $$;
