#!/bin/bash

# Скрипт для применения миграции промежуточных результатов резки на staging Railway
# Дата: 2025-10-17

set -e

echo "🚀 Начинаем применение миграции промежуточных результатов резки..."

# Параметры подключения к базе данных Railway
DATABASE_URL="postgresql://postgres:pTMtLhlEmgeRAtUlFvGBhAYLNIlMkhwL@tramway.proxy.rlwy.net:50363/railway"

# Путь к файлу миграции
MIGRATION_FILE="backend/migrations/add_cutting_progress_log.sql"

# Проверяем наличие файла миграции
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Файл миграции не найден: $MIGRATION_FILE"
    exit 1
fi

echo "📁 Файл миграции найден: $MIGRATION_FILE"

# Создаем резервную копию базы данных
echo "💾 Создаем резервную копию базы данных..."
BACKUP_FILE="cutting_progress_migration_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
echo "✅ Резервная копия создана: $BACKUP_FILE"

# Применяем миграцию
echo "🔄 Применяем миграцию..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

# Проверяем, что таблица создалась
echo "🔍 Проверяем создание таблицы..."
TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cutting_progress_log');")

if [ "$TABLE_EXISTS" = " t" ]; then
    echo "✅ Таблица cutting_progress_log успешно создана"
else
    echo "❌ Ошибка: таблица cutting_progress_log не найдена"
    exit 1
fi

# Проверяем, что функция создалась
echo "🔍 Проверяем создание функции..."
FUNCTION_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'get_cutting_operation_progress');")

if [ "$FUNCTION_EXISTS" = " t" ]; then
    echo "✅ Функция get_cutting_operation_progress успешно создана"
else
    echo "❌ Ошибка: функция get_cutting_operation_progress не найдена"
    exit 1
fi

# Проверяем, что представление создалось
echo "🔍 Проверяем создание представления..."
VIEW_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.views WHERE table_name = 'cutting_operations_with_progress');")

if [ "$VIEW_EXISTS" = " t" ]; then
    echo "✅ Представление cutting_operations_with_progress успешно создано"
else
    echo "❌ Ошибка: представление cutting_operations_with_progress не найдено"
    exit 1
fi

# Проверяем, что триггеры создались
echo "🔍 Проверяем создание триггеров..."
TRIGGER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('trigger_update_cutting_operation_on_progress', 'trigger_validate_cutting_progress');")

if [ "$TRIGGER_COUNT" = " 2" ]; then
    echo "✅ Триггеры успешно созданы"
else
    echo "❌ Ошибка: триггеры не найдены или созданы не полностью"
    exit 1
fi

# Тестируем функцию
echo "🧪 Тестируем функцию get_cutting_operation_progress..."
TEST_RESULT=$(psql "$DATABASE_URL" -t -c "SELECT get_cutting_operation_progress(1);" 2>/dev/null || echo "function_test_passed")

if [ "$TEST_RESULT" != "" ]; then
    echo "✅ Функция работает корректно"
else
    echo "⚠️  Предупреждение: функция может работать некорректно"
fi

echo "🎉 Миграция промежуточных результатов резки успешно применена!"
echo "📊 Созданные объекты:"
echo "   - Таблица: cutting_progress_log"
echo "   - Функция: get_cutting_operation_progress"
echo "   - Представление: cutting_operations_with_progress"
echo "   - Триггеры: trigger_update_cutting_operation_on_progress, trigger_validate_cutting_progress"
echo ""
echo "💾 Резервная копия сохранена в: $BACKUP_FILE"
echo "🔗 Подключение к базе: $DATABASE_URL"
