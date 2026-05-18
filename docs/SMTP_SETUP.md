# Email SMTP — Инструкция по настройке

Данная инструкция описывает настройку отправки email с подтверждением записи и уведомлением об отмене, используя SMTP через Nodemailer.

## 1. Обзор

Приложение использует **Nodemailer** для отправки email через SMTP. Поддерживаются:

- **Gmail** с App Password
- **Sendgrid** с API Key
- Любой другой SMTP сервер (по необходимости)

## Вариант A: Gmail + App Password (простой и рекомендуемый)

### A.1 Включение 2-Step Verification

Перейти на [myaccount.google.com/security](https://myaccount.google.com/security)

Слева найти **2-Step Verification**.

Если не включена:
1. Нажать **Enable 2-Step Verification**
2. Выбрать способ получения кода (SMS или authenticator app)
3. Завершить процесс

### A.2 Создание App Password

1. Вернуться на [myaccount.google.com/security](https://myaccount.google.com/security)
2. Найти **App passwords** (видна только если 2FA включена)
3. **Select the app:** Gmail
4. **Select the device:** Windows PC / Mac / Linux
5. Нажать **Generate**

Google выдаст пароль из 16 символов (4 группы по 4):

```
xxxx xxxx xxxx xxxx
```

**ВАЖНО:** скопировать этот пароль сейчас, он больше не будет виден.

### A.3 Добавление в переменные окружения

Обновить `.env.local`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # App Password (можно без пробелов)
SMTP_FROM="WOVSDH Nails <your@gmail.com>"
```

Где:
- `your@gmail.com` — ваша Gmail почта
- `xxxx xxxx xxxx xxxx` — 16-значный App Password
- `SMTP_FROM` — имя отправителя в письмах

### A.4 Тестирование

```bash
npm run dev
```

Создать тестовую запись и проверить письмо в inbox'е.

**Если письмо не пришло:**

1. Проверить SPAM папку
2. Посмотреть логи сервера (ошибки SMTP)
3. Убедиться что App Password скопирован без ошибок

## Вариант B: Sendgrid (надёжный и масштабируемый)

### B.1 Создание аккаунта Sendgrid

1. Перейти на [sendgrid.com](https://sendgrid.com)
2. **Sign Up**
3. Заполнить форму (email, пароль, компания, цель)
4. Подтвердить email (письмо должно прийти в inbox)
5. Завершить регистрацию

### B.2 Создание API Key

1. В Sendgrid Dashboard слева найти **Settings** → **API Keys**
2. Нажать **Create API Key**
3. **API Key Name:** `WOVSDH Nails SMTP`
4. **Permissions:** `Full Access` или `Mail Send` (хотя бы Mail Send)
5. Нажать **Create & Save**

Sendgrid выдаст API Key:

```
SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**ВАЖНО:** скопировать сейчас, он не будет показан снова.

### B.3 Добавление в переменные окружения

Обновить `.env.local`:

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM="WOVSDH Nails <noreply@wovsdh-nails.com>"
```

Где:
- `SMTP_USER` — всегда `apikey` (буквально)
- `SMTP_PASS` — SG.xxx API Key
- `SMTP_FROM` — любой email адрес (Sendgrid проверяет отправителя)

### B.4 Настройка Sender Address

Чтобы письма приходили от кастомного адреса (например, `noreply@wovsdh-nails.com`):

1. В Sendgrid Dashboard найти **Settings** → **Sender Authentication**
2. **Single Sender Verification**
3. Нажать **Create New Sender**
4. Заполнить:
   - **From Email Address:** `noreply@wovsdh-nails.com`
   - **From Name:** `WOVSDH Nails`
   - **Reply To:** `support@wovsdh-nails.com` (опционально)
5. Нажать **Create**

Sendgrid отправит письмо на этот адрес для подтверждения. Нажать ссылку в письме.

### B.5 Тестирование

```bash
npm run dev
```

Создать тестовую запись и проверить письмо.

**Если письмо не пришло:**

1. Проверить SPAM (возможно, из-за отсутствия verify для отправителя)
2. Посмотреть логи сервера
3. Проверить в Sendgrid Dashboard → **Email Activity** → искать по адресу получателя

## 2. Содержимое писем

### 2.1 Email подтверждения

Отправляется сразу после создания записи (при подтверждении в Telegram боте).

**Предмет:** `Подтверждение записи в WOVSDH Nails`

**Содержимое:**

```
Уважаемая Анна!

Спасибо за вашу запись в нашу студию.

Студия: WOVSDH Nails Rishon
Дата и время: 1 июня 2025, 08:00 - 09:00

К письму приложен календарный файл (.ics). Вы можете добавить событие в свой календарь.

Или добавить в Google Calendar: [ссылка]

Если вам нужно отменить запись, нажмите здесь: [ссылка отмены с токеном]

Телефон студии: +972-XX-XXX-XXXX
```

**Вложение:** .ics файл с событием

### 2.2 Email об отмене

Отправляется при отмене записи через `/api/bookings/cancel`.

**Предмет:** `Отмена записи в WOVSDH Nails`

**Содержимое:**

```
Уважаемая Анна!

Ваша запись была отменена.

Студия: WOVSDH Nails Rishon
Дата и время: 1 июня 2025, 08:00 - 09:00

Если это была ошибка, свяжитесь со студией.
```

## 3. Шаблоны и кастомизация

### 3.1 Где находятся шаблоны

Шаблоны email хранятся в `/lib/email-templates.ts`.

### 3.2 Изменение шаблона

Открыть `/lib/email-templates.ts` и отредактировать HTML.

**Пример изменения темы письма подтверждения:**

```typescript
// Найти функцию getConfirmationEmailTemplate
const subject = `✅ Запись подтверждена в ${studioName}`;
```

После сохранения изменения вступят в силу при следующей отправке письма.

### 3.3 Переменные в шаблоне

Доступные переменные:

```
${clientName}         — имя клиента
${studioName}         — имя студии
${startTime}          — время начала (форматированное)
${endTime}            — время окончания (форматированное)
${cancelUrl}          — ссылка для отмены
${googleCalendarUrl}  — ссылка на Google Calendar
```

## 4. Тестирование SMTP

### 4.1 Ручное тестирование

Создать тестовую запись и проверить что письмо пришло.

Если письмо не пришло, проверить логи:

```bash
# Посмотреть логи Next.js
npm run dev
# Когда создаёте запись, в консоли должны быть логи отправки email
```

### 4.2 Тестирование через API

```bash
# Требует X-Internal-Secret header (ADMIN_SECRET_KEY)
curl -X POST http://localhost:3000/api/internal/send-confirmation-email \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: {ADMIN_SECRET_KEY}" \
  -d '{"booking_id": "BOOKING_UUID"}'
```

Ожидаемый ответ:

```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

Если ошибка:

```json
{
  "error": {
    "code": "SMTP_ERROR",
    "message": "SMTP ошибка с описанием"
  }
}
```

### 4.3 Общие проблемы

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `Invalid login` | Неверный пароль или App Password | Проверить что скопирован без ошибок |
| `EAUTH` | Gmail блокирует вход | Включить 2FA и использовать App Password |
| `ECONNREFUSED` | SMTP сервер недоступен | Проверить SMTP_HOST и SMTP_PORT |
| `ETIMEOUT` | Соединение истекло | Проверить интернет, firewall |
| `From email not allowed` | Sendgrid: sender не verified | Добавить и подтвердить sender в Sendgrid |

## 5. Email Logs

Все отправленные письма логируются в таблицу `email_logs` в Supabase.

### 5.1 Проверить логи

Supabase Dashboard → Browser → email_logs

Колонки:

```
id              — UUID логи
booking_id      — к какой записи относится письмо
email_type      — 'confirmation' или 'cancellation'
recipient_email — на какой email отправлено
sent_at         — когда отправлено
error           — null если успешно, иначе ошибка SMTP
```

### 5.2 Пример SQL для поиска ошибок

```sql
SELECT * FROM email_logs WHERE error IS NOT NULL;
```

## 6. Rate Limiting

Gmail и Sendgrid имеют лимиты на количество писем:

**Gmail:**
- Free tier: ~100 писем в день
- Если нужно больше, перейти на платный G Workspace

**Sendgrid:**
- Free tier: 100 писем в день, вечно (без card)
- Платный: 100+ писем в день

Для production рекомендуется использовать Sendgrid с платным тарифом.

## 7. Настройка для Production

### 7.1 На Vercel

1. Добавить все SMTP переменные в Vercel Dashboard → Environment Variables
2. Убедиться что они установлены для Production environment

### 7.2 Проверка на Production

```bash
# После деплоя на Vercel
curl -X POST https://your-domain.com/api/internal/send-confirmation-email \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: {ADMIN_SECRET_KEY}" \
  -d '{"booking_id": "..."}'
```

### 7.3 Мониторинг

Регулярно проверять:

1. Email Logs в Supabase на наличие ошибок
2. Функционирование подтверждения записей (должны приходить письма)

## 8. Дополнительная настройка

### 8.1 Кастомный SMTP сервер

Если используется свой SMTP сервер (не Gmail или Sendgrid):

```
SMTP_HOST=mail.example.com
SMTP_PORT=587           # или 465 для SSL, или 25 для незащищённого
SMTP_USER=username
SMTP_PASS=password
SMTP_FROM="Name <email@example.com>"
```

### 8.2 SSL/TLS

Стандартный порт для TLS (STARTTLS) — 587.
Для SSL (implicit) — 465.

Приложение использует TLS по умолчанию.

### 8.3 Batching писем

Если нужно отправлять письма батчами (например, раз в час), можно добавить background job. Текущая реализация отправляет синхронно.

## 9. Troubleshooting Advanced

### Письма идут в SPAM

**Возможные причины:**

1. **SPF запись не настроена** — письма от неверифицированного адреса
2. **DKIM подпись отсутствует** — добавить DKIM в Sendgrid settings
3. **Высокий volume** — новый отправитель с большим объёмом писем

**Решение:**

1. Настроить SPF запись в DNS:
   ```
   v=spf1 include:sendgrid.net ~all
   ```
2. Добавить DKIM в Sendgrid → Sender Authentication
3. Начать с малого объёма

### Ошибка "Too many login attempts"

Gmail иногда блокирует слишком много попыток входа с App Password.

**Решение:**

1. Перейти на [myaccount.google.com/security](https://myaccount.google.com/security)
2. **Security incident review** → **Check recent activity**
3. Нажать **Yes, it was me**
4. Дождаться 5-10 минут и повторить попытку

## 10. Полезные ссылки

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail App Passwords](https://myaccount.google.com/apppasswords)
- [Sendgrid SMTP Integration](https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api)
- [SPF and DKIM Setup](https://sendgrid.com/en-us/resource/why-email-authentication-matters)
