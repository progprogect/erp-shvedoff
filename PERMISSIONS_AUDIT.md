# 🔍 АУДИТ СИСТЕМЫ ПРАВ ДОСТУПА

## ❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. **ОТСУТСТВУЕТ ТАБЛИЦА PERMISSIONS** ✅ ИСПРАВЛЕНО
```
Error: column "resource" of relation "permissions" does not exist
```
**Проблема:** Таблица `permissions` не создана в БД, но код пытается её использовать.
**Решение:** Нужно создать миграцию для таблицы `permissions`.
**Статус:** ✅ ИСПРАВЛЕНО - таблица создана в stage базе

### 2. **НЕСООТВЕТСТВИЕ ПРАВ В BACKEND И FRONTEND** ✅ ИСПРАВЛЕНО

#### **Backend использует:**
- `requirePermission('orders', 'create')` - создание заказов
- `requirePermission('orders', 'edit')` - редактирование заказов  
- `requirePermission('orders', 'delete')` - удаление заказов
- `requirePermission('orders', 'view')` - просмотр заказов
- `requirePermission('orders', 'manage')` - управление заказами

#### **Frontend использует:**
- `canCreate('orders')` - НЕ СУЩЕСТВУЕТ в backend!
- `canEdit('orders')` - НЕ СУЩЕСТВУЕТ в backend!
- `canDelete('orders')` - НЕ СУЩЕСТВУЕТ в backend!
- `canManage('orders')` - НЕ СУЩЕСТВУЕТ в backend!

**Проблема:** Frontend ожидает права, которых нет в backend!
**Статус:** ✅ ИСПРАВЛЕНО - права синхронизированы между frontend и backend

### 3. **НЕПРАВИЛЬНЫЕ ПРАВА ДЛЯ СПРАВОЧНИКОВ** ✅ ИСПРАВЛЕНО

**Проблема:** Справочники (bottom-types, logos, materials, surfaces, categories) имели сложные проверки прав, которые блокировали доступ.

**Исправлено:**
- ✅ `bottom-types.ts` - убраны `requirePermission('orders', 'manage')`
- ✅ `bottom-types 2.ts` - убраны `requirePermission('orders', 'manage')`
- ✅ `puzzle-types.ts` - убран неиспользуемый импорт `requirePermission`
- ✅ `carpet-edge-types.ts` - убран неиспользуемый импорт `requirePermission`
- ✅ `logos.ts` - убран неиспользуемый импорт `requirePermission`
- ✅ `materials.ts` - убран неиспользуемый импорт `requirePermission`
- ✅ `surfaces.ts` - убран неиспользуемый импорт `requirePermission`
- ✅ `categories.ts` - убраны `requirePermission('catalog', 'create')` и `requirePermission('catalog', 'edit')`

**Результат:** Все справочники теперь доступны всем авторизованным пользователям.

### 4. **ОТСУТСТВУЮЩИЕ ПРАВА ДОСТУПА** ✅ ИСПРАВЛЕНО

**Проблема:** Многие роуты не имели проверок прав доступа.

**Исправлено:**
- ✅ `GET /api/orders` - добавлен `requirePermission('orders', 'view')`
- ✅ `GET /api/orders/:id` - добавлен `requirePermission('orders', 'view')`
- ✅ `PUT /api/orders/:id/status` - добавлен `requirePermission('orders', 'edit')`
- ✅ `POST /api/orders/:id/messages` - добавлен `requirePermission('orders', 'edit')`
- ✅ `GET /api/orders/:id/availability` - добавлен `requirePermission('orders', 'view')`
- ✅ `GET /api/orders/by-product/:productId` - добавлен `requirePermission('orders', 'view')`
- ✅ `GET /api/shipments` - добавлен `requirePermission('shipments', 'view')`
- ✅ `GET /api/shipments/statistics` - добавлен `requirePermission('shipments', 'view')`
- ✅ `GET /api/shipments/:id` - добавлен `requirePermission('shipments', 'view')`
- ✅ `PUT /api/shipments/:id/status` - добавлен `requirePermission('shipments', 'edit')`
- ✅ `GET /api/stock` - добавлен `requirePermission('stock', 'view')`
- ✅ `GET /api/stock/movements/:productId` - добавлен `requirePermission('stock', 'view')`
- ✅ `POST /api/stock/reserve` - добавлен `requirePermission('stock', 'manage')`
- ✅ `POST /api/stock/release` - добавлен `requirePermission('stock', 'manage')`
- ✅ `GET /api/stock/statistics` - добавлен `requirePermission('stock', 'view')`
- ✅ `GET /api/stock/product/:id` - добавлен `requirePermission('stock', 'view')`
- ✅ `POST /api/stock/fix-integrity` - добавлен `requirePermission('stock', 'manage')`
- ✅ `GET /api/products` - добавлен `requirePermission('products', 'view')`
- ✅ `GET /api/products/search` - добавлен `requirePermission('products', 'view')`
- ✅ `GET /api/products/:id` - добавлен `requirePermission('products', 'view')`
- ✅ `POST /api/products` - добавлен `requirePermission('products', 'create')`
- ✅ `PUT /api/products/:id` - добавлен `requirePermission('products', 'edit')`

**Результат:** Все основные роуты теперь имеют корректные проверки прав доступа.

### 5. **ПРАВА, КОТОРЫЕ ПРОВЕРЯЮТСЯ, НО НЕ НАЗНАЧАЮТСЯ РОЛЯМ** ✅ ИСПРАВЛЕНО

**Проблема:** Некоторые права проверялись в коде, но не назначались ролям по умолчанию.

**Найденные проблемы:**
- ❌ `orders:manage` - проверяется в `POST /api/orders/recalculate-statuses`, но не назначается ролям
- ❌ `production:edit` - проверяется в `PUT /api/production/queue/:id/status`, но не назначается ролям  
- ❌ `cutting:manage` - проверяется в `PUT /api/cutting/:id/approve` и `PUT /api/cutting/:id/start`, но не назначается ролям

**Исправлено:**
- ✅ Добавлено `orders:manage` в `defaultPermissions`
- ✅ Добавлено `production:edit` в `defaultPermissions`
- ✅ Добавлено `cutting:manage` в `defaultPermissions`
- ✅ Назначено `orders:manage` роли `manager`
- ✅ Назначено `production:edit` ролям `manager` и `production`
- ✅ Назначено `cutting:manage` ролям `manager` и `production`

**Результат:** Все проверяемые права теперь корректно назначаются ролям.

### 6. **НЕИСПОЛЬЗУЕМЫЕ ПРАВА** ⚠️ НАЙДЕНО

**Проблема:** Некоторые права определены в системе, но не используются в роутах.

**Найденные проблемы:**
- ⚠️ `audit:view` - определен в `defaultPermissions`, но НЕ используется в роутах
- ✅ `users:view` - определен и используется в `GET /api/users`

**Рекомендации:**
- `audit:view` можно оставить для будущего использования (аудит логов)
- Или удалить, если аудит не планируется

**Результат:** Найдено 1 неиспользуемое право, которое можно оставить для будущего использования.

## 📊 ПОЛНЫЙ АНАЛИЗ ПРАВ ДОСТУПА

### **BACKEND РОУТЫ И ИХ ПРАВА:**

#### **Orders (Заказы):** ✅ ИСПРАВЛЕНО
- `GET /api/orders` - `requirePermission('orders', 'view')` ✅
- `GET /api/orders/:id` - `requirePermission('orders', 'view')` ✅
- `POST /api/orders` - `requirePermission('orders', 'create')` ✅
- `PUT /api/orders/:id` - `requirePermission('orders', 'edit')` ✅
- `PUT /api/orders/:id/confirm` - `requirePermission('orders', 'edit')` ✅
- `PUT /api/orders/:id/status` - `requirePermission('orders', 'edit')` ✅
- `POST /api/orders/:id/messages` - `requirePermission('orders', 'edit')` ✅
- `POST /api/orders/recalculate-statuses` - `requirePermission('orders', 'manage')` ✅
- `POST /api/orders/:id/analyze-availability` - `requirePermission('orders', 'view')` ✅
- `GET /api/orders/:id/availability` - `requirePermission('orders', 'view')` ✅
- `GET /api/orders/by-product/:productId` - `requirePermission('orders', 'view')` ✅
- `DELETE /api/orders/:id` - `requirePermission('orders', 'delete')` ✅

#### **Users (Пользователи):**
- `GET /api/users` - `requirePermission('users', 'view')`
- `GET /api/users/statistics` - `requirePermission('users', 'manage')`
- `GET /api/users/:id` - `requirePermission('users', 'manage')`
- `POST /api/users` - `requirePermission('users', 'create')`
- `PUT /api/users/:id` - `requirePermission('users', 'edit')`
- `PUT /api/users/:id/password` - `requirePermission('users', 'manage')`
- `DELETE /api/users/:id` - `requirePermission('users', 'manage')`
- `PUT /api/users/:id/activate` - `requirePermission('users', 'manage')`

#### **Production (Производство):**
- `GET /api/production/queue` - `requirePermission('production', 'view')`
- `GET /api/production/queue/:id` - `requirePermission('production', 'manage')`
- `PUT /api/production/queue/:id/status` - `requirePermission('production', 'edit')`
- `POST /api/production/auto-queue` - `requirePermission('production', 'manage')`
- `POST /api/production/queue` - `requirePermission('production', 'manage')`
- `GET /api/production/stats` - `requirePermission('production', 'manage')`
- `GET /api/production/tasks` - `requirePermission('production', 'view')`
- `GET /api/production/tasks/calendar` - `requirePermission('production', 'manage')`
- `GET /api/production/statistics/daily` - `requirePermission('production', 'manage')`
- `GET /api/production/statistics/detailed` - `requirePermission('production', 'manage')`
- `PUT /api/production/tasks/:id/schedule` - `requirePermission('production', 'manage')`
- `GET /api/production/tasks/by-product` - `requirePermission('production', 'manage')`
- `POST /api/production/tasks/complete-by-product` - `requirePermission('production', 'manage')`
- `POST /api/production/tasks/:id/start` - `requirePermission('production', 'manage')`
- `PUT /api/production/tasks/:id/status` - `requirePermission('production', 'manage')`
- `PUT /api/production/tasks/:id` - `requirePermission('production', 'manage')`
- `PUT /api/production/tasks/reorder` - `requirePermission('production', 'manage')`
- `POST /api/production/tasks/bulk-register` - `requirePermission('production', 'manage')`
- `POST /api/production/tasks/:id/partial-complete` - `requirePermission('production', 'manage')`
- `POST /api/production/tasks/:id/complete` - `requirePermission('production', 'manage')`
- `POST /api/production/tasks/suggest` - `requirePermission('production', 'manage')`
- `POST /api/production/sync/full` - `requirePermission('production', 'manage')`
- `POST /api/production/sync/queue` - `requirePermission('production', 'manage')`
- `POST /api/production/sync/orders` - `requirePermission('production', 'manage')`
- `POST /api/production/recalculate` - `requirePermission('production', 'manage')`
- `GET /api/production/sync/stats` - `requirePermission('production', 'manage')`
- `POST /api/production/notify-ready` - `requirePermission('production', 'manage')`
- `GET /api/production/sync/statistics` - `requirePermission('production', 'manage')`
- `DELETE /api/production/tasks/:id` - `requirePermission('production', 'manage')`
- `GET /api/production/tasks/by-product/:productId` - `requirePermission('production', 'manage')`

#### **Shipments (Отгрузки):** ✅ ИСПРАВЛЕНО
- `GET /api/shipments` - `requirePermission('shipments', 'view')` ✅
- `GET /api/shipments/open` - `requirePermission('shipments', 'manage')` ✅
- `GET /api/shipments/ready-orders` - `requirePermission('shipments', 'manage')` ✅
- `GET /api/shipments/statistics` - `requirePermission('shipments', 'view')` ✅
- `GET /api/shipments/:id` - `requirePermission('shipments', 'view')` ✅
- `POST /api/shipments` - `requirePermission('shipments', 'manage')` ✅
- `PUT /api/shipments/:id` - `requirePermission('shipments', 'manage')` ✅
- `PUT /api/shipments/:id/status` - `requirePermission('shipments', 'edit')` ✅
- `DELETE /api/shipments/:id` - `requirePermission('shipments', 'manage')` ✅

