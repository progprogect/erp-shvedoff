#!/bin/bash

# Скрипт для выполнения миграции гибкого планирования на стейдже
# Использование: ./execute_staging_migration.sh

echo "🚀 Начинаем миграцию гибкого планирования производства на стейдже..."

# Параметры подключения к стейджу
STAGING_DB_URL="postgresql://postgres:pTMtLhlEmgeRAtUlFvGBhAYLNIlMkhwL@tramway.proxy.rlwy.net:50363/railway"

# Проверяем подключение
echo "📡 Проверяем подключение к базе данных стейджа..."
if ! psql "$STAGING_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Ошибка подключения к базе данных стейджа!"
    exit 1
fi

echo "✅ Подключение к базе данных успешно!"

# Создаем бэкап перед миграцией
echo "💾 Создаем бэкап данных перед миграцией..."
BACKUP_FILE="production_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$STAGING_DB_URL" > "$BACKUP_FILE"
echo "✅ Бэкап создан: $BACKUP_FILE"

# Проверяем текущее состояние таблицы
echo "🔍 Проверяем текущее состояние таблицы production_tasks..."
psql "$STAGING_DB_URL" -c "
SELECT 
  COUNT(*) as total_tasks,
  COUNT(planned_date) as tasks_with_planned_date,
  COUNT(planned_start_time) as tasks_with_planned_time
FROM production_tasks;
"

# Выполняем миграцию
echo "🔄 Выполняем миграцию..."
if psql "$STAGING_DB_URL" -f backend/migrations/add_flexible_production_planning.sql; then
    echo "✅ Миграция выполнена успешно!"
else
    echo "❌ Ошибка выполнения миграции!"
    echo "🔄 Восстанавливаем данные из бэкапа..."
    psql "$STAGING_DB_URL" < "$BACKUP_FILE"
    exit 1
fi

# Проверяем результат миграции
echo "🔍 Проверяем результат миграции..."
psql "$STAGING_DB_URL" -c "
SELECT 
  COUNT(*) as total_tasks,
  COUNT(planned_start_date) as tasks_with_start_date,
  COUNT(planned_end_date) as tasks_with_end_date,
  COUNT(estimated_duration_days) as tasks_with_duration,
  COUNT(CASE WHEN is_flexible = true THEN 1 END) as flexible_tasks,
  COUNT(CASE WHEN planning_status = 'confirmed' THEN 1 END) as confirmed_tasks
FROM production_tasks;
"

# Проверяем функции и триггеры
echo "🔍 Проверяем созданные функции..."
psql "$STAGING_DB_URL" -c "
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%planning%' 
   OR routine_name LIKE '%production%';
"

# Проверяем представления
echo "🔍 Проверяем созданные представления..."
psql "$STAGING_DB_URL" -c "
SELECT table_name 
FROM information_schema.views 
WHERE table_name LIKE '%production%';
"

# Тестируем функции
echo "🧪 Тестируем функции планирования..."
psql "$STAGING_DB_URL" -c "
SELECT get_production_planning_stats() as planning_stats;
"

echo "🎉 Миграция гибкого планирования завершена успешно!"
echo "📊 Статистика:"
echo "   - Бэкап: $BACKUP_FILE"
echo "   - Новые поля: planned_start_date, planned_end_date, estimated_duration_days"
echo "   - Новые функции: validate_production_planning, check_production_overlaps"
echo "   - Новые представления: production_tasks_with_planning"
echo "   - Новые триггеры: tr_production_tasks_validate_planning"
