-- Проверяем текущее состояние БД
SELECT 'CHECKING PRODUCTS TABLE' as status;

SELECT table_name FROM information_schema.tables 
WHERE table_name = 'products' AND table_schema = 'public';

SELECT 'CHECKING border_type COLUMN' as status;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'border_type';

SELECT 'CHECKING border_type ENUM' as status;

SELECT typname FROM pg_type WHERE typname = 'border_type';

SELECT 'PRODUCTS COUNT' as status;

SELECT COUNT(*) as total_products FROM products;