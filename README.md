# First Seller CRM 🚀

CRM система для отдела продаж с интеграциями Telegram и Mango Office.

## ✅ Что готово:

### Backend:
- **База данных:** SQLite с Prisma ORM
- **API Routes:**
  - `/api/auth/login` - авторизация менеджеров
  - `/api/contacts` - CRUD контактов
  - `/api/messages` - чат сообщения
  - `/api/calls` - история звонков
  - `/api/telegram/webhook` - webhook Telegram
  - `/api/mango/webhook` - webhook Mango Office

### Интеграции:
- **Telegram Bot** - двусторонний чат с клиентами
- **Mango Office** - история звонков, записи разговоров
- **Транскрибация** - автоматическая расшифровка звонков (Whisper API)

### Frontend:
- Страница входа
- Dashboard с статистикой
- Чат с контактами (Telegram)
- Страницы: Контакты, Звонки, Сделки, Настройки

---

## 🎯 Запуск:

Сервер уже запущен на **http://localhost:3000**

### Данные для входа:
```
Email: admin@first-seller.ru
Пароль: admin123
```

или

```
Email: manager@first-seller.ru
Пароль: manager123
```

---

## 📋 Настройка интеграций:

### 1. Telegram Bot

Откройте `.env` и добавьте токен бота:

```env
TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
```

### 2. Mango Office

Добавьте в `.env`:

```env
MANGO_API_KEY="YOUR_MANGO_API_KEY"
MANGO_API_SALT="YOUR_MANGO_API_SALT"
MANGO_VPN_ID="YOUR_MANGO_VPN_ID"
```

### 3. OpenAI (для транскрибации)

Добавьте в `.env`:

```env
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

---

## 📦 Команды:

```bash
# Разработка
npm run dev

# Prod сборка
npm run build
npm start

# База данных
npm run db:migrate  # Создать миграцию
npm run db:seed     # Заполнить тестовыми данными
npm run db:studio   # Открыть Prisma Studio

# Telegram бот
npm run telegram:start   # Запустить в polling режиме (для разработки)
npm run telegram:setup   # Установить webhook (для production)
npm run telegram:remove  # Удалить webhook
```

---

## 🔥 Возможности:

### Менеджер может:
- ✅ Вести чат с клиентами через Telegram прямо из CRM
- ✅ Просматривать историю звонков
- ✅ Слушать записи разговоров
- ✅ Читать транскрибацию звонков с AI анализом
- ✅ Управлять контактами и сделками
- ✅ Видеть статистику в реальном времени

---

## 📝 База данных:

SQLite база находится в `prisma/dev.db`

Модели:
- `User` - менеджеры (10 человек)
- `Contact` - клиенты/лиды
- `Deal` - сделки
- `Message` - сообщения (Telegram)
- `Call` - звонки (Mango Office)
- `CallTranscription` - AI транскрибация
- `Integration` - настройки интеграций

---

## 🛠 Технологии:

- **Next.js 15** - React framework
- **Prisma 5** - ORM
- **SQLite** - Database
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **Grammy** - Telegram Bot
- **OpenAI Whisper** - Транскрибация

---

## 🚀 Деплой и CI/CD

### Быстрый старт с Docker

1. Склонируйте репозиторий:
```bash
git clone https://github.com/your-username/first-seller-crm.git
cd first-seller-crm
```

2. Создайте `.env` файл на основе `.env.example`:
```bash
cp .env.example .env
```

3. Заполните `.env` файл своими данными:
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="ваш-секретный-ключ"
NEXTAUTH_URL="https://ваш-домен.com"
TELEGRAM_BOT_TOKEN="токен-бота-telegram"
TELEGRAM_WEBHOOK_URL="https://ваш-домен.com/api/telegram/webhook"
```

4. Запустите с помощью Docker Compose:
```bash
docker-compose up -d
```

Приложение будет доступно на [http://localhost:3000](http://localhost:3000)

### Деплой на VPS сервер

#### Требования:
- Ubuntu 20.04+ или Debian 11+
- Node.js 20+
- PM2 (для управления процессами)
- Nginx (для reverse proxy и SSL)

#### Шаг 1: Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PM2
sudo npm install -g pm2

# Установка Nginx
sudo apt install -y nginx
```

#### Шаг 2: Клонирование проекта

```bash
# Создание директории
sudo mkdir -p /var/www/first-seller-crm
sudo chown -R $USER:$USER /var/www/first-seller-crm

# Клонирование
cd /var/www/first-seller-crm
git clone https://github.com/your-username/first-seller-crm.git .
```

#### Шаг 3: Настройка приложения

```bash
# Установка зависимостей
npm ci

# Создание .env файла
cp .env.example .env
nano .env  # Заполните своими данными

# Генерация Prisma Client
npx prisma generate

# Миграции базы данных
npx prisma migrate deploy

# Заполнение базы тестовыми данными (опционально)
npm run db:seed

# Сборка проекта
npm run build

# Запуск с PM2
pm2 start npm --name "first-seller-crm" -- start
pm2 save
pm2 startup
```

#### Шаг 4: Настройка Nginx

Создайте конфигурацию Nginx:

```bash
sudo nano /etc/nginx/sites-available/first-seller-crm
```

Добавьте конфигурацию:

```nginx
server {
    listen 80;
    server_name ваш-домен.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/first-seller-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Шаг 5: SSL с Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ваш-домен.com
```

#### Шаг 6: Настройка Telegram Webhook

```bash
cd /var/www/first-seller-crm
npm run telegram:setup
```

### Автоматический деплой с GitHub Actions

Проект настроен для автоматического деплоя при push в ветку `main`.

#### Настройка GitHub Secrets

Добавьте следующие секреты в настройках репозитория (Settings → Secrets and variables → Actions):

- `SERVER_HOST` - IP адрес или домен вашего сервера
- `SERVER_USER` - имя пользователя для SSH (например, `root` или `ubuntu`)
- `SERVER_SSH_KEY` - приватный SSH ключ для доступа к серверу
- `SERVER_PORT` - порт SSH (по умолчанию 22)

#### Генерация SSH ключа

На вашем локальном компьютере:

```bash
# Генерация SSH ключа
ssh-keygen -t ed25519 -C "github-actions"

# Копирование публичного ключа на сервер
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@server-ip

# Скопируйте приватный ключ в GitHub Secrets
cat ~/.ssh/id_ed25519
```

#### Рабочие процессы (Workflows)

1. **CI Pipeline** (`.github/workflows/ci.yml`):
   - Запускается при push и pull request
   - Проверяет код (ESLint)
   - Проверяет типы (TypeScript)
   - Собирает приложение

2. **Deploy Pipeline** (`.github/workflows/deploy.yml`):
   - Запускается при push в ветку `main`
   - Подключается к серверу по SSH
   - Выполняет `git pull`
   - Устанавливает зависимости
   - Запускает миграции
   - Пересобирает приложение
   - Перезапускает PM2
   - Обновляет Telegram webhook

### Локальная разработка Telegram бота

Для локальной разработки используйте polling режим:

```bash
npm run telegram:start
```

Это запустит бота в режиме polling, который работает на localhost без необходимости публичного домена.

### Мониторинг и обслуживание

```bash
# Просмотр логов PM2
pm2 logs first-seller-crm

# Перезапуск приложения
pm2 restart first-seller-crm

# Статус приложения
pm2 status

# Просмотр логов Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Проверка статуса Telegram webhook
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
```

### Резервное копирование

Настройте регулярное резервное копирование:

```bash
# Создайте скрипт backup.sh
#!/bin/bash
BACKUP_DIR="/var/backups/first-seller-crm"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Бэкап базы данных
cp /var/www/first-seller-crm/prisma/dev.db $BACKUP_DIR/db_$DATE.db

# Бэкап файлов
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/first-seller-crm/public/uploads

# Удаление старых бэкапов (старше 30 дней)
find $BACKUP_DIR -type f -mtime +30 -delete

# Добавьте в crontab для ежедневного выполнения:
# 0 2 * * * /path/to/backup.sh
```

### Обновление приложения

```bash
cd /var/www/first-seller-crm
git pull origin main
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart first-seller-crm
```

Или просто сделайте push в ветку `main` - GitHub Actions автоматически задеплоит изменения.

---

## 📚 Дополнительная документация

- [Настройка Telegram интеграции](./TELEGRAM_SETUP.md) - подробное руководство по настройке Telegram бота

---

© 2024 First Seller CRM
