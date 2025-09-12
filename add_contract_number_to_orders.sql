-- Добавление поля contract_number в таблицу orders
-- Миграция для добавления номера договора к заказам

-- Добавляем колонку contract_number
ALTER TABLE orders ADD COLUMN contract_number VARCHAR(255);

-- Добавляем комментарий к колонке
COMMENT ON COLUMN orders.contract_number IS 'Номер договора, связанного с заказом';

-- Проверяем результат
SELECT 
  column_name, 
  data_type, 
  character_maximum_length, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name = 'contract_number';
