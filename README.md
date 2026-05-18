# WOVSDH Nails — Система онлайн-записи

Полнофункциональная SPA система онлайн-записи для двух студий маникюра в Израиле (Ришон-ле-Цион и Ашдод).

Клиентам доступна современная форма бронирования на лендинге, автоматическое подтверждение через Telegram, синхронизация с Google Calendar и информирование по email.

## Возможности

| Функция | Описание |
|---------|----------|
| **Лендинг** | Красивая посадочная страница с галереей, описанием студий, формой бронирования и контактами |
| **Онлайн-бронирование** | Выбор города, даты, времени, ввод контактов — всё в одной форме на сайте |
| **Управление слотами** | Админ-панель для создания и управления временными окнами записи |
| **Telegram-интеграция** | Уведомление сотрудников о новых заявках с кнопкой подтверждения в боте |
| **Google Calendar** | Автоматическое создание событий в отдельных календарях для каждой студии |
| **Email-уведомления** | Отправка подтверждения с .ics-файлом и ссылкой на отмену, уведомление об отмене |
| **Отмена по ссылке** | Клиент может отменить запись через уникальную ссылку в email (без авторизации) |
| **SEO & Аналитика** | Настроена индексация, Google Search Console, Google Analytics 4, GTM, Google Ads |
| **Безопасность** | RLS в Supabase, валидация на фронт и бэк, защита admin-панели по secret key |

## Стек технологий

| Слой | Технология | Версия |
|------|-----------|--------|
| **Frontend** | Next.js (App Router) | 16.x |
| **Язык** | TypeScript | 5.x |
| **Стили** | Tailwind CSS + Lucide Icons | 4.x |
| **Backend** | Next.js API Routes | 16.x |
| **БД** | Supabase (PostgreSQL 15) | 2.x |
| **Auth** | Google OAuth 2.0 (для интеграций) | — |
| **Уведомления** | Telegram Bot API (webhook) | — |
| **Календарь** | Google Calendar API (OAuth 2.0) | v3 |
| **Email** | Nodemailer (SMTP) | 8.x |
| **Хостинг** | Vercel | — |

## Быстрый старт

### Предварительные требования

- Node.js 18+ и npm
- Аккаунт Supabase (Free tier достаточно)
- Аккаунт Telegram для создания бота

### 1. Клонирование и установка зависимостей

```bash
git clone <repository-url>
cd wovsdh_nails
npm install
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env.local
```

Заполнить `.env.local`:

- Supabase URL и API ключи
- Telegram Bot TOKEN и webhook secret
- Google Calendar credentials (опционально для локальной разработки)
- SMTP параметры для email (опционально)
- Admin secret для доступа к `/admin`

### 3. Инициализация БД

```bash
# Через Supabase Dashboard (https://supabase.com/dashboard)
# или через SQL Editor выполнить содержимое supabase/migrations/001_initial_schema.sql
```

### 4. Запуск локального сервера

```bash
npm run dev
```

Сайт доступен на http://localhost:3000

## Структура проекта

```
wovsdh_nails/
├── app/                           # Next.js App Router
│   ├── (landing)/                 # Лендинг (index, layout)
│   ├── admin/                     # Админ-панель для управления слотами
│   ├── cancel/                    # Страница отмены записи по токену
│   ├── api/                       # API endpoints
│   │   ├── slots/                 # GET /api/slots — получить свободные слоты
│   │   ├── bookings/              # POST /api/bookings — создать запись
│   │   │   └── cancel/            # POST /api/bookings/cancel — отменить запись
│   │   ├── calendar/ics/          # GET /api/calendar/ics — .ics файл для события
│   │   ├── admin/slots/           # POST/GET/DELETE для управления слотами
│   │   ├── telegram/webhook/      # POST для обработки Telegram callback
│   │   ├── internal/              # Внутренние endpoints (защищены secret key)
│   │   │   ├── confirm-booking/   # POST — подтвердить запись, создать Calendar event
│   │   │   └── send-confirmation-email/  # POST — отправить email подтверждение
│   │   └── auth/                  # OAuth callbacks (будущее расширение)
│   ├── layout.tsx                 # Root layout
│   ├── robots.ts                  # robots.txt
│   └── sitemap.ts                 # sitemap.xml
├── lib/                           # Утилиты и сервисы
│   ├── supabase.ts                # Supabase клиент
│   ├── types.ts                   # TypeScript типы для API и БД
│   ├── validation.ts              # Валидация входных данных
│   ├── telegram.ts                # Telegram Bot API вызовы
│   ├── google-calendar.ts         # Google Calendar API вызовы
│   ├── email.ts                   # SMTP отправка (Nodemailer)
│   ├── email-templates.ts         # HTML шаблоны email
│   ├── notify.ts                  # Оркестрация уведомлений
│   └── utils.ts                   # Хелперы (форматирование, конвертация, etc)
├── components/                    # React компоненты (функциональные)
├── public/                        # Статические файлы (изображения, favicon, etc)
├── supabase/                      # Миграции и конфиг
│   └── migrations/
│       └── 001_initial_schema.sql # Полная схема БД
├── docs/                          # Документация для разработчиков
├── .env.example                   # Шаблон переменных окружения
├── package.json                   # Зависимости и скрипты
├── tsconfig.json                  # TypeScript конфиг
├── next.config.ts                 # Next.js конфиг
└── tailwind.config.ts             # Tailwind CSS конфиг
```

