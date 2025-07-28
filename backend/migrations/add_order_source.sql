-- Добавляем enum для источников заказов
CREATE TYPE order_source AS ENUM ('database', 'website', 'avito', 'referral', 'cold_call', 'other');

-- Добавляем поля в таблицу orders
ALTER TABLE orders 
ADD COLUMN source order_source DEFAULT 'database',
ADD COLUMN custom_source VARCHAR(255);

-- Добавляем комментарии для понимания полей
COMMENT ON COLUMN orders.source IS 'Источник заказа: database - из базы клиентов, website - с сайта, avito - с Авито, referral - по рекомендации, cold_call - холодные звонки, other - другое';
COMMENT ON COLUMN orders.custom_source IS 'Описание источника если выбрано "other"'; 