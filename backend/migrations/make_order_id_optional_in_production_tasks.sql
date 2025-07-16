-- Миграция: сделать order_id необязательным в production_tasks
-- Это позволит создавать производственные задания без привязки к конкретному заказу

-- Убираем ограничение NOT NULL для order_id
ALTER TABLE production_tasks 
ALTER COLUMN order_id DROP NOT NULL;

-- Комментарий для ясности
COMMENT ON COLUMN production_tasks.order_id IS 'ID заказа (необязательно - задания могут быть созданы на будущее без привязки к заказу)'; 