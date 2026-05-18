# Деплой на Vercel

Данная инструкция описывает развёртывание проекта на Vercel (рекомендуемая платформа для Next.js).

## Предварительные требования

- Завершённая локальная разработка (см. `docs/SETUP.md`)
- GitHub аккаунт и репозиторий проекта
- Vercel аккаунт ([vercel.com](https://vercel.com))

## Способ 1: Через Vercel Dashboard (рекомендуется)

### 1.1 Подготовка репозитория

Убедитесь, что проект залит на GitHub:

```bash
git remote -v
# output: origin  https://github.com/your-org/wovsdh_nails.git (fetch)
```

Если репозитория нет:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-org/wovsdh_nails.git
git push -u origin main
```

### 1.2 Создание проекта на Vercel

1. Перейти на [vercel.com](https://vercel.com)
2. Нажать **+ Add New → Project**
3. Выбрать **Import Git Repository**
4. Найти репозиторий `wovsdh_nails`
5. Нажать **Import**

Vercel автоматически определит, что это Next.js проект.

### 1.3 Настройка переменных окружения

В странице конфигурации проекта:

1. **Environment Variables** → **Add**
2. Добавить ВСЕ переменные из `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...
TELEGRAM_BOT_TOKEN = 123456789:ABC...
TELEGRAM_WEBHOOK_SECRET = random_secret_123
GOOGLE_CLIENT_ID = xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = GOCSPX-xxxxx
GOOGLE_REFRESH_TOKEN_RISHON = 1//0xxx
GOOGLE_REFRESH_TOKEN_ASHDOD = 1//0xxx
GOOGLE_CALENDAR_ID_RISHON = your-calendar-id@group.calendar.google.com
GOOGLE_CALENDAR_ID_ASHDOD = your-calendar-id@group.calendar.google.com
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = your@gmail.com
SMTP_PASS = xxxx xxxx xxxx xxxx
SMTP_FROM = "WOVSDH Nails <your@gmail.com>"
NEXT_PUBLIC_APP_URL = https://your-domain.com
ADMIN_SECRET_KEY = strong_secret_here
NEXT_PUBLIC_GA_MEASUREMENT_ID = G-XXXXX
NEXT_PUBLIC_GTM_ID = GTM-XXXXX
GOOGLE_SITE_VERIFICATION = xxxxx
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID = AW-XXXXXXXXXX/YYYYYYY
```

**ВАЖНО:**
- `NEXT_PUBLIC_*` переменные видны в клиентском коде (не могут содержать secrets)
- Остальные переменные видны только на сервере

### 1.4 Развёртывание

1. Нажать **Deploy**
2. Дождаться завершения build (обычно 2-5 минут)
3. Получить URL: `https://wovsdh-nails.vercel.app`

Проверить что деплой прошёл успешно:

```bash
curl https://wovsdh-nails.vercel.app
# Должен вернуться HTML лендинга
```

## Способ 2: Через Vercel CLI

Если предпочитаете CLI:

### 2.1 Установить Vercel CLI

```bash
npm i -g vercel
```

### 2.2 Авторизация

```bash
vercel login
```

Открыть ссылку в браузере, авторизоваться, вернуться в терминал.

### 2.3 Первый деплой

```bash
vercel --prod
```

Vercel попросит ввести детали проекта интерактивно. Ответить:

- **Which scope do you want to deploy to?** → выбрать свой аккаунт
- **Link to existing project?** → No (первый деплой)
- **What's your project's name?** → wovsdh-nails
- **In which directory is your code?** → . (текущая директория)
- **Want to override the settings?** → N

Затем добавить переменные окружения:

```bash
vercel env add
# Ввести переменную, значение, выбрать окружение (Production, Preview, Development)
# Повторить для всех переменных
```

Или через Vercel Dashboard (способ 1.3).

### 2.4 Последующие деплои

После первого деплоя, просто:

```bash
git commit -m "Changes"
git push origin main
# Vercel автоматически задеплоит при push на main
```

Или ручной деплой:

```bash
vercel --prod
```

## Постдеплойные действия

### 3.1 Обновление переменных окружения для Vercel

После деплоя нужно обновить некоторые переменные, т.к. приложение теперь имеет публичный URL:

1. **NEXT_PUBLIC_APP_URL** → `https://wovsdh-nails.vercel.app` (или ваш домен)
2. **GOOGLE_REDIRECT_URI** → `https://wovsdh-nails.vercel.app/api/auth/google/callback`

Обновить в Vercel Dashboard → Settings → Environment Variables.

### 3.2 Настройка Telegram вебхука

Telegram вебхук нужно установить на новый URL:

```bash
curl -X POST "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook" \
  -d "url=https://wovsdh-nails.vercel.app/api/telegram/webhook" \
  -d "secret_token={TELEGRAM_WEBHOOK_SECRET}"
```

Проверить статус:

```bash
curl "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getWebhookInfo" | jq
```

Ожидаемый ответ:

```json
{
  "ok": true,
  "result": {
    "url": "https://wovsdh-nails.vercel.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "ip_address": "...",
    "last_error_date": null
  }
}
```

### 3.3 Проверка API endpoints

```bash
# Получить слоты
curl "https://wovsdh-nails.vercel.app/api/slots?studio_id=rishon&date=2025-06-01"

# Получить .ics календаря
curl "https://wovsdh-nails.vercel.app/api/calendar/ics?booking_id=..."
```

### 3.4 Проверка админ-панели

Открыть в браузере: `https://wovsdh-nails.vercel.app/admin`

Ввести `ADMIN_SECRET_KEY` (из переменных окружения).

## Настройка доменного имени

Если используется свой домен (например, `nails.example.com`):

### 4.1 В Vercel Dashboard

1. Settings → Domains
2. **Add Domain**
3. Ввести домен: `nails.example.com`
4. Скопировать значение для DNS CNAME
5. Добавить CNAME запись в своём DNS хостере

### 4.2 Обновить переменные окружения

Обновить в Vercel:

- `NEXT_PUBLIC_APP_URL` → `https://nails.example.com`
- `GOOGLE_REDIRECT_URI` → `https://nails.example.com/api/auth/google/callback`

### 4.3 Переустановить Telegram вебхук

```bash
curl -X POST "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook" \
  -d "url=https://nails.example.com/api/telegram/webhook" \
  -d "secret_token={TELEGRAM_WEBHOOK_SECRET}"
```

## Мониторинг и логирование

Vercel предоставляет встроенный мониторинг:

1. **Function Logs** → Settings → Functions → Logs
   - Видны логи всех API endpoints
   - Можно искать по статусу, времени, ошибкам

2. **Analytics** → Deployment Analytics
   - Можно отслеживать production traffic

3. **Deployments** → История всех деплоев
   - Можно откатиться на предыдущую версию одним кликом

## Откат на предыдущую версию

Если что-то сломалось:

1. Vercel Dashboard → Deployments
2. Найти рабочий деплой
3. Нажать **Promote to Production**

Откат происходит мгновенно (без перекомпиляции).

## CI/CD автоматизация

Vercel по умолчанию настраивает CI/CD:

- **Push на main** → автоматический деплой на production
- **Pull Request** → автоматический Preview деплой
- **Ревью Preview** → можно посмотреть изменения перед мерджем

Больше ничего настраивать не нужно.

## Масштабирование и лимиты

Vercel Free tier включает:

- Неограниченное количество деплоев
- Неограниченное количество проектов
- Максимум 12 Serverless Function вызовов в секунду
- 100 hours месячный лимит функций

Для большего трафика перейти на Pro план (используется автоматически при превышении лимитов).

## Troubleshooting

### Деплой не прошёл

Проверить логи:

1. Vercel Dashboard → Deployments → Select failed deployment
2. **Build Logs** → изучить ошибку

Частые проблемы:

- **TypeScript ошибка**: проверить `npm run build` локально
- **Missing environment variable**: убедитесь что все переменные добавлены в Vercel Dashboard
- **npm install failed**: может быть проблема с зависимостями, попробовать `npm ci` вместо `npm install`

### API endpoints не работают

1. Проверить что environment variables установлены
2. Посмотреть Function Logs
3. Проверить что Supabase RLS политики корректны

### Telegram вебхук не работает

```bash
# Проверить статус
curl "https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo" | jq

# Результат должен показать URL и last_error_date (null если всё OK)
# Если last_error_date не null, посмотреть последнюю ошибку
```

### Email не отправляется

1. Проверить что SMTP переменные установлены
2. Посмотреть Function Logs (поиск по endpoint `/api/internal/send-confirmation-email`)
3. Проверить что App Password или SMTP Key правильно скопирован

## Production чек-лист

Перед выпуском на production:

- [ ] Все environment variables установлены в Vercel
- [ ] Локальное тестирование пройдено (GET slots, POST booking, cancel)
- [ ] Telegram вебхук работает
- [ ] Google Calendar интеграция тестирована
- [ ] Email отправляется
- [ ] Админ-панель защищена паролем
- [ ] SEO метаданные заполнены
- [ ] Google Analytics и GTM работают
- [ ] SSL сертификат установлен (автоматически на Vercel)
- [ ] Логирование включено

## Дополнительные ресурсы

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)
- [Environment Variables in Vercel](https://vercel.com/docs/projects/environment-variables)
