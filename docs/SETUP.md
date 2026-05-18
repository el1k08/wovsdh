# Локальная разработка — Инструкция по настройке

Данная инструкция описывает пошаговую настройку проекта на локальной машине для разработки и тестирования.

## 1. Предварительные требования

Убедитесь, что у вас установлены:

- **Node.js** версии 18.x или выше ([nodejs.org](https://nodejs.org))
- **npm** версии 9.x или выше (идёт с Node.js)
- **Git** для клонирования репозитория

Проверьте версии:

```bash
node --version
npm --version
git --version
```

## 2. Клонирование репозитория

```bash
git clone <repository-url> wovsdh_nails
cd wovsdh_nails
```

## 3. Установка зависимостей

```bash
npm install
```

Это установит все зависимости, указанные в `package.json`:

- Next.js 16.x
- React 19.x
- Tailwind CSS 4.x
- Supabase SDK
- Nodemailer
- и другие

## 4. Создание файла переменных окружения

Скопируйте шаблон и заполните реальные значения:

```bash
cp .env.example .env.local
```

### 4.1 Обязательные переменные для локальной разработки

Откройте `.env.local` и заполните следующие значения:

#### Supabase

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Где найти эти значения:

1. Перейти на [supabase.com/dashboard](https://supabase.com/dashboard)
2. Выбрать свой проект
3. Settings → API → URL и ключи скопировать

#### Telegram Bot

```
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
TELEGRAM_WEBHOOK_SECRET=random_secret_string_123
```

Как получить TOKEN:

1. Найти @BotFather в Telegram
2. Команда `/newbot`
3. Ввести имя бота и @username
4. Скопировать выданный TOKEN

`TELEGRAM_WEBHOOK_SECRET` — любая случайная строка, можно использовать UUID.

#### Admin Secret

```
ADMIN_SECRET_KEY=your-super-secret-password-123
```

Это будет пароль для доступа к админ-панели на `/admin`.

#### App URL

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Для локальной разработки оставить как есть.

### 4.2 Опциональные переменные

Для полной функциональности нужны Google Calendar и Email интеграции, но они опциональны для начальной разработки. Если хотите их настроить, см.:

- Google Calendar — `docs/GOOGLE_CALENDAR_SETUP.md`
- Email — `docs/SMTP_SETUP.md`

## 5. Инициализация базы данных Supabase

### 5.1 Создание проекта Supabase

1. Перейти на [supabase.com](https://supabase.com)
2. Нажать "Start your project"
3. Выбрать организацию/создать новую
4. Заполнить детали проекта:
   - Project name: `wovsdh_nails_dev`
   - Database password: сохраните, понадобится
   - Region: выбрать близкий к вам регион (например, Europe)
5. Нажать "Create new project"

Дождаться завершения инициализации (может занять 2-3 минуты).

### 5.2 Выполнение миграции БД

После создания проекта:

1. В Supabase Dashboard перейти в **SQL Editor**
2. Нажать **New Query**
3. Открыть файл `/supabase/migrations/001_initial_schema.sql` в редакторе
4. Скопировать всё содержимое
5. Вставить в SQL Editor на Supabase
6. Нажать **Run**

Миграция создаст все необходимые таблицы:

- `studios` — студии (Ришон-ле-Цион, Ашдод)
- `slots` — временные окна записи
- `bookings` — записи клиентов
- `allowed_users` — список сотрудников (для Telegram)
- `email_logs` — логи отправленных письма

### 5.3 Добавление тестовых данных

Для локального тестирования добавьте студии и слоты. В SQL Editor Supabase выполните:

```sql
-- Добавить две студии
INSERT INTO studios (id, name, city, timezone) VALUES
  ('rishon', 'WOVSDH Nails Rishon', 'Rishon LeZion', 'Asia/Jerusalem'),
  ('ashdod', 'WOVSDH Nails Ashdod', 'Ashdod', 'Asia/Jerusalem');

-- Добавить пример слотов на 1 июня 2025 (Rishon)
INSERT INTO slots (studio_id, start_at, end_at, status) VALUES
  ('rishon', '2025-06-01 08:00:00+00', '2025-06-01 09:00:00+00', 'available'),
  ('rishon', '2025-06-01 09:00:00+00', '2025-06-01 10:00:00+00', 'available'),
  ('rishon', '2025-06-01 10:00:00+00', '2025-06-01 11:00:00+00', 'available'),
  ('rishon', '2025-06-01 11:00:00+00', '2025-06-01 12:00:00+00', 'available'),
  ('rishon', '2025-06-01 14:00:00+00', '2025-06-01 15:00:00+00', 'available'),
  ('rishon', '2025-06-01 15:00:00+00', '2025-06-01 16:00:00+00', 'available');

-- Добавить пример слотов на 1 июня 2025 (Ashdod)
INSERT INTO slots (studio_id, start_at, end_at, status) VALUES
  ('ashdod', '2025-06-01 09:00:00+00', '2025-06-01 10:00:00+00', 'available'),
  ('ashdod', '2025-06-01 10:00:00+00', '2025-06-01 11:00:00+00', 'available'),
  ('ashdod', '2025-06-01 11:00:00+00', '2025-06-01 12:00:00+00', 'available'),
  ('ashdod', '2025-06-01 13:00:00+00', '2025-06-01 14:00:00+00', 'available'),
  ('ashdod', '2025-06-01 14:00:00+00', '2025-06-01 15:00:00+00', 'available');
```

Проверить результат в таблице **Browser** → **slots**.

## 6. Запуск локального сервера разработки

```bash
npm run dev
```

Вывод:

```
  ▲ Next.js 16.2.6
  - Local:        http://localhost:3000
  - Environments: .env.local

✓ Ready in 2.1s
```

Откройте в браузере:

- **Лендинг:** http://localhost:3000
- **Админ-панель:** http://localhost:3000/admin (введите `ADMIN_SECRET_KEY`)
- **Отмена записи:** http://localhost:3000/cancel?token=... (после создания записи)

## 7. Тестирование API локально

### 7.1 Получить свободные слоты

```bash
curl "http://localhost:3000/api/slots?studio_id=rishon&date=2025-06-01"
```

Ожидаемый ответ:

```json
{
  "slots": [
    {
      "id": "uuid-here",
      "studio_id": "rishon",
      "start_at": "2025-06-01T08:00:00+03:00",
      "end_at": "2025-06-01T09:00:00+03:00",
      "status": "available"
    },
    ...
  ]
}
```

### 7.2 Создать запись

Сначала получить UUID слота из предыдущего ответа, затем:

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "slot_id": "SLOT_UUID_FROM_ABOVE",
    "studio_id": "rishon",
    "client_first_name": "Анна",
    "client_last_name": "Иванова",
    "client_phone": "+972501234567",
    "client_email": "anna@example.com"
  }'
```

Ожидаемый ответ (201 Created):

```json
{
  "booking": {
    "id": "booking-uuid",
    "slot_id": "slot-uuid",
    "studio_id": "rishon",
    "status": "PENDING",
    "start_at": "2025-06-01T08:00:00+03:00",
    "end_at": "2025-06-01T09:00:00+03:00",
    "created_at": "2025-05-18T12:34:56Z"
  }
}
```

### 7.3 Отменить запись

```bash
curl -X POST http://localhost:3000/api/bookings/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "token": "CANCELLATION_TOKEN_FROM_EMAIL"
  }'
```

Ожидаемый ответ (200 OK):

```json
{
  "message": "Booking cancelled successfully",
  "booking": {
    "id": "booking-uuid",
    "status": "CANCELLED",
    "cancelled_at": "2025-05-18T12:34:56Z"
  }
}
```

## 8. Структура проекта и где смотреть

- **API endpoints** → `/app/api/`
- **Компоненты UI** → `/components/`
- **Типы и валидация** → `/lib/types.ts`, `/lib/validation.ts`
- **Интеграции** → `/lib/telegram.ts`, `/lib/google-calendar.ts`, `/lib/email.ts`
- **Стили** → `/tailwind.config.ts`, отдельные CSS в компонентах

## 9. Полезные команды

```bash
# Запустить dev сервер
npm run dev

# Собрать для production
npm build

# Запустить production build локально
npm start

# Проверить линтинг
npm run lint
```

## 10. Debugging

### 10.1 Проверить переменные окружения

Убедитесь, что все переменные установлены:

```bash
env | grep NEXT_PUBLIC_
env | grep SUPABASE_
env | grep TELEGRAM_
```

### 10.2 Проверить подключение к Supabase

В консоли браузера (F12 → Console) выполнить:

```javascript
// Проверить что Supabase инициализирован
console.log(window)
```

### 10.3 Посмотреть логи сервера

При запуске `npm run dev` вывод содержит логи Next.js. При ошибке будет видна полная stack trace.

### 10.4 Проверить RLS политики

Если получаете ошибку "permission denied", значит RLS политика блокирует запрос. Проверить в Supabase Dashboard → Authentication → Policies.

## 11. Следующие шаги

После успешной локальной разработки:

1. Добавить интеграции:
   - Telegram Bot (см. `docs/TELEGRAM_SETUP.md`)
   - Google Calendar (см. `docs/GOOGLE_CALENDAR_SETUP.md`)
   - Email (см. `docs/SMTP_SETUP.md`)

2. Протестировать полный флоу:
   - Создать запись через форму на сайте
   - Проверить что Telegram бот получил уведомление
   - Подтвердить запись в боте
   - Проверить что Calendar событие создалось
   - Проверить что email отправлен

3. Подготовиться к deплою на Vercel (см. `docs/DEPLOYMENT.md`)

## Поддержка

Если возникли проблемы:

- Проверить что все переменные окружения установлены
- Убедиться что Node.js версии 18+
- Проверить логи сервера и браузера
- Запустить `npm install` заново (могут быть нарушены зависимости)