## Переменные окружения

Все переменные объяснены в `.env.example`. Здесь сводка:

### Обязательные (production)

| Переменная | Описание | Пример |
|-----------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase | `https://xxxxxxxxxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичный API ключ Supabase | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Сервисный ключ (только на сервере) | `eyJhbG...` |
| `TELEGRAM_BOT_TOKEN` | Token из BotFather в Telegram | `123456789:ABCDEFghijklmnopqrs...` |
| `TELEGRAM_WEBHOOK_SECRET` | Secret для webhook (любая строка) | `random_secret_string_123` |
| `ADMIN_SECRET_KEY` | Пароль для админ-панели | `strong_secret_here` |
| `NEXT_PUBLIC_APP_URL` | URL приложения (для ссылок в email/Telegram) | `https://your-domain.com` |

### Опционально (для интеграций)

| Переменная | Описание | Обязательно для |
|-----------|---------|-----------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Google Calendar |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Google Calendar |
| `GOOGLE_REDIRECT_URI` | Callback URL | Google Calendar |
| `GOOGLE_REFRESH_TOKEN_RISHON` | Refresh token для Ришон-ле-Цион | Синхронизация Calendar |
| `GOOGLE_REFRESH_TOKEN_ASHDOD` | Refresh token для Ашдода | Синхронизация Calendar |
| `GOOGLE_CALENDAR_ID_RISHON` | ID календаря Ришон-ле-Цион | Синхронизация Calendar |
| `GOOGLE_CALENDAR_ID_ASHDOD` | ID календаря Ашдода | Синхронизация Calendar |
| `SMTP_HOST` | SMTP хост (gmail.com, smtp.sendgrid.net) | Email уведомления |
| `SMTP_PORT` | SMTP порт | Email уведомления |
| `SMTP_USER` | SMTP логин | Email уведомления |
| `SMTP_PASS` | SMTP пароль или API Key | Email уведомления |
| `SMTP_FROM` | From адрес (с именем) | Email уведомления |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics ID | Аналитика |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager ID | Аналитика |
| `GOOGLE_SITE_VERIFICATION` | Метатег для Search Console | SEO |
| `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID` | Google Ads conversion ID | Реклама |

## Жизненный цикл бронирования

```
1. PENDING (статус слота → booked, создана запись в bookings)
   ↓ [Сотрудник нажимает "Подтвердить" в Telegram боте]
2. CONFIRMED (запись подтверждена, создано событие в Google Calendar, отправлен email)
   ↓ [Клиент нажимает "Отменить" в письме или через /cancel?token=...]
3. CANCELLED (статус слота → available, запись отмечена как отменена)
```

## Деплой на Vercel

Детальная инструкция — см. `docs/DEPLOYMENT.md`.

Краткий флоу:

```bash
vercel login
vercel --prod
# В Vercel Dashboard добавить все environment variables
# Обновить TELEGRAM_WEBHOOK_SECRET, GOOGLE_REDIRECT_URI, NEXT_PUBLIC_APP_URL
```

## Настройка интеграций

- **Telegram Bot** → `docs/TELEGRAM_SETUP.md`
- **Google Calendar** → `docs/GOOGLE_CALENDAR_SETUP.md`
- **Email (SMTP)** → `docs/SMTP_SETUP.md`
- **Admin Panel** → `docs/ADMIN_GUIDE.md`

## Архитектура

### Dataflow

```
Frontend (Next.js SSR)
  ↓ (fetch /api/slots, POST /api/bookings)
API Routes (Next.js)
  ↓ (RLS + Supabase SDK)
Database (Supabase PostgreSQL)

При подтверждении в Telegram:
Telegram Bot (webhook) → /api/telegram/webhook
  ↓ (POST /api/internal/confirm-booking)
  ├→ Google Calendar API (создать событие)
  ├→ Nodemailer (отправить email с .ics)
  └→ Supabase (обновить статус booking → CONFIRMED)
```

### Безопасность

- **Frontend**: только публичные endpoints, RLS скрывает чужие данные
- **Backend**: Service Role Key для внутренних операций
- **Admin**: защита через X-Admin-Secret header
- **Telegram**: валидация signature + whitelist chat IDs
- **Google Calendar**: OAuth 2.0 refresh tokens (на сервере)
- **Email**: SMTP credentials (на сервере, в env vars)

## Разработка

### Локальное тестирование API

```bash
# Получить свободные слоты
curl "http://localhost:3000/api/slots?studio_id=rishon&date=2025-06-01"

# Создать запись
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"slot_id":"...", "studio_id":"rishon", "client_first_name":"Анна", ...}'

# Отменить запись
curl -X POST http://localhost:3000/api/bookings/cancel \
  -H "Content-Type: application/json" \
  -d '{"token":"..."}'
```

Полная OpenAPI 3.0 спека — см. `docs/OPENAPI.yaml`.

### Лучшие практики

- Всегда устанавливайте переменные окружения перед запуском dev сервера
- Проверяйте Supabase RLS политики при добавлении новых таблиц
- Добавляйте логирование при интеграции с внешними сервисами (Telegram, Calendar, Email)
- Тестируйте cancel flow — это критический путь
- Используйте Supabase Dashboard для инспекции данных в разработке

## Лицензия

Приватный проект WOVSDH.

## Поддержка

За помощью обратитесь к документации в `docs/` или создайте issue на GitHub.