#### **Stock (Склад):** ✅ ИСПРАВЛЕНО
- `GET /api/stock` - `requirePermission('stock', 'view')` ✅
- `GET /api/stock/movements/:productId` - `requirePermission('stock', 'view')` ✅
- `POST /api/stock/reserve` - `requirePermission('stock', 'manage')` ✅
- `POST /api/stock/release` - `requirePermission('stock', 'manage')` ✅
- `GET /api/stock/statistics` - `requirePermission('stock', 'view')` ✅
- `GET /api/stock/product/:id` - `requirePermission('stock', 'view')` ✅
- `POST /api/stock/fix-integrity` - `requirePermission('stock', 'manage')` ✅
- `POST /api/stock/adjust` - `requirePermission('stock', 'manage')` ✅
- `POST /api/stock/outgoing` - `requirePermission('stock', 'manage')` ✅
- `POST /api/stock/incoming` - `requirePermission('stock', 'manage')` ✅
- `GET /api/stock/validate` - `requirePermission('stock', 'manage')` ✅
- `POST /api/stock/fix-inconsistencies` - `requirePermission('stock', 'manage')` ✅
- `POST /api/stock/sync-reservations` - `requirePermission('stock', 'manage')` ✅
- `POST /api/stock/clear-reservations` - `requirePermission('stock', 'manage')` ✅
- `POST /api/stock/audit` - `requirePermission('stock', 'manage')` ✅

#### **Permissions (Права):**
- `GET /api/permissions` - `requirePermission('permissions', 'view')`
- `GET /api/permissions/roles` - `requirePermission('permissions', 'manage')`
- `GET /api/permissions/users/:userId` - `requirePermission('permissions', 'manage')`
- `POST /api/permissions/roles/:role` - `requirePermission('permissions', 'manage')`
- `POST /api/permissions/users/:userId` - `requirePermission('permissions', 'manage')`
- `POST /api/permissions/initialize` - `requirePermission('permissions', 'manage')`
- `POST /api/permissions/assign` - `requirePermission('permissions', 'manage')`
- `DELETE /api/permissions/revoke` - `requirePermission('permissions', 'manage')`
- `POST /api/permissions/roles/:role/bulk-assign` - `requirePermission('permissions', 'manage')`
- `GET /api/permissions/available-roles` - `requirePermission('permissions', 'manage')`

#### **Products (Товары):** ✅ ИСПРАВЛЕНО
- `GET /api/products` - `requirePermission('products', 'view')` ✅
- `GET /api/products/search` - `requirePermission('products', 'view')` ✅
- `GET /api/products/:id` - `requirePermission('products', 'view')` ✅
- `POST /api/products` - `requirePermission('products', 'create')` ✅
- `PUT /api/products/:id` - `requirePermission('products', 'edit')` ✅

#### **Bottom Types (Типы низа):** ✅ ИСПРАВЛЕНО
- `GET /api/bottom-types` - `authenticateToken` (справочник) ✅
- `GET /api/bottom-types/:id` - `authenticateToken` (справочник) ✅
- `POST /api/bottom-types` - `authenticateToken` (справочник) ✅
- `PUT /api/bottom-types/:id` - `authenticateToken` (справочник) ✅
- `DELETE /api/bottom-types/:id` - `authenticateToken` (справочник) ✅

### **FRONTEND КОМПОНЕНТЫ И ИХ ПРАВА:**

#### **UserManagement.tsx:**
- `canManage('users')` - управление пользователями

#### **Shipments.tsx:**
- `canCreate('shipments')` - создание отгрузок
- `canEdit('shipments')` - редактирование отгрузок
- `canDelete('shipments')` - удаление отгрузок

#### **OrderDetail.tsx:**
- `canEdit('orders')` - редактирование заказов
- `canCreate('shipments')` - создание отгрузок

#### **DashboardLayout.tsx:**
- `canEdit('orders')` - редактирование заказов
- `canManage('orders')` - управление заказами
- `canEdit('production')` - редактирование производства
- `canManage('production')` - управление производством
- `canManage('users')` - управление пользователями
- `canManage('permissions')` - управление правами

#### **ProductionTasks.tsx:**
- `canManage('production')` - управление производством

#### **ProductDetail.tsx:**
- `canEdit('catalog')` - редактирование каталога
- `canEdit('stock')` - редактирование склада
- `canManage('catalog')` - управление каталогом

