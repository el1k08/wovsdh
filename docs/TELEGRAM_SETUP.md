# Telegram Bot — Инструкция по настройке

Данная инструкция описывает создание и настройку Telegram бота для уведомления сотрудников о новых записях с возможностью подтверждения.

## 1. Создание бота через BotFather

### 1.1 Запустить BotFather

Откройте Telegram и найдите [@BotFather](https://t.me/botfather) — официального бота для управления ботами.

Отправьте команду: `/newbot`

### 1.2 Ввод деталей бота

BotFather попросит:

**What should your bot be called?**
```
WOVSDH Nails Studio
```

**Give your bot a username. It must end in `bot` (e.g. TetrisBot or tetris_bot):**
```
wovsdh_nails_bot
```

### 1.3 Получить TOKEN

BotFather вернёт сообщение с TOKEN:

```
Done! Congratulations on your new bot. You will find it at t.me/wovsdh_nails_bot. 
You can now add a description, about section and profile picture for your bot, see /help for a list of commands.

Use this token to access the HTTP API:
123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh

Keep your token secure and store it safely!
```

Сохраните этот TOKEN.

## 2. Добавление TOKEN в переменные окружения

Обновить `.env.local`:

```
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
TELEGRAM_WEBHOOK_SECRET=random_string_or_uuid_123
```

`TELEGRAM_WEBHOOK_SECRET` — любая случайная строка для безопасности вебхука.

## 3. Установка вебхука (локальная разработка)

### 3.1 Через ngrok (для локального тестирования)

Для локального тестирования Telegram вебхука нужен публичный URL (localhost не подходит).

**Вариант A: Использовать ngrok**

1. Установить ngrok: https://ngrok.com/download
2. Запустить:
   ```bash
   ngrok http 3000
   # Output: Forwarding https://abc123def456.ngrok.io -> http://localhost:3000
   ```
3. Скопировать URL: `https://abc123def456.ngrok.io`
4. Установить вебхук:
   ```bash
   curl -X POST "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook" \
     -d "url=https://abc123def456.ngrok.io/api/telegram/webhook" \
     -d "secret_token={TELEGRAM_WEBHOOK_SECRET}"
   ```

**Вариант B: Временно отключить вебхук**

Для локальной разработки без интеграции можно удалить вебхук:

```bash
curl -X POST "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

Тогда тестировать можно через polling (но это не рекомендуется для production).

## 4. Установка вебхука (production на Vercel)

После деплоя на Vercel:

```bash
curl -X POST "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://wovsdh-nails.vercel.app/api/telegram/webhook" \
  -d "secret_token={TELEGRAM_WEBHOOK_SECRET}"
```

Проверить статус:

```bash
curl "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq
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

Если `last_error_date` не `null`, значит есть проблема с вебхуком. Посмотреть ошибку в поле `last_error_message`.

## 5. Добавление сотрудников в whitelist

Бот может получать уведомления только от авторизованных сотрудников. Список хранится в таблице `allowed_users` в Supabase.

### 5.1 Получить Telegram Chat ID

Есть несколько способов:

**Способ A: Через @userinfobot**

1. Найти в Telegram [@userinfobot](https://t.me/userinfobot)
2. Отправить `/start`
3. Бот вернёт ваш ID:
   ```
   Id: 123456789
   Is bot: No
   First name: Имя
   Username: @username
   ```

**Способ B: Через чат с вашим ботом**

1. Найти своего бота (@wovsdh_nails_bot)
2. Отправить любое сообщение
3. Проверить логи сервера или Supabase для извлечения chat_id

### 5.2 Добавить сотрудника в Supabase

В Supabase Dashboard → SQL Editor выполнить:

```sql
INSERT INTO allowed_users (telegram_chat_id, name, is_active)
VALUES 
  (123456789, 'Имя Сотрудника', true),
  (987654321, 'Второй Сотрудник', true);
```

Где:
- `123456789` — chat_id из @userinfobot
- `'Имя Сотрудника'` — имя для логов
- `true` — активный сотрудник

## 6. Команды бота

### 6.1 /start

Отправляет приветственное сообщение новому пользователю.

Ответ (только для авторизованных):
```
Привет! Я уведомляю о новых записях к вам в студию.
Подтвердите запись, нажав кнопку ниже.
```

### 6.2 /help

Показывает список доступных команд (только для авторизованных).

### 6.3 /adduser {chat_id} {Имя}

Добавить нового сотрудника в whitelist.

**Пример:**
```
/adduser 123456789 Анна Иванова
```

**Требования:**
- Доступна только администратору (тому, кто находится в БД с соответствующими правами)
- Актуально в production среде

**В локальной разработке** лучше добавлять через SQL.

### 6.4 /removeuser {chat_id}

Деактивировать сотрудника в whitelist.

**Пример:**
```
/removeuser 123456789
```

**Эффект:**
- Сотрудник больше не будет получать уведомления
- Запись в БД помечается как `is_active = false`, но не удаляется

## 7. Тестирование вебхука локально

### 7.1 Установить ngrok и запустить сервер

```bash
# Terminal 1: Запустить Next.js dev сервер
npm run dev

# Terminal 2: Запустить ngrok
ngrok http 3000
# Скопировать URL: https://abc123def456.ngrok.io
```

### 7.2 Установить вебхук на ngrok URL

```bash
curl -X POST "https://api.telegram.org/bot{YOUR_TOKEN}/setWebhook" \
  -d "url=https://abc123def456.ngrok.io/api/telegram/webhook" \
  -d "secret_token={TELEGRAM_WEBHOOK_SECRET}"
```

### 7.3 Создать запись через сайт

1. Открыть http://localhost:3000
2. Заполнить форму бронирования
3. Нажать "Забронировать"

### 7.4 Проверить что сообщение пришло в Telegram

Вы должны получить сообщение в Telegram:

```
📅 Новая запись!

Клиент: Анна Иванова
Телефон: +972501234567
Email: anna@example.com
Студия: WOVSDH Nails Rishon
Дата и время: 1 июня 2025, 08:00 - 09:00

[Подтвердить] [Отменить]
```

### 7.5 Проверить что статус обновился

При нажатии кнопки "Подтвердить":
- Запись в БД обновляется с `status = CONFIRMED`
- Клиент получает email с .ics файлом
- Событие создаётся в Google Calendar

## 8. Webhook обработка

### 8.1 Сигнатура вебхука

Telegram отправляет X-Telegram-Bot-Api-Secret-Hash header для безопасности.

Приложение проверяет его в `/api/telegram/webhook`:

```typescript
const secret = process.env.TELEGRAM_WEBHOOK_SECRET!;
const hash = req.headers['x-telegram-bot-api-secret-hash'] as string;

// Валидация подписи
if (!validateTelegramSignature(hash, secret, body)) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### 8.2 Обработка callback_query

Когда сотрудник нажимает кнопку "Подтвердить" или "Отменить", приходит `callback_query`:

```json
{
  "update_id": 123456789,
  "callback_query": {
    "id": "callback_id",
    "from": { "id": 123456789, "username": "staff_member" },
    "message": { "message_id": 999, "chat": { "id": 123456789 } },
    "data": "confirm:booking-uuid"
  }
}
```

Приложение парсит `data`, находит бронирование и:
1. Обновляет статус → CONFIRMED
2. Создаёт событие в Google Calendar
3. Отправляет email подтверждение
4. Отвечает в Telegram: "✅ Запись подтверждена"

## 9. Troubleshooting

### Вебхук не работает

**Проверить статус:**

```bash
curl "https://api.telegram.org/bot{TOKEN}/getWebhookInfo" | jq
```

Если `last_error_date` не `null`:

**Частые проблемы:**

1. **Неверный URL** → проверить что URL доступен (открыть в браузере)
2. **Неверный secret_token** → переустановить вебхук с правильным секретом
3. **Приложение не отвечает** → проверить логи сервера
4. **RLS политика блокирует** → проверить Supabase RLS для allowed_users

### Сотрудник не получает уведомления

**Проверить:**

1. Добавлен ли в `allowed_users` (Supabase → Browser → allowed_users)
2. `is_active = true` ли?
3. Правильный ли chat_id?

```sql
SELECT * FROM allowed_users WHERE is_active = true;
```

Если результатов нет → сотрудник не добавлен.

### Ошибка "Invalid signature"

Вероятно, `TELEGRAM_WEBHOOK_SECRET` не совпадает между:
- Переменной окружения `.env.local`
- Значением установленным в setWebhook команде

Переустановить вебхук:

```bash
# Удалить старый
curl -X POST "https://api.telegram.org/bot{TOKEN}/deleteWebhook"

# Установить новый с правильным secret
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -d "url=https://your-domain.com/api/telegram/webhook" \
  -d "secret_token={YOUR_WEBHOOK_SECRET}"
```

## 10. Безопасность

### 10.1 Защита от несанкционированного доступа

- Telegram вебхук проверяет X-Telegram-Bot-Api-Secret-Hash (обязательно)
- Только авторизованные в `allowed_users` получают уведомления
- Token хранится в `.env.local`, не коммитится в репозиторий

### 10.2 Rate limiting

Telegram автоматически ограничивает частоту обновлений (max ~30 обновлений в секунду).

Приложение должно обрабатывать вебхук как можно быстрее (< 1 сек), иначе Telegram будет повторно отправлять.

## 11. Полезные ссылки

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Telegram Webhooks Guide](https://core.telegram.org/bots/webhooks)
- [BotFather Commands](https://core.telegram.org/bots/botfather)
- [Telegram Security](https://core.telegram.org/bots/webhooks#secret-tokens)
