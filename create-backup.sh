#!/bin/bash

# Скрипт создания бэкапа production БД ERP Shvedoff
# Дата: $(date +%Y-%m-%d)

echo "🔒 ЭТАП 2: СОЗДАНИЕ БЭКАПА"
echo "📅 Дата: $(date)"
echo ""

# Создаем имя файла с датой
BACKUP_FILE="erp-shvedoff-backup-$(date +%Y%m%d-%H%M%S).dump"
echo "📁 Файл бэкапа: $BACKUP_FILE"
echo ""

echo "🚀 Создаю полный бэкап БД..."
echo "⏱️ Это может занять несколько минут..."
echo ""

# Создаем бэкап через Railway CLI
railway connect Postgres -- pg_dump --no-owner --format=custom --verbose --file="$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Бэкап создан успешно!"
    echo "📊 Размер файла:"
    ls -lh "$BACKUP_FILE"
    echo ""
    echo "📍 Расположение: $(pwd)/$BACKUP_FILE"
    echo ""
    echo "🔍 Проверяю целостность бэкапа..."
    pg_restore --list "$BACKUP_FILE" | head -10
    echo ""
    echo "🎯 Бэкап готов! Можете приступать к очистке."
else
    echo "❌ Ошибка создания бэкапа!"
    exit 1
fi


