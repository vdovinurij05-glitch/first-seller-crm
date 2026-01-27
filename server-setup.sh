#!/bin/bash

echo "🚀 Настройка сервера для First Seller CRM"
echo "=========================================="

# Обновление системы
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# Установка необходимых пакетов
echo "📦 Установка базовых пакетов..."
apt install -y curl git build-essential

# Установка Node.js 20
echo "📦 Установка Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Проверка установки Node.js
echo "✅ Проверка версий..."
node --version
npm --version

# Установка PM2
echo "📦 Установка PM2..."
npm install -g pm2

# Создание директории для приложения
echo "📁 Создание директории для приложения..."
mkdir -p /var/www/first-seller-crm
chown -R $USER:$USER /var/www/first-seller-crm

echo ""
echo "✅ Сервер успешно настроен!"
echo "=========================================="
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "PM2: $(pm2 --version)"
echo ""
echo "Теперь можно запускать автоматический деплой с GitHub Actions!"
