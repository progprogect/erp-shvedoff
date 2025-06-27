# Руководство разработчика

## 🏗️ Архитектура системы

### Backend (Node.js + Express + PostgreSQL)

```
backend/
├── src/
│   ├── db/              # База данных
│   │   ├── schema.ts    # Drizzle ORM схемы
│   │   └── index.ts     # Подключение к БД
│   ├── routes/          # API роуты
│   │   ├── auth.ts      # Аутентификация (FR-001)
│   │   ├── catalog.ts   # Каталог товаров (FR-002)
│   │   ├── stock.ts     # Остатки (FR-003)
│   │   └── orders.ts    # Заказы (FR-004)
│   ├── middleware/      # Middleware функции
│   │   ├── auth.ts      # JWT аутентификация
│   │   ├── errorHandler.ts # Обработка ошибок
│   │   └── logger.ts    # Логирование запросов
│   ├── scripts/         # Утилитарные скрипты
│   │   └── seed.ts      # Начальные данные
│   └── server.ts        # Главный файл сервера
├── drizzle/             # Миграции БД
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

### Frontend (React + TypeScript + Antd)

```
frontend/
├── src/
│   ├── components/      # Переиспользуемые компоненты
│   │   └── Layout/      # Layout компоненты
│   ├── pages/          # Страницы приложения
│   │   ├── Dashboard/   # Главная страница (Экран 1)
│   │   ├── Catalog/     # Каталог товаров (Экраны 2.1, 2.2)
│   │   ├── Stock/       # Остатки (Экраны 4.1, 4.2)
│   │   └── Orders/      # Заказы (Экраны 3.1, 3.2, 3.3)
│   ├── stores/         # Zustand состояние
│   │   └── authStore.ts # Аутентификация
│   ├── services/       # API клиенты
│   ├── types/          # TypeScript типы
│   └── utils/          # Утилитарные функции
├── public/
├── package.json
└── tsconfig.json
```

## 🗄️ Структура базы данных

### Основные таблицы (Задача 1.1)

| Таблица | Назначение | Связи |
|---------|------------|-------|
| `users` | Пользователи системы | - |
| `categories` | Иерархические категории | self-reference |
| `products` | Товары | → categories |
| `stock` | Остатки товаров | → products |
| `stock_movements` | История движения | → products, users |
| `orders` | Заказы | → users (manager) |
| `order_items` | Позиции заказов | → orders, products |
| `order_messages` | Чат по заказам | → orders, users |

### Enums

```sql
-- Роли пользователей (FR-001)
user_role: manager, director, production, warehouse

-- Статусы заказов (FR-004)  
order_status: new, confirmed, in_production, ready, shipped, delivered, cancelled

-- Приоритеты заказов
priority_level: low, normal, high, urgent

-- Типы движения остатков (FR-003)
movement_type: incoming, outgoing, cutting_out, cutting_in, reservation, release_reservation, adjustment
```

## 🔐 Система ролей (FR-001)

| Роль | Описание | Доступ |
|------|----------|--------|
| `director` | Директор по продажам | Полный доступ ко всем функциям |
| `manager` | Менеджер по продажам | Создание заказов, просмотр каталога |
| `production` | Производство | Очередь производства, резка |
| `warehouse` | Склад/Охрана | Остатки, отгрузки |

## 🛠️ Стек технологий

### Backend
- **Node.js 18+** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Типизация
- **PostgreSQL** - База данных
- **Drizzle ORM** - ORM для работы с БД
- **JWT** - Аутентификация
- **bcryptjs** - Хеширование паролей
- **Zod** - Валидация данных
- **Winston** - Логирование

### Frontend  
- **React 18** - UI библиотека
- **TypeScript** - Типизация
- **Antd** - UI компоненты
- **React Router** - Маршрутизация
- **Zustand** - Управление состоянием
- **React Query** - Кеширование API
- **Axios** - HTTP клиент

## 📝 Конвенции кода

### TypeScript
```typescript
// Используем строгую типизацию
interface User {
  id: number;
  username: string;
  role: 'manager' | 'director' | 'production' | 'warehouse';
}

// Экспортируем типы для переиспользования
export type { User };
```

### API Routes
```typescript
// Структура ответа API
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Ошибки с кодами статуса
const createError = (message: string, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};
```

### React компоненты
```tsx
// Используем FC с явными пропсами
interface Props {
  title: string;
  loading?: boolean;
}

const Component: React.FC<Props> = ({ title, loading = false }) => {
  return <div>{title}</div>;
};
```

## 🧪 Тестирование

### Backend тесты
```bash
# Запуск тестов
npm run test

# Тесты с покрытием
npm run test:coverage
```

### Frontend тесты
```bash
# Компонентные тесты
npm run test

# E2E тесты (в будущем)
npm run test:e2e
```

## 🔄 Git Workflow

### Ветки
- `main` - продакшн код
- `develop` - интеграционная ветка
- `feature/*` - новые функции
- `bugfix/*` - исправления багов
- `hotfix/*` - критические исправления

### Коммиты
```bash
# Формат коммитов
<type>(<scope>): <description>

# Примеры
feat(auth): add JWT token refresh
fix(orders): resolve reservation bug
docs(api): update endpoints documentation
```

## 📋 Чек-лист задач

### ✅ Задача 1.1: Инфраструктура (ЗАВЕРШЕНО)
- [x] PostgreSQL схема с 15+ таблицами
- [x] Express.js сервер с middleware
- [x] React приложение с маршрутизацией
- [x] TypeScript конфигурация
- [x] /health endpoint
- [x] Система миграций

### 🔄 Задача 1.2: Аутентификация (2 дня)
- [ ] Страница входа в систему
- [ ] JWT токены с refresh
- [ ] Middleware авторизации
- [ ] 4 роли пользователей
- [ ] Автоматическое обновление токена

### 🔄 Задача 1.3: Каталог товаров (4 дня)
- [ ] Иерархические категории
- [ ] Карточки товаров
- [ ] Поиск по названию/размерам
- [ ] Добавление/редактирование
- [ ] Фильтрация по категориям

### 🔄 Задача 1.4: Остатки (3 дня)
- [ ] Таблица остатков
- [ ] Цветовая индикация
- [ ] Корректировка остатков
- [ ] История движения
- [ ] Фильтры по статусу

## 🚀 Деплой

### Продакшн сборка
```bash
# Сборка frontend
npm run build

# Запуск в продакшн
npm start
```

### Docker (в будущем)
```dockerfile
# Dockerfile для backend и frontend
# docker-compose.yml для полного стека
```

## 📊 Мониторинг

### Логи
- **Backend**: Winston логи в файлы
- **Database**: PostgreSQL логи
- **Frontend**: Console логи (development)

### Метрики
- API response времена
- Количество запросов
- Ошибки базы данных
- Состояние остатков

## 🔧 Отладка

### Backend отладка
```bash
# Debug режим
NODE_ENV=development npm run dev

# PostgreSQL логи
tail -f /var/log/postgresql/postgresql.log
```

### Frontend отладка
```bash
# React DevTools
# Redux DevTools (для Zustand)
# Network tab для API запросов
```

## 📚 Полезные ссылки

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Antd Components](https://ant.design/components/overview/)
- [Zustand Guide](https://zustand-demo.pmnd.rs/)
- [React Query Docs](https://react-query.tanstack.com/)

---

**Следующий этап**: Задача 1.2 - Аутентификация и авторизация 