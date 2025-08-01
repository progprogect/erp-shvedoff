# 🚀 ИНСТРУКЦИЯ ПО МИГРАЦИИ НА PRODUCTION

## ⚠️ КРИТИЧЕСКИ ВАЖНО!

После деплоя кода **ОБЯЗАТЕЛЬНО** выполните миграции БД, иначе сервер не запустится!

## 📋 ПОСЛЕДОВАТЕЛЬНОСТЬ ВЫПОЛНЕНИЯ МИГРАЦИЙ

### 1. Подключитесь к production БД
```bash
psql -h your-db-host -U your-db-user -d erp_shvedoff
```

### 2. Выполните миграции в указанном порядке:

#### 🔹 Миграция 1: Поля источника заказов
```sql
-- Файл: backend/migrations/add_order_source.sql
-- КРИТИЧЕСКИ ВАЖНО! Без этой миграции export заказов не работает

-- Добавляем enum для источников заказов
CREATE TYPE order_source AS ENUM ('database', 'website', 'avito', 'referral', 'cold_call', 'other');

-- Добавляем поля в таблицу orders
ALTER TABLE orders
ADD COLUMN source order_source DEFAULT 'database',
ADD COLUMN custom_source VARCHAR(255);

-- Добавляем комментарии для понимания полей
COMMENT ON COLUMN orders.source IS 'Источник заказа: database - из базы клиентов, website - с сайта, avito - с Авито, referral - по рекомендации, cold_call - холодные звонки, other - другое';
COMMENT ON COLUMN orders.custom_source IS 'Описание источника если выбрано "other"';
```

#### 🔹 Миграция 2: Поле типа борта
```sql
-- Файл: backend/migrations/add_border_type_field.sql
-- Добавляет поле border_type в таблицу products

-- Создаем enum для типа борта
CREATE TYPE border_type AS ENUM ('with_border', 'without_border');

-- Добавляем поле в таблицу products
ALTER TABLE products 
ADD COLUMN border_type border_type;

-- Добавляем комментарий
COMMENT ON COLUMN products.border_type IS 'Тип борта: с бортом или без борта (Задача 7.1)';
```

#### 🔹 Миграция 3: Система разрешений (если еще не выполнена)
```sql
-- Файл: backend/migrations/create_permissions_and_assignments.sql
-- Создает таблицы permissions, role_permissions, user_permissions
-- ⚠️ Выполните только если таблиц permissions еще нет!

-- Проверьте существование таблицы:
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'permissions'
);

-- Если вернуло false, выполните полный скрипт create_permissions_and_assignments.sql
```

#### 🔹 Другие миграции (если нужны)
Проверьте и выполните при необходимости:
- `add_weight_and_grade_to_products.sql` - вес и сорт товаров
- `add_production_calendar_fields.sql` - поля планирования в производстве
- `add_production_tasks_user_fields.sql` - поля пользователей в заданиях
- `update_production_tasks_schema.sql` - обновление схемы заданий

### 3. Проверьте выполнение миграций

```sql
-- Проверьте что поля добавлены
\d orders
\d products  
\d permissions

-- Проверьте что enum'ы созданы
\dT order_source
\dT border_type
```

## 🔄 ПЕРЕЗАПУСК СЕРВИСОВ

После выполнения миграций:

1. **Перезапустите backend**:
   ```bash
   pm2 restart erp-backend
   # или
   systemctl restart erp-backend
   ```

2. **Проверьте логи**:
   ```bash
   pm2 logs erp-backend
   ```

3. **Проверьте health check**:
   ```bash
   curl http://localhost:5001/health
   ```

## ✅ ПРОВЕРКА РАБОТОСПОСОБНОСТИ

После деплоя проверьте:

1. **Авторизация работает** - войдите как director/123456
2. **Разделы открываются** - Каталог, Заказы, Производство, Разрешения
3. **Экспорт работает** - попробуйте экспортировать каталог
4. **Производственные задания** - проверьте просмотр деталей и редактирование

## 🚨 В СЛУЧАЕ ПРОБЛЕМ

Если что-то не работает:

1. **Проверьте логи backend**:
   ```bash
   pm2 logs erp-backend --lines 100
   ```

2. **Проверьте подключение к БД**:
   ```bash
   psql -h your-db-host -U your-db-user -d erp_shvedoff -c "SELECT version();"
   ```

3. **Откатите миграции если нужно**:
   ```sql
   DROP COLUMN IF EXISTS orders.source;
   DROP COLUMN IF EXISTS orders.custom_source;
   DROP TYPE IF EXISTS order_source;
   ```

## 📞 КОНТАКТЫ

В случае проблем с миграцией обращайтесь к разработчику.

---

**⚠️ ВАЖНО**: Не запускайте production без выполнения миграций!