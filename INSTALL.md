# 🚀 Быстрая установка ERP Shvedoff

## Команды для запуска

```bash
# 1. Установить зависимости
npm run install:all

# 2. Настроить БД
cp backend/.env.example backend/.env
# Отредактировать backend/.env с настройками PostgreSQL

# 3. Создать схему БД
npm run db:migrate

# 4. Загрузить тестовые данные  
npm run db:seed

# 5. Запустить в разработке
npm run dev
```

## Доступ к приложению

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000  
- **Health check**: http://localhost:5000/health

## Тестовые пользователи

| Логин | Пароль | Роль |
|-------|--------|------|
| director | 123456 | Директор |
| manager1 | 123456 | Менеджер |
| production1 | 123456 | Производство |
| warehouse1 | 123456 | Склад |

---

Подробности в [README.md](./README.md) 