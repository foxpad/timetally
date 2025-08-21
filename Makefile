# Makefile для удобного управления Docker проектом

.PHONY: help build up down logs restart clean dev-up dev-down dev-logs

# Показать доступные команды
help:
	@echo "Доступные команды:"
	@echo "  build     - Собрать все Docker образы"
	@echo "  up        - Запустить все сервисы (production)"
	@echo "  down      - Остановить все сервисы"
	@echo "  logs      - Показать логи всех сервисов"
	@echo "  restart   - Перезапустить все сервисы"
	@echo "  clean     - Очистить все Docker данные"
	@echo "  dev-up    - Запустить в режиме разработки"
	@echo "  dev-down  - Остановить режим разработки"
	@echo "  dev-logs  - Логи разработки"

# Production команды
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

restart:
	docker-compose restart

# Development команды
dev-up:
	docker-compose -f docker-compose.dev.yml up -d

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

# Очистка
clean:
	docker-compose down -v
	docker system prune -f
	docker volume prune -f

# Полная очистка (ОСТОРОЖНО: удаляет все данные)
clean-all:
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -af
	docker volume prune -f