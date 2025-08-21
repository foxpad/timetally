# TimeTally - Docker Setup

Инструкция по запуску проекта TimeTally с помощью Docker.

## Структура файлов

```
timetally/
├── client/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx.conf
│   └── ...
├── server/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   └── ...
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── init.sql
└── Makefile
```

## Быстрый старт

### 1. Подготовка окружения

```bash
# Скопируйте файл с переменными окружения
cp .env.example .env

# Отредактируйте .env файл, добавив ваши настройки
nano .env
```

### 2. Для разработки

```bash
# Запуск в режиме разработки
make dev-up

# Или напрямую через docker-compose
docker-compose -f docker-compose.dev.yml up -d

# Просмотр логов
make dev-logs
```

### 3. Для продакшена

```bash
# Сборка образов
make build

# Запуск
make up

# Просмотр логов
make logs
```

## Доступные команды

### Makefile команды

```bash
make help       # Показать все доступные команды
make build      # Собрать Docker образы
make up         # Запустить production версию
make down       # Остановить все сервисы
make logs       # Показать логи
make restart    # Перезапустить сервисы
make dev-up     # Запустить dev версию
make dev-down   # Остановить dev версию
make dev-logs   # Показать логи dev версии
make clean      # Очистить Docker данные
make clean-all  # Полная очистка (ОСТОРОЖНО!)
```

## Конфигурация

### Переменные окружения (.env)

```env
# Telegram Bot
BOT_TOKEN=your_bot_token_here
WEBHOOK_SECRET=your_webhook_secret_here
WEBHOOK_URL=https://yourdomain.com
WEBHOOK_PATH=/webhook

# URLs
CLIENT_URL=https://yourdomain.com
VITE_DEFAULT_URL=https://yourdomain.com/api
```

### Порты по умолчанию

- **Client (Frontend)**: `3000` (dev) / `3000` (prod)
- **Server (Backend)**: `8000`
- **PostgreSQL**: `5432`

## Режимы запуска

### Development режим

- Hot reload для клиента и сервера
- Монтирование исходного кода как volumes
- Отладочные настройки
- Отдельная база данных для разработки

### Production режим

- Оптимизированные Docker образы
- Nginx для статических файлов
- Продакшен настройки базы данных

## Troubleshooting

### Проблемы с запуском

```bash
# Проверить статус контейнеров
docker-compose ps

# Посмотреть логи конкретного сервиса
docker-compose logs server
docker-compose logs client
docker-compose logs postgres

# Перезапустить конкретный сервис
docker-compose restart server
```

### Проблемы с базой данных

```bash
# Подключиться к базе данных
docker-compose exec postgres psql -U timetally_user -d timetally

# Посмотреть логи базы данных
docker-compose logs postgres

# Пересоздать базу данных (ВНИМАНИЕ: удалит все данные)
docker-compose down -v
docker-compose up -d
```

### Очистка и перезапуск

```bash
# Остановить все и удалить volumes
docker-compose down -v

# Полная очистка Docker системы
make clean-all

# Пересборка образов
make build
make up
```

## Полезные команды Docker

```bash
# Зайти в контейнер сервера
docker-compose exec server bash

# Зайти в контейнер клиента
docker-compose exec client sh

# Посмотреть использование ресурсов
docker stats

# Посмотреть все образы
docker images

# Посмотреть все контейнеры
docker ps -a
```

## Обновление

```bash
# Обновить код и пересобрать
git pull
make build
make restart
```

## Backup базы данных

```bash
# Создать backup
docker-compose exec postgres pg_dump -U timetally_user timetally > backup.sql

# Восстановить из backup
docker-compose exec postgres psql -U timetally_user timetally < backup.sql
```