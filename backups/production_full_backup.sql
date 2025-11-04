-- ==============================================
-- ПОЛНЫЙ БЭКАП PRODUCTION БД
-- Дата создания: 23.10.2025
-- Перед миграцией Liberty Grade
-- ==============================================

\echo '=== НАЧАЛО ПОЛНОГО БЭКАПА PRODUCTION ==='

-- Создаем копию таблицы cutting_operations
CREATE TABLE IF NOT EXISTS cutting_operations_backup_20251023 AS 
SELECT * FROM cutting_operations;

\echo 'Бэкап cutting_operations создан'

-- Создаем копию таблицы cutting_progress_log
CREATE TABLE IF NOT EXISTS cutting_progress_log_backup_20251023 AS 
SELECT * FROM cutting_progress_log;

\echo 'Бэкап cutting_progress_log создан'

-- Создаем копию таблицы production_tasks
CREATE TABLE IF NOT EXISTS production_tasks_backup_20251023 AS 
SELECT * FROM production_tasks;

\echo 'Бэкап production_tasks создан'

-- Создаем копию таблицы products (только с grade != 'usual')
CREATE TABLE IF NOT EXISTS products_grades_backup_20251023 AS 
SELECT * FROM products WHERE grade IN ('grade_2', 'telyatnik', 'liber');

\echo 'Бэкап products (со сортами) создан'

-- Создаем копию таблицы stock для товаров с grade
CREATE TABLE IF NOT EXISTS stock_grades_backup_20251023 AS 
SELECT s.* FROM stock s
INNER JOIN products p ON p.id = s.product_id
WHERE p.grade IN ('grade_2', 'telyatnik', 'liber');

\echo 'Бэкап stock (для сортов) создан'

-- Проверяем созданные бэкапы
\echo '=== ПРОВЕРКА БЭКАПОВ ==='
SELECT 'cutting_operations_backup_20251023: ' || COUNT(*) FROM cutting_operations_backup_20251023;
SELECT 'cutting_progress_log_backup_20251023: ' || COUNT(*) FROM cutting_progress_log_backup_20251023;
SELECT 'production_tasks_backup_20251023: ' || COUNT(*) FROM production_tasks_backup_20251023;
SELECT 'products_grades_backup_20251023: ' || COUNT(*) FROM products_grades_backup_20251023;
SELECT 'stock_grades_backup_20251023: ' || COUNT(*) FROM stock_grades_backup_20251023;

\echo '=== БЭКАП ЗАВЕРШЕН УСПЕШНО ==='