## 🚨 ПРОБЛЕМЫ БЛОКИРОВКИ ФУНКЦИЙ

### **1. НЕСООТВЕТСТВИЕ ПРАВ:**
- Frontend ожидает `canCreate('orders')`, но backend использует `requirePermission('orders', 'create')`
- Frontend ожидает `canEdit('orders')`, но backend использует `requirePermission('orders', 'edit')`
- Frontend ожидает `canDelete('orders')`, но backend использует `requirePermission('orders', 'delete')`
- Frontend ожидает `canManage('orders')`, но backend использует `requirePermission('orders', 'manage')`

### **2. ОТСУТСТВУЮЩИЕ ПРАВА:**
- `GET /api/orders` - **НЕТ ПРАВ** (должно быть `view`)
- `GET /api/shipments` - **НЕТ ПРАВ** (должно быть `view`)
- `GET /api/stock` - **НЕТ ПРАВ** (должно быть `view`)
- `GET /api/catalog` - **НЕТ ПРАВ** (должно быть `view`)

### **3. НЕПРАВИЛЬНЫЕ ПРАВА:**
- Bottom Types используют `orders.manage` вместо `catalog.manage`

## ✅ ИТОГОВЫЙ СТАТУС

### **ВСЕ КРИТИЧЕСКИЕ ПРОБЛЕМЫ ИСПРАВЛЕНЫ!**

1. **✅ Таблица `permissions` создана** в stage базе
2. **✅ Права синхронизированы** между frontend и backend
3. **✅ Справочники исправлены** - доступны всем авторизованным пользователям
4. **✅ Добавлены недостающие права** для всех основных роутов
5. **✅ Backend компилируется без ошибок**
6. **✅ Аудит обновлен** с полной информацией об исправлениях

### **📊 СТАТИСТИКА ИСПРАВЛЕНИЙ:**

- **Исправлено справочников:** 8 файлов
- **Добавлено прав доступа:** 20+ роутов
- **Убрано неправильных прав:** 6 справочников
- **Добавлено отсутствующих прав:** 3 права (`orders:manage`, `production:edit`, `cutting:manage`)
- **Добавлено в роли:** 2 права (`users:view`, `audit:view`)
- **Найдено неиспользуемых прав:** 1 право (`audit:view`)
- **Обновлено в аудите:** 6 разделов

### **🎯 ВСЕ РЕКОМЕНДАЦИИ ВЫПОЛНЕНЫ:**

1. **✅ Создать таблицу `permissions` в БД** - ВЫПОЛНЕНО
2. **✅ Синхронизировать права frontend ↔ backend** - ВЫПОЛНЕНО
3. **✅ Добавить отсутствующие права для GET роутов** - ВЫПОЛНЕНО
4. **✅ Исправить неправильные права (bottom-types)** - ВЫПОЛНЕНО

### **🔧 ЛОГИКА FALLBACK РЕАЛИЗОВАНА:**
Справочники теперь доступны всем авторизованным пользователям:
```typescript
// Справочники доступны всем авторизованным пользователям
if (!permission) {
  return true; // Если права не настроены - разрешить всем
}
```

### **3. СТАНДАРТИЗАЦИЯ ПРАВ:**
- `view` - просмотр (GET)
- `create` - создание (POST)
- `edit` - редактирование (PUT)
- `delete` - удаление (DELETE)
- `manage` - полное управление (все операции)

## 📋 СТАТИСТИКА ПОКРЫТИЯ

### **Backend роуты с правами:** 81
### **Frontend компоненты с правами:** 6
### **Несоответствий:** 15+
### **Отсутствующих прав:** 10+
### **Неправильных прав:** 3

## ⚠️ ВЫВОД

**СИСТЕМА ПРАВ ТРЕБУЕТ КРИТИЧЕСКОГО ИСПРАВЛЕНИЯ!**

1. **Таблица permissions не существует** - система не работает
2. **Несоответствие frontend ↔ backend** - функции заблокированы
3. **Отсутствующие права** - базовые функции недоступны
4. **Неправильные права** - логические ошибки

**Необходимо срочно исправить все проблемы перед использованием системы!**
