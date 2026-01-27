# Инструкция по деплою на сервер

## Шаг 1: Добавление SSH ключа на сервер

У вас уже сгенерирован SSH ключ для GitHub Actions. Теперь нужно добавить публичный ключ на ваш сервер.

### Публичный ключ (добавьте его на сервер):
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMUTzV5gH0InslkmPR+xEPEhzJ4C5sTumuo8+Ofp5sGE github-actions-deploy
```

### Способ 1: Автоматическое добавление (если есть доступ к серверу)
```bash
# Замените YOUR_SERVER_IP и YOUR_USERNAME на свои данные
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub YOUR_USERNAME@YOUR_SERVER_IP
```

### Способ 2: Ручное добавление
1. Подключитесь к серверу:
```bash
ssh YOUR_USERNAME@YOUR_SERVER_IP
```

2. Добавьте ключ в authorized_keys:
```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMUTzV5gH0InslkmPR+xEPEhzJ4C5sTumuo8+Ofp5sGE github-actions-deploy" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Шаг 2: Добавление GitHub Secrets

Перейдите на: https://github.com/vdovinurij05-glitch/first-seller-crm/settings/secrets/actions

Добавьте следующие секреты:

### SERVER_SSH_KEY
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDFE81eYB9CJ7JZJj0fsRDxIcyeAubE7prqPPjn6ebBhAAAAJjMslkuzLJZ
LgAAAAtzc2gtZWQyNTUxOQAAACDFE81eYB9CJ7JZJj0fsRDxIcyeAubE7prqPPjn6ebBhA
AAAEBDVdoBdS0RzK5hEY/hJkEUhys0eAAlICducYcFnvQ/WsUTzV5gH0InslkmPR+xEPEh
zJ4C5sTumuo8+Ofp5sGEAAAAFWdpdGh1Yi1hY3Rpb25zLWRlcGxveQ==
-----END OPENSSH PRIVATE KEY-----
```

### SERVER_HOST
Ваш IP адрес сервера (например: `123.45.67.89`)

### SERVER_USER
Имя пользователя SSH (обычно `root` или `ubuntu`)

### SERVER_PORT
Порт SSH (обычно `22`)

## Шаг 3: Первый деплой

После настройки секретов просто выполните:

```bash
cd C:\Users\79017\first-seller-crm
git add .
git commit -m "Configure deployment"
git push origin main
```

GitHub Actions автоматически задеплоит приложение на ваш сервер!

## Проверка деплоя

Проверить статус деплоя можно на:
https://github.com/vdovinurij05-glitch/first-seller-crm/actions

## Где купить VPS сервер?

Если у вас еще нет сервера, рекомендуем:

### Российские провайдеры:
- **Timeweb** (от 299₽/мес) - https://timeweb.com/ru/services/vds
- **Selectel** (от 250₽/мес) - https://selectel.ru/services/cloud/servers/
- **Beget** (от 240₽/мес) - https://beget.com/ru/vps

### Зарубежные провайдеры:
- **DigitalOcean** (от $4/мес) - https://digitalocean.com
- **Vultr** (от $2.50/мес) - https://vultr.com
- **Hetzner** (от €4.51/мес) - https://hetzner.com

### Минимальные требования для CRM:
- CPU: 1-2 ядра
- RAM: 1-2 GB
- Диск: 20-40 GB SSD
- ОС: Ubuntu 22.04 LTS

## После покупки сервера

1. Получите IP адрес сервера и данные для доступа
2. Добавьте публичный ключ на сервер (см. Шаг 1)
3. Обновите GitHub Secrets с правильными данными
4. Сделайте push - деплой запустится автоматически!
