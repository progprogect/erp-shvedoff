# ERP Shvedoff - Система управления складскими остатками

Система управления складскими остатками и заказами резинотехнических изделий.

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+ 
- PostgreSQL 12+
- npm или yarn

### 1. Клонирование и установка зависимостей

```bash
# Клонировать репозиторий
git clone <repository-url>
cd erp-shvedoff

# Установить все зависимости
npm run install:all
```

### 2. Настройка базы данных

```bash
# Создать базу данных PostgreSQL
createdb erp_shvedoff

# Скопировать конфигурацию
cp backend/.env.example backend/.env

# Отредактировать backend/.env с вашими настройками БД
```

Пример конфигурации `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=erp_shvedoff
JWT_SECRET=your-super-secret-key
PORT=5000
```

### 3. Создание схемы БД и первичных данных

```bash
# Создать таблицы
npm run db:migrate

# Загрузить тестовые данные
npm run db:seed
```

### 4. Запуск в режиме разработки

```bash
# Запустить backend и frontend одновременно
npm run dev
```

Приложение будет доступно:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health check**: http://localhost:5000/health

## 📊 Тестовые пользователи

После выполнения `npm run db:seed` будут созданы пользователи:

| Логин | Пароль | Роль | Описание |
|-------|---------|------|-----------|
| director | 123456 | director | Директор по продажам |
| manager1 | 123456 | manager | Менеджер по продажам |
| production1 | 123456 | production | Сотрудник производства |
| warehouse1 | 123456 | warehouse | Сотрудник склада |

## 🏗️ Архитектура проекта

```
erp-shvedoff/
├── backend/           # Express.js API сервер
│   ├── src/
│   │   ├── db/       # Drizzle ORM схемы
│   │   ├── routes/   # API роуты
│   │   ├── middleware/ # Middleware функции
│   │   └── server.ts # Главный файл сервера
│   └── drizzle/      # Миграции БД
├── frontend/          # React приложение
│   ├── src/
│   │   ├── components/ # React компоненты
│   │   ├── pages/     # Страницы приложения
│   │   ├── stores/    # Zustand stores
│   │   └── services/  # API клиенты
└── docs/             # Документация
```

## 🎯 Основные функции (MVP)

### ✅ Реализовано в Задаче 1.1

- [x] PostgreSQL база данных с 15+ таблицами
- [x] Express.js API сервер с JWT аутентификацией
- [x] React frontend с TypeScript
- [x] Базовая маршрутизация и авторизация
- [x] Endpoint /health для проверки соединения
- [x] Система миграций БД

### 🔄 Следующие задачи

**Задача 1.2**: Аутентификация и авторизация (2 дня)
- Система входа в систему с 4 ролями
- JWT токены с автообновлением
- Middleware для проверки прав доступа

**Задача 1.3**: Базовый каталог товаров (4 дня)
- Иерархические категории
- Добавление товаров с характеристиками
- Поиск по названию и размерам

**Задача 1.4**: Учет остатков (3 дня)
- Отображение текущих остатков
- Цветовая индикация (норма/мало/критично)
- Операции корректировки остатков

## 🔧 API Endpoints

### Аутентификация
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/refresh` - Обновление токена
- `GET /api/auth/me` - Информация о пользователе
- `POST /api/auth/logout` - Выход

### Каталог товаров
- `GET /api/catalog/categories` - Список категорий
- `POST /api/catalog/categories` - Создание категории
- `GET /api/catalog/products` - Список товаров
- `GET /api/catalog/products/:id` - Детали товара
- `POST /api/catalog/products` - Создание товара

### Остатки
- `GET /api/stock` - Текущие остатки
- `POST /api/stock/adjust` - Корректировка остатков
- `GET /api/stock/movements/:productId` - История движения
- `POST /api/stock/reserve` - Резервирование
- `POST /api/stock/release` - Снятие резерва

### Заказы
- `GET /api/orders` - Список заказов
- `GET /api/orders/:id` - Детали заказа
- `POST /api/orders` - Создание заказа
- `PUT /api/orders/:id/status` - Изменение статуса
- `POST /api/orders/:id/messages` - Добавление сообщения

## 🛠️ Команды разработки

```bash
# Разработка
npm run dev              # Запуск в режиме разработки
npm run server:dev       # Только backend
npm run client:dev       # Только frontend

# База данных
npm run db:migrate       # Применить миграции
npm run db:seed          # Загрузить тестовые данные

# Продакшн
npm run build           # Собрать frontend
npm start              # Запустить в продакшн
```

## 📋 TODO (Следующие спринты)

### Спринт 2 (2 недели)
- [ ] Создание и управление заказами
- [ ] Дашборд с метриками
- [ ] Базовый импорт Excel

### Спринт 3 (2 недели) 
- [ ] Планирование производства
- [ ] Система отгрузок
- [ ] Операции резки

### Спринт 4 (2 недели)
- [ ] Telegram бот интеграция
- [ ] История операций и аудит

## 🐛 Известные проблемы

- Linter ошибки в TypeScript файлах исчезнут после `npm install`
- Требуется PostgreSQL 12+ для работы JSON полей
- Telegram бот будет добавлен в Спринте 4

## 📞 Поддержка

Для вопросов по разработке создайте issue в репозитории.

---

**Статус проекта**: 🟢 Задача 1.1 завершена (Настройка инфраструктуры и БД) 