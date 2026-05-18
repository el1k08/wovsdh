# Google Calendar API — Инструкция по настройке

Данная инструкция описывает интеграцию с Google Calendar API для автоматического создания и удаления событий при подтверждении/отмене записей.

## 1. Создание проекта в Google Cloud Console

### 1.1 Открыть Google Cloud Console

Перейти на [console.cloud.google.com](https://console.cloud.google.com)

**Важно:** используйте Google аккаунт, который будет управлять студийными календарями.

### 1.2 Создание нового проекта

1. В верхнем левом углу нажать выпадающее меню проектов
2. Нажать **NEW PROJECT**
3. **Project name:** `WOVSDH Nails`
4. Нажать **CREATE**

Ождать 1-2 минуты, пока проект инициализируется.

### 1.3 Выбрать проект

После создания, убедитесь что новый проект выбран в меню проектов.

## 2. Включение Google Calendar API

### 2.1 Перейти в APIs & Services

Left sidebar → **APIs & Services** → **Library**

### 2.2 Поиск Google Calendar API

В поле поиска ввести: `Google Calendar API`

Нажать на результат **Google Calendar API**.

### 2.3 Включить API

Нажать кнопку **ENABLE**.

Ождать пока API включится (несколько секунд).

## 3. Создание OAuth 2.0 Credentials

### 3.1 Перейти в Credentials

Left sidebar → **APIs & Services** → **Credentials**

### 3.2 Создать OAuth consent screen

1. Нажать **CONFIGURE CONSENT SCREEN**
2. **User Type:** выбрать **Internal** (для собственного проекта)
3. Нажать **CREATE**

Заполнить форму:

**OAuth consent screen:**
- App name: `WOVSDH Nails`
- User support email: ваша почта
- Developer contact: ваша почта

Нажать **SAVE AND CONTINUE**

**Scopes:**
- Нажать **ADD OR REMOVE SCOPES**
- Поиск: `calendar`
- Выбрать `Google Calendar API`
- Выбрать scope: `https://www.googleapis.com/auth/calendar`
- Нажать **UPDATE** → **SAVE AND CONTINUE**

Пропустить остальные экраны (нажимать Next) → **SAVE AND FINISH**

### 3.3 Создать OAuth 2.0 Client ID

1. В **Credentials** нажать **CREATE CREDENTIALS** → **OAuth client ID**
2. **Application type:** выбрать **Web application**
3. **Name:** `WOVSDH Nails Backend`

**Authorized redirect URIs:**
- Добавить: `http://localhost:3000/api/auth/google/callback` (для локальной разработки)
- Добавить: `https://your-domain.com/api/auth/google/callback` (для production)

Нажать **CREATE**

### 3.4 Сохранить Client ID и Secret

Появится диалог:

```
Client ID: xxxxx.apps.googleusercontent.com
Client Secret: GOCSPX-xxxxx
```

Сохраните оба значения.

Закройте диалог. Credentials будут видны в таблице **OAuth 2.0 Client IDs**.

## 4. Получение Refresh Tokens

Для каждой студии нужен отдельный refresh token, чтобы приложение могло создавать события от имени каждого календаря.

### 4.1 Способ A: Через Google OAuth Playground (рекомендуется)

1. Перейти на [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. В верхнем правом углу нажать иконку параметров (шестерёнка)
3. Включить **Use your own OAuth credentials**
4. Ввести:
   - **OAuth Client ID:** из шага 3.4
   - **OAuth Client Secret:** из шага 3.4

Нажать **Close**

### 4.2 Авторизация

1. На левой панели в разделе **Google Calendar API v3** найти:
   ```
   https://www.googleapis.com/auth/calendar
   ```
2. Нажать **AUTHORIZE APIS**
3. Выбрать Google аккаунт
4. Согласиться с разрешениями

### 4.3 Получить refresh token

1. В разделе **Step 2: Exchange authorization code for tokens** нажать **Exchange authorization code for tokens**
2. Скопировать значение **Refresh token** (длинная строка начинающаяся с `1//`)

Это refresh token для первого аккаунта (студии).

### 4.4 Получить второй refresh token

Если нужен отдельный refresh token для второй студии:

1. Отключиться от текущего аккаунта Google
2. Авторизоваться с другим аккаунтом Google
3. Повторить шаги 4.2-4.3

## 5. Создание Google Calendar для каждой студии

Для каждой студии нужен отдельный календарь.

### 5.1 Открыть Google Calendar

Перейти на [calendar.google.com](https://calendar.google.com) с аккаунтом, для которого вы получали refresh token.

### 5.2 Создать календарь для Ришон-ле-Цион

1. В левом меню нажать **+** рядом с "Other calendars"
2. **Create new calendar**
3. **Calendar name:** `WOVSDH Rishon LeZion`
4. **Description:** (опционально) `Booking calendar for Rishon LeZion studio`
5. **Time zone:** `Asia/Jerusalem`
6. Нажать **CREATE CALENDAR**

### 5.3 Получить Calendar ID

1. В левом меню найти созданный календарь
2. Нажать на три точки рядом с названием
3. **Settings and sharing**
4. В разделе **Integrate calendar** скопировать **Calendar ID** (выглядит как `your-calendar-id@group.calendar.google.com`)

Сохраните это значение.

### 5.4 Создать календарь для Ашдода

Повторить шаги 5.2-5.3 с названием `WOVSDH Ashdod`.

## 6. Добавление Credentials в приложение

Обновить `.env.local`:

```
# Google Calendar API
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Refresh tokens (для каждой студии отдельный)
GOOGLE_REFRESH_TOKEN_RISHON=1//0xxx (первый refresh token)
GOOGLE_REFRESH_TOKEN_ASHDOD=1//0xxx (второй refresh token, если есть)

# Calendar IDs
GOOGLE_CALENDAR_ID_RISHON=xxxxx@group.calendar.google.com
GOOGLE_CALENDAR_ID_ASHDOD=xxxxx@group.calendar.google.com
```

**ВАЖНО:**
- Если для обеих студий используется один аккаунт Google, оба refresh token будут одинаковыми, это нормально
- `GOOGLE_REDIRECT_URI` должен совпадать с тем, что вы указали в Google Cloud Console

## 7. Тестирование интеграции

### 7.1 Локальное тестирование

Убедитесь что все переменные окружения установлены:

```bash
# Проверить что переменные загружены
grep GOOGLE_ .env.local
```

### 7.2 Создать тестовую запись

1. Открыть http://localhost:3000
2. Заполнить форму:
   - Студия: Rishon LeZion
   - Дата: любая доступная
   - Время: свободное
   - Контакты: тестовые данные
3. Нажать **Забронировать**

### 7.3 Подтвердить в Telegram

Если Telegram интеграция настроена:
1. Получить сообщение в Telegram боте
2. Нажать **Подтвердить**

Если не настроена, пропустить этот шаг.

### 7.4 Проверить что событие создалось в Calendar

1. Открыть [calendar.google.com](https://calendar.google.com)
2. Выбрать календарь WOVSDH Rishon LeZion
3. Найти событие с именем клиента и временем записи

Событие должно содержать:

```
Название: Анна Иванова
Время: (время записи)
Описание: 
  Телефон: +972501234567
  Email: anna@example.com
```

### 7.5 Проверить .ics файл

Каждая запись должна иметь .ics файл (для добавления в календарь):

```bash
curl "http://localhost:3000/api/calendar/ics?booking_id={BOOKING_ID}"
```

Ожидаемый ответ: .ics файл с содержимым события.

## 8. Настройка для Production (Vercel)

После деплоя на Vercel обновить переменные:

1. **GOOGLE_REDIRECT_URI** → `https://your-domain.com/api/auth/google/callback`
2. Добавить этот URL в Google Cloud Console (APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs)

## 9. Отмена записи

Когда клиент отменяет запись через `/api/bookings/cancel`:

1. Приложение удаляет событие из Google Calendar
2. Статус слота возвращается в `available`
3. Клиент получает email об отмене

## 10. Troubleshooting

### Google Calendar API не работает

**Проверить:**

1. API включена ли? (Google Cloud Console → APIs & Services → Enabled APIs)
2. Все ли переменные окружения установлены?
3. Refresh token не истёк ли? (обновляется автоматически при использовании, но можно переполучить)

### Ошибка: "Invalid Refresh Token"

```
Error: invalid_grant
```

Это значит, что refresh token истёк или невалиден. Получить новый:

1. Перейти на [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Повторить шаги из раздела 4

### События не создаются в Calendar

**Проверить логи:**

1. Если локально: посмотреть вывод `npm run dev`
2. Если на Vercel: Function Logs → поиск по endpoint `/api/internal/confirm-booking`

**Частые ошибки:**

1. **Calendar ID неверный** → скопировать заново из Google Calendar Settings
2. **Недостаточные permissions** → переавторизовать через OAuth Playground
3. **Неверный refresh token** → получить новый

### Невозможно получить refresh token через OAuth Playground

**Решение:**

1. В OAuth Playground нажать **Request new authorization code**
2. Убедитесь что в параметрах выбран `https://www.googleapis.com/auth/calendar` scope
3. Авторизоваться заново
4. Получить новый refresh token

### Лишние календари в Google Account

Если созданы тестовые календари, можно удалить:

1. [calendar.google.com](https://calendar.google.com)
2. Найти календарь в левом меню
3. Нажать на три точки → **Delete calendar**

## 11. Дополнительные возможности

### Синхронизация между приложением и Google Calendar

- При создании записи (POST /api/bookings) статус `PENDING`, событие не создаётся
- При подтверждении (POST /api/internal/confirm-booking) событие создаётся в Calendar
- При отмене (POST /api/bookings/cancel) событие удаляется из Calendar

### Обновление события

Приложение не обновляет события, только создаёт и удаляет. Если нужно изменить время записи, приложение должно удалить старое событие и создать новое.

### Синхронизация из Google Calendar

Приложение не читает события из Google Calendar (однонаправленная синхронизация). Слоты управляются только через admin панель приложения.

## 12. Полезные ссылки

- [Google Calendar API Docs](https://developers.google.com/calendar/api)
- [Google Cloud Console](https://console.cloud.google.com)
- [OAuth Playground](https://developers.google.com/oauthplayground)
- [Google Calendar Settings](https://calendar.google.com/calendar/r/settings)
- [Google Cloud - OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes#calendar)
