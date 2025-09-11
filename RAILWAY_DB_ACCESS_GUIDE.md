# 🚂 ИНСТРУКЦИЯ ПО ДОСТУПУ К БАЗАМ ДАННЫХ RAILWAY

## 📋 Общая информация

**Проект:** ERP-Shvedoff  
**Environments:** staging, production  
**СУБД:** PostgreSQL  
**Провайдер:** Railway

---

## 🔑 ПОДКЛЮЧЕНИЕ К RAILWAY CLI

### 1. Аутентификация
```bash
railway login --browserless
```

### 2. Выбор проекта
```bash
railway list
# Выбираем: ERP-Shvedoff

railway link
# Выбираем: progprogect's Projects → ERP-Shvedoff → staging/production → Postgres
```

### 3. Переключение между environments
```bash
# Переключиться на staging
railway environment
# Выбираем: staging

# Переключиться на production  
railway environment
# Выбираем: production

# Связать с сервисом PostgreSQL
railway service
# Выбираем: Postgres
```

---

## 🔧 ПОЛУЧЕНИЕ CREDENTIALS

### Просмотр переменных окружения
```bash
railway variables
```

### Ключевые переменные:
- **DATABASE_PUBLIC_URL** - внешний URL для подключения
- **PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE** - отдельные параметры

---

## 📊 ПОДКЛЮЧЕНИЕ К БАЗАМ ДАННЫХ

### STAGING DATABASE
```bash
# Connection String
postgresql://postgres:pTMtLhlEmgeRAtUlFvGBhAYLNIlMkhwL@tramway.proxy.rlwy.net:50363/railway

# Параметры подключения
Host: tramway.proxy.rlwy.net
Port: 50363  
User: postgres
Password: pTMtLhlEmgeRAtUlFvGBhAYLNIlMkhwL
Database: railway
```

### PRODUCTION DATABASE
```bash
# Connection String
postgresql://postgres:xeIitZntkaAAeoZSFpsOsfCOKpoORwGA@yamanote.proxy.rlwy.net:41401/railway

# Параметры подключения
Host: yamanote.proxy.rlwy.net
Port: 41401
User: postgres  
Password: xeIitZntkaAAeoZSFpsOsfCOKpoORwGA
Database: railway
```

---

## 💻 ПРИМЕРЫ ПОДКЛЮЧЕНИЯ

### 1. PSQL Command Line
```bash
# Staging
psql -h tramway.proxy.rlwy.net -p 50363 -U postgres -d railway

# Production
psql -h yamanote.proxy.rlwy.net -p 41401 -U postgres -d railway
```

### 2. Railway CLI (прямое подключение)
```bash
# Подключиться к текущему выбранному environment
railway connect
```

### 3. Выполнение SQL файлов
```bash
# Staging
psql -h tramway.proxy.rlwy.net -p 50363 -U postgres -d railway -f script.sql

# Production  
psql -h yamanote.proxy.rlwy.net -p 41401 -U postgres -d railway -f script.sql
```

---

## 🔒 БЕЗОПАСНОСТЬ

### ⚠️ Важные моменты:
- **НЕ коммитить** credentials в git
- **Использовать переменные** окружения
- **Делать backup** перед изменениями production
- **Тестировать на staging** перед production

### 🛡️ Backup команды:
```bash
# Backup staging
pg_dump -h tramway.proxy.rlwy.net -p 50363 -U postgres -d railway > staging_backup.sql

# Backup production
pg_dump -h yamanote.proxy.rlwy.net -p 41401 -U postgres -d railway > production_backup.sql
```

---

## 🚀 БЫСТРЫЕ КОМАНДЫ

### Переключение environments:
```bash
# К staging
railway environment    # → staging
railway service        # → Postgres

# К production  
railway environment    # → production
railway service        # → Postgres
```

### Получение информации:
```bash
railway variables       # Credentials текущего environment
railway status          # Статус проекта
railway logs            # Логи сервиса
```

---

## 📚 ПОЛЕЗНЫЕ ССЫЛКИ

- **Railway Dashboard:** https://railway.app/project/e1c19322-c2b0-4532-9ec4-1d8cf6670735
- **Staging App:** https://erp-shvedoff-staging.up.railway.app
- **Production App:** https://erp-shvedoff-production.up.railway.app

---

## 🆘 TROUBLESHOOTING

### Если потерял подключение:
1. `railway login --browserless` 
2. `railway link` → выбрать проект
3. `railway environment` → выбрать environment
4. `railway service` → выбрать Postgres

### Если нет доступа к environment:
1. Проверить права в Railway Dashboard
2. Убедиться что выбран правильный workspace

### Если изменились credentials:
1. `railway variables` для получения актуальных данных
2. Обновить подключения в приложениях

---

*Последнее обновление: $(date)*
*Проект: ERP-Shvedoff v2025*


