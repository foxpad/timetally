# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Устанавливаем deps (включая dev, чтобы был vite)
COPY package*.json ./
RUN npm ci

# Копируем код и собираем
COPY . .
# (опционально) пробросим Vite-переменные из build args:
ARG VITE_DEFAULT_URL
ENV VITE_DEFAULT_URL=${VITE_DEFAULT_URL}
RUN npm run build

# ---- Runtime stage (nginx) ----
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
