-- Добавление колонки telegram_id в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(50) UNIQUE;
