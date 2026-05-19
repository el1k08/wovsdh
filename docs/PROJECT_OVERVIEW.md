# Обзор проекта WOVSDH Nails

**Дата обновления:** май 2026  
**Язык:** русский  
**Аудитория:** разработчики, DevOps, интеграторы

---

## Содержание

1. [Резюме проекта](#резюме-проекта)
2. [Технологический стек](#технологический-стек)
3. [Архитектура системы](#архитектура-системы)
4. [Страницы и маршруты](#страницы-и-маршруты)
5. [Компоненты посадочной страницы](#компоненты-посадочной-страницы)
6. [Виджет бронирования](#виджет-бронирования)
7. [Сквозной поток бронирования](#сквозной-поток-бронирования)
8. [Панель администратора](#панель-администратора)
9. [Страница отмены бронирования](#страница-отмены-бронирования)
10. [API маршруты](#api-маршруты)
11. [Схема базы данных](#схема-базы-данных)
12. [Интеграции](#интеграции)
13. [SEO и аналитика](#seo-и-аналитика)
14. [Переменные окружения](#переменные-окружения)
15. [Модель безопасности](#модель-безопасности)
16. [Структура файлов](#структура-файлов)
17. [Указатель существующих документов](#указатель-существующих-документов)
18. [Ключевые артефакты и операции](#ключевые-артефакты-и-операции)

---

## Резюме проекта

WOVSDH Nails — это полнофункциональная система онлайн-бронирования для сети салонов ногтевого сервиса, обслуживающей русскоговорящих клиентов в Израиле. Система объединяет две студии: Ришон-ле-Цион и Ашдод.

### Основные цели

- **24/7 онлайн-бронирование** без телефонных звонков
- **Мгновенные уведомления сотрудников** через Telegram с возможностью подтверждения одним нажатием кнопки
- **Автоматическое создание событий** в Google Calendar каждой студии
- **Электронные подтверждения** с .ics вложением и ссылкой отмены
- **Управление слотами** — создание, блокирование, отслеживание из админ-панели
- **Защита от двойного бронирования** на уровне базы данных (частичный уникальный индекс)

### Бизнес-модель

- Два независимых физических салона в разных городах, каждый с собственным календарём Google
- Клиенты выбирают студию → выбирают дату/время → вводят контакты → получают подтверждение
- Персонал подтверждает через Telegram в реальном времени
- Клиенты могут отменить через ссылку в письме подтверждения

### Хостинг и развёртывание

- **Vercel** — бессерверное, автодеплой из ветки `main`
- **Supabase** — управляемый PostgreSQL с RLS и всеми учётными данными в переменных окружения

---

## Технологический стек

### Frontend

| Инструмент | Версия | Назначение |
|-----------|--------|-----------|
| Next.js | 16 | App Router, серверные компоненты, API маршруты |
| React | 19 | Компоненты, хуки состояния |
| TypeScript | 5 | Типизация всего кода |
| Tailwind CSS | 4 | Утилитарные стили, адаптивный дизайн |
| Lucide React | — | Иконки (MapPin, Clock, Instagram, WhatsApp и т. д.) |

### Шрифты

- **Inter** (тело текста): Google Fonts, подмножества Latin + Cyrillic
- **Cormorant Garamond** (заголовки): Google Fonts, подмножества Latin + Cyrillic

### Backend & БД

| Инструмент | Назначение |
|-----------|-----------|
| Supabase PostgreSQL | Хранилище данных, RLS, триггеры, частичные индексы |
| @supabase/supabase-js | JS SDK для доступа к БД |
| Nodemailer | SMTP-клиент с поддержкой .ics вложений |

### Интеграции

| Сервис | Способ | Назначение |
|--------|--------|-----------|
| Telegram Bot API | Raw fetch (no SDK) | Webhook-режим, inline-клавиатуры, оповещения персонала |
| Google Calendar API v3 | Raw fetch + OAuth2 | Создание/удаление событий, по одному токену обновления на студию |
| Google Analytics 4 | gtag.js | Отслеживание событий бронирования |
| Google Tag Manager | Встроен в Layout | Приоритет над прямым GA, если установлен |
| Google Ads | gtag conversion | Отслеживание конверсий, когда указан NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID |

---

## Архитектура системы

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                           │
│  Next.js React Pages                                                │
│  - Studio selection → Slot picker → Booking form                    │
│  - Cancellation page (token-gated, no login)                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES (Server)                      │
│  /api/slots             GET  - fetch available slots                │
│  /api/bookings          POST - create booking                       │
│  /api/bookings/[token]  GET  - fetch booking by cancel token        │
│  /api/bookings/cancel   POST - client cancellation                  │
│  /api/telegram/webhook  POST - Telegram Bot events                  │
│  /api/admin/slots/*     CRUD - admin slot management                │
│                                                                     │
│  All DB access via Supabase JS SDK (service_role key, server only)  │
└────────┬──────────────────┬────────────────┬────────────────────────┘
         │                  │                │
         │ PostgreSQL        │ HTTP           │ HTTP
         │ (Supabase)        │ (Telegram)     │ (Google/SMTP)
         ▼                  ▼                ▼
┌──────────────┐   ┌──────────────┐   ┌────────────────────────────┐
│  Supabase    │   │ Telegram     │   │  External Services         │
│  PostgreSQL  │   │ Bot API      │   │                            │
│              │   │              │   │  Google Calendar API       │
│  - studios   │   │  - sendMessage    │  (OAuth 2.0, per studio)  │
│  - slots     │   │  - editMessage│   │                            │
│  - bookings  │   │  - answerCallback │  Nodemailer (SMTP)        │
│  - allowed_  │   │               │  │  - confirmation email      │
│    users     │   │               │  │  - cancellation email      │
│  - email_logs│   │               │  │                            │
│              │   │               │  │                            │
│  RLS enabled │   └───────────────┘  └────────────────────────────┘
└──────────────┘
        ▲
        │ HTTPS webhook
        │
┌──────────────────┐
│  Telegram Staff  │
│  (mobile/desktop)│
│                  │
│  Receives alert  │
│  Taps Confirm /  │
│  Cancel button   │
└──────────────────┘
```

> Подробнее: [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — диаграммы потоков, конечный автомат состояний, анализ race condition

---

## Страницы и маршруты

### Основные страницы приложения

| Маршрут | Компонент | Описание |
|---------|-----------|---------|
| `/` | `app/(landing)/page.tsx` | Посадочная страница: JSON-LD структурированные данные, все секции, SEO |
| `/admin` | `app/admin/page.tsx` | Админ-панель (защита localStorage, пароль) |
| `/cancel?token=...` | `app/cancel/page.tsx` | Сервер-компонент отмены, три состояния (отсутствие токена / уже отменено / активно) |

### Маршруты API (см. раздел [API маршруты](#api-маршруты))

---

## Компоненты посадочной страницы

### Header (components/landing/Header.tsx)

- **Фиксированная навигация** с прозрачностью при загрузке
- При прокрутке на 20px переходит в `bg-white/80 backdrop-blur-md`
- **Логотип**: "WOVSDH" + "Nails" с акцентом розового цвета
- **Десктоп-навигация**: Услуги→#services, Галерея→#gallery, О нас→#studios, Контакты→#contact
- **CTA-кнопка** "Записаться" → #booking
- **Мобильные меню**: гамбургер-иконка с выпадающей панелью

### Hero (components/landing/Hero.tsx)

- Полновысотный баннер с CSS-градиентом (cream → blush)
- Два декоративных SVG элемента
- **Заголовок**: "Идеальные ногти в Израиле" (Cormorant Garamond, масштабируемый шрифт)
- **Две CTA**: "Записаться онлайн" → #booking, "Смотреть работы" → #gallery
- **Социальное доказательство**: 500+ клиентов, 2 студии, 24/7 бронирование
- **Анимированный индикатор прокрутки**

### Services (components/landing/Services.tsx, id="services")

- Сетка из 6 карточек услуг (адаптивная)
- Каждая карточка: иконка в круге (blush), название, описание, цена, "Записаться →"
- Услуги: Маникюр (₪120+), Педикюр (₪150+), Гель-лак (₪90+), Наращивание (₪200+), Дизайн (₪30+), Парафинотерапия (₪60+)

### Gallery (components/landing/Gallery.tsx, id="gallery")

- CSS-сетка 9 изображений: 2 колонки на мобильном, 3 на десктопе
- Квадратные изображения (aspect-square)
- При наведении: оверлей с rose-градиентом
- CTA внизу: "Смотреть в Instagram"
- **Примечание**: использует picsum.photos как плейсхолдер; для production заменить на реальные фото

### Studios (components/landing/Studios.tsx, id="studios")

- Две карточки студий
- Каждая: адрес, часы работы (иконки MapPin/Clock), "Записаться в эту студию"
- **Ришон-ле-Цион**: Вс–Чт 9–20, Пт 9–15, Сб закрыто
- **Ашдод**: Вс–Чт 9–20, Пт 9–14, Сб закрыто

### BookingSection (components/landing/BookingSection.tsx, id="booking")

- Обёртка-карточка для `<BookingForm>` многошагового виджета
- Заголовок: "Онлайн запись"

### Contact (components/landing/Contact.tsx, id="contact")

- Карточки телефона и email
- Кнопки социальных сетей: WhatsApp, Instagram (с aria-labels)

### Footer (components/landing/Footer.tsx)

- Тёмный фон (charcoal)
- 3-колонный layout: бренд/tagline | навигационные ссылки | социальные сети + легальные ссылки
- Ссылки: Политика конфиденциальности, Условия использования
- Copyright: © 2025 WOVSDH Nails

---

## Виджет бронирования

### Компонент BookingForm (components/booking/BookingForm.tsx)

Многошаговая форма с переменной состояния `step`: `'city' | 'datetime' | 'contacts' | 'success'`

#### Step 1 — CitySelector.tsx

Две кнопки в стиле radio:
- Ришон-ле-Цион
- Ашдод

Выбор немедленно переводит на Step 2.

#### Step 2 — DatePicker.tsx + TimePicker.tsx

**DatePicker:**
- `<input type="date">` с минимальной датой = сегодня (часовой пояс Asia/Jerusalem)
- При изменении отправляет `GET /api/slots?studio_id=<id>&date=YYYY-MM-DD`
- Показывает сетку доступных слотов через TimePicker

**TimePicker:**
- Сетка кнопок возвращённых слотов
- Loading-скелет во время загрузки
- Сообщение пустого состояния, если нет доступных слотов
- Кнопка "Назад" возвращает на Step 1

#### Step 3 — ContactForm.tsx

Поля:
- Имя (first name)
- Фамилия (last name)
- Телефон (формат +972)
- Email

При отправке: `POST /api/bookings`

**Обработка ошибок:**
- `409 SLOT_UNAVAILABLE` → возврат на Step 2, обновление слотов
- При успехе → Step 4

**Конверсионное событие:**
```javascript
dataLayer.push({
  event: 'booking_completed',
  studio_id,
  slot_id,
  value: 1,
  currency: 'ILS'
})
gtag('event', 'conversion') // если NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID установлен
```

#### Step 4 — BookingSuccess.tsx

- Название студии + отформатированное время встречи
- Кнопка "Записать ещё раз" → сброс на Step 1

**Прогресс-бар:**
- 3-шаговая горизонтальная полоса (Студия / Дата и время / Контакты)
- Скрыта на шаге успеха

**Баннер ошибок:**
- Красный alert выше шага при любой ошибке API/сети

---

## Сквозной поток бронирования

### Этап 1: Создание бронирования

1. **Клиент** отправляет `POST /api/bookings` (studio_id, slot_id, контакты)
2. **API** атомарно: вставляет booking (status=PENDING) + обновляет slot status='booked'
3. **Защита от race condition**: частичный уникальный индекс `uq_bookings_slot_active` (WHERE status != 'CANCELLED') конвертирует ошибку PG 23505 в HTTP 409

### Этап 2: Оповещение персонала (fire-and-forget)

1. После успешного коммита БД API отправляет Telegram-сообщение
2. `notifyStaffNewBooking()` получает всех активных `allowed_users`
3. Каждому отправляется форматированное сообщение с кнопками `[✅ Подтвердить]` и `[❌ Отменить]`
4. Сохраняется `telegram_message_id` на бронировании (для редактирования позже)
5. Отказ Telegram не блокирует создание бронирования

### Этап 3: Персонал подтверждает (Telegram callback)

1. Персонал нажимает `[✅ Подтвердить]`
2. Telegram отправляет `POST /api/telegram/webhook` с `callback_query` (callback_data = "confirm:<booking_id>")
3. API проверяет:
   - Секретный заголовок `X-Telegram-Bot-Api-Secret-Token`
   - Наличие `chat_id` в таблице `allowed_users` и `is_active=true`
4. Устанавливает booking.status = CONFIRMED
5. Редактирует Telegram-сообщение (удаляет кнопки, добавляет "Подтверждено")

### Этап 4: Пост-подтверждение (микросервисные вызовы)

1. **Создание события Google Calendar**: `POST /api/internal/confirm-booking` (fire-and-forget)
   - Использует `GOOGLE_REFRESH_TOKEN_<STUDIO>` для получения access-токена
   - Создаёт событие в Google Calendar
   - Сохраняет `google_calendar_event_id` на бронировании

2. **Отправка подтверждения по email**: `POST /api/internal/send-confirmation-email` (fire-and-forget)
   - HTML-письмо с деталями встречи
   - `.ics` вложение
   - Ссылка добавления в Google Calendar
   - **Ссылка отмены**: `APP_URL/cancel?token=<cancellation_token>` (UUID, отдельный от booking.id)
   - Логирование в таблицу `email_logs`

### Этап 5: Отмена клиентом (email-ссылка)

1. **Клиент** кликает на ссылку отмены в письме → `/cancel?token=...`
2. **Страница** получает токен, отправляет `POST /api/bookings/cancel` (server-to-server)
3. **API** атомарно:
   - Устанавливает booking.status = CANCELLED
   - Обновляет slot.status = 'available' (слот снова доступен)
   - Удаляет Google Calendar событие (404 игнорируется как idempotent)
   - Оповещает персонал Telegram-сообщением
   - Отправляет письмо подтверждения отмены
   - Логирует в `email_logs`

### Машина состояний бронирования

```
PENDING → CONFIRMED (персонал подтвердил Telegram-кнопкой)
PENDING → CANCELLED (персонал отменил Telegram-кнопкой)
CONFIRMED → CANCELLED (клиент отменил ссылкой в письме)

CANCELLED — терминальное состояние; слот освобождается для пересдачи
```

> Подробнее: [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — диаграммы последовательности, анализ race condition

---

## Панель администратора

### Компонент AdminPanel (app/admin/page.tsx — 'use client')

**Аутентификация:**
- Защита через localStorage ключ `admin_secret`
- Отправляет как заголовок `X-Admin-Secret` на все admin API запросы
- 401 ответ очищает сохранённый secret

**Переключатель студии:**
- Две кнопки: `rishon` / `ashdod`
- Переключение обновляет список слотов

**Форма генерации слотов:**
- Поля: Дата, Время начала (по умолчанию 10:00), Время окончания (по умолчанию 18:00), Длительность (30/45/60/90 мин)
- Отправляет `POST /api/admin/slots`
- Ответ: "Создано X слотов, пропущено Y (уже существуют)"

**Список слотов:**
- Выбор диапазона дат + кнопка Обновить
- Столбцы: Дата | Время | Статус (Свободен/Забронирован/Заблокирован) | Клиент (если забронирован) | Удалить
- Удаление отключено для забронированных слотов
- 409 ответ, если существует активное бронирование

---

## Страница отмены бронирования

### Компонент Cancel (app/cancel/page.tsx — Server Component)

Читает `?token=` из searchParams. Три состояния:

1. **Токен отсутствует**
   - Ошибка: "Ссылка отмены недействительна"

2. **Уже отменено**
   - Информация: "Эта запись уже была отменена"

3. **Активное бронирование**
   - Отменяет бронирование
   - Успех: "Запись отменена, {clientName}"
   - CTA "Записаться снова" → главная страница

---

## API маршруты

### Публичные маршруты (без аутентификации)

| Метод | Путь | Назначение |
|-------|------|-----------|
| GET | `/api/slots` | Доступные слоты. Параметры: `studio_id`, `date` (YYYY-MM-DD) |
| POST | `/api/bookings` | Создание бронирования (PENDING). Тело: slot_id, studio_id, контакты клиента |
| POST | `/api/bookings/cancel` | Отмена бронирования по токену |
| GET | `/api/calendar/ics` | Скачать .ics файл. Параметр: `booking_id` |

### Admin маршруты (заголовок X-Admin-Secret)

| Метод | Путь | Назначение |
|-------|------|-----------|
| GET | `/api/admin/slots` | Список всех слотов за диапазон дат |
| POST | `/api/admin/slots` | Генерация слотов (дата + диапазон времени + длительность) |
| DELETE | `/api/admin/slots/[id]` | Удаление слота (блокировано если есть активное бронирование) |

### Internal маршруты (заголовок X-Internal-Secret, server-to-server)

| Метод | Путь | Назначение |
|-------|------|-----------|
| POST | `/api/internal/confirm-booking` | Создание события Google Calendar |
| POST | `/api/internal/send-confirmation-email` | Отправка письма подтверждения |

### Webhook маршруты

| Метод | Путь | Аутентификация |
|-------|------|--------|
| POST | `/api/telegram/webhook` | `X-Telegram-Bot-Api-Secret-Token` |

### Структура ошибок

Все ошибки возвращаются в едином формате:

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "Выбранный слот больше не доступен"
  }
}
```

**Коды ошибок:**
- `INVALID_PARAMS` — невалидные параметры запроса
- `SLOT_NOT_FOUND` — слот не найден
- `SLOT_UNAVAILABLE` — слот занят (409)
- `SLOT_HAS_ACTIVE_BOOKING` — на слоте есть активное бронирование
- `BOOKING_NOT_FOUND` — бронирование не найдено
- `ALREADY_CANCELLED` — бронирование уже отменено
- `UNAUTHORIZED` — отсутствует/невалидный заголовок аутентификации
- `VALIDATION_ERROR` — ошибка валидации данных
- `INTERNAL_ERROR` — внутренняя ошибка сервера

### Временные зоны

Все datetime-значения хранятся в ISO 8601 UTC. API принимает и возвращает UTC; frontend/lib преобразует в Asia/Jerusalem для отображения.

> Подробнее: [docs/API_CONTRACTS.md](./API_CONTRACTS.md)

---

## Схема базы данных

### Обзор

PostgreSQL на Supabase управляет двумя студиями, временными слотами, клиентскими бронированиями, белым списком сотрудников и логами email.

Все временные метки хранятся как `TIMESTAMPTZ` (UTC) и преобразуются в `Asia/Jerusalem` для отображения.

### Таблица `studios`

Справочные данные для каждого физического салона.

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|---------|
| `id` | TEXT | PRIMARY KEY | Человекочитаемый slug: `rishon`, `ashdod` |
| `name` | TEXT | NOT NULL | Отображаемое имя, напр. "Ришон-ле-Цион" |
| `city` | TEXT | NOT NULL | Название города |
| `google_calendar_id` | TEXT | | ID Google Calendar этой студии |
| `timezone` | TEXT | DEFAULT | Всегда `Asia/Jerusalem` |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Временная метка создания |

### Таблица `slots`

Дискретное окно бронирования в студии. Слоты предварительно генерируются администратором.

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|---------|
| `id` | UUID | PRIMARY KEY | Уникальный идентификатор слота |
| `studio_id` | TEXT | FK → studios(id) | К какой студии относится слот |
| `start_at` | TIMESTAMPTZ | NOT NULL | Начало слота (UTC) |
| `end_at` | TIMESTAMPTZ | NOT NULL | Конец слота (UTC) |
| `status` | enum | DEFAULT 'available' | Статус: available / booked / blocked |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Временная метка создания |

**Ограничение:** `CHECK (end_at > start_at)`

**Индексы:**
- `idx_slots_studio_start_status` (studio_id, start_at, status) — основной путь запроса
- `idx_slots_start_at` (start_at) — сканирование диапазонов

### Таблица `bookings`

Центральная таблица. Отменённые бронирования сохраняются (soft delete) для сохранения audit trail.

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|---------|
| `id` | UUID | PRIMARY KEY | Внутренний идентификатор бронирования |
| `slot_id` | UUID | FK → slots(id) | Забронированный слот |
| `studio_id` | TEXT | FK → studios(id) | Денормализовано для удобства |
| `client_first_name` | TEXT | NOT NULL | Имя клиента |
| `client_last_name` | TEXT | NOT NULL | Фамилия клиента |
| `client_phone` | TEXT | NOT NULL | Телефонный номер |
| `client_email` | TEXT | NOT NULL | Email для подтверждения и отмены |
| `status` | enum | DEFAULT 'PENDING' | Статус: PENDING / CONFIRMED / CANCELLED |
| `cancellation_token` | UUID | UNIQUE | UUID для ссылки отмены |
| `google_calendar_event_id` | TEXT | | ID события GCal (после CONFIRMED) |
| `telegram_message_id` | BIGINT | | ID Telegram-сообщения персоналу |
| `confirmed_at` | TIMESTAMPTZ | | Когда статус → CONFIRMED |
| `cancelled_at` | TIMESTAMPTZ | | Когда статус → CANCELLED |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Временная метка создания |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Обновляется триггером |

**Индексы (critical for race condition prevention):**
- `idx_bookings_slot_id` (slot_id) — поиск при подтверждении/отмене
- `idx_bookings_cancellation_token` UNIQUE — O(1) поиск по токену отмены
- `idx_bookings_status` (status) — фильтрация по статусу
- `idx_bookings_studio_created` (studio_id, created_at DESC) — список админ-панели
- **`uq_bookings_slot_active` PARTIAL (slot_id) WHERE status != 'CANCELLED'** — **защита от двойного бронирования**

**Race Condition Protection:**

Частичный уникальный индекс гарантирует, что одновременно может существовать максимум одно бронирование (не отменённое) на один слот. Если два клиента одновременно отправят `POST /api/bookings` на один слот, PostgreSQL's MVCC сериализация обеспечит успех только одного; второй получит `unique_violation` (код 23505), который API конвертирует в HTTP 409 Conflict.

### Таблица `allowed_users`

Белый список Telegram `chat_id` для сотрудников, имеющих право подтверждать/отменять бронирования через бота.

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|---------|
| `id` | UUID | PRIMARY KEY | Внутренний идентификатор |
| `telegram_chat_id` | BIGINT | UNIQUE | Telegram ID пользователя/чата |
| `name` | TEXT | NOT NULL | Имя сотрудника |
| `is_active` | BOOLEAN | DEFAULT TRUE | Soft disable |
| `added_at` | TIMESTAMPTZ | DEFAULT NOW() | Временная метка добавления |

**Индекс:**
- `idx_allowed_users_chat_id` UNIQUE — каждый webhook проверяет это, O(1)

### Таблица `email_logs`

Append-only audit log всех отправленных писем.

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|---------|
| `id` | UUID | PRIMARY KEY | Внутренний идентификатор |
| `booking_id` | UUID | FK → bookings(id) | Какое бронирование вызвало письмо |
| `email_type` | enum | NOT NULL | confirmation / cancellation |
| `recipient_email` | TEXT | NOT NULL | Адрес получателя (снимок) |
| `sent_at` | TIMESTAMPTZ | DEFAULT NOW() | Временная метка попытки отправки |
| `error` | TEXT | | NULL при успехе; SMTP-ошибка при отказе |

**Индекс:**
- `idx_email_logs_booking_id` (booking_id) — история писем для бронирования

### Row Level Security (RLS)

Все таблицы имеют RLS включённый. Backend использует `service_role` ключ (обходит RLS) для записей. Public API использует `anon` ключ только для чтения доступных слотов.

| Таблица | Role | Operation | Условие | Описание |
|---------|------|-----------|---------|---------|
| `studios` | anon | SELECT | TRUE | Все могут читать справочные данные |
| `slots` | anon | SELECT | status='available' | Видны только доступные слоты |
| `slots` | service_role | ALL | TRUE | Полный доступ |
| `bookings` | service_role | ALL | TRUE | Только backend |
| `allowed_users` | service_role | ALL | TRUE | Только backend |
| `email_logs` | service_role | ALL | TRUE | Только backend |

### Триггеры

**`set_updated_at` (BEFORE UPDATE на bookings)**

Автоматически устанавливает `updated_at = NOW()` при каждом UPDATE.

### ER-диаграмма

```
studios (1) ──< slots (1) ──< bookings (1–много, soft-delete)
                                   │
                                   └──< email_logs

allowed_users  (standalone whitelist, no FK)
```

> Подробнее: [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — определения столбцов, rationale индексов, RLS политики

---

## Интеграции

### Telegram Bot

**Вебхук:**
- URL: `APP_URL/api/telegram/webhook`
- Секретный токен: `TELEGRAM_WEBHOOK_SECRET` (проверяется как заголовок `X-Telegram-Bot-Api-Secret-Token`)

**Callback данные:**
- Формат: `"confirm:<booking_id>"` или `"cancel:<booking_id>"`

**Белый список сотрудников:**
- Таблица `allowed_users` (chat_id, is_active)
- Каждый callback проверяет наличие и статус в этой таблице

**Команды бота:**
- `/start` — запуск
- `/help` — справка
- `/adduser {id} {Name}` — добавить сотрудника
- `/removeuser {id}` — удалить сотрудника

**Fire-and-Forget:**
- Отказы Telegram никогда не блокируют создание бронирования или другие операции
- Все ошибки логируются, но не прерывают основной поток

### Google Calendar

**Аутентификация:**
- OAuth 2.0 с refresh-токеном
- Два набора учётных данных: `GOOGLE_REFRESH_TOKEN_RISHON` и `GOOGLE_REFRESH_TOKEN_ASHDOD`
- `getAccessToken(refreshToken)` обмениваются учётными данными на `https://oauth2.googleapis.com/token` при каждом вызове (serverless-safe)

**Создание события:**
- Summary: "Запись: FirstName LastName"
- Description: телефон + email + bookingId
- Напоминания: 60 мин (email) и 30 мин (popup)

**Удаление события:**
- `deleteCalendarEvent()` обрабатывает HTTP 404 как no-op (idempotent)

### Email (Nodemailer)

**Транспортер:**
- Ленивая инициализация: модульный `_transporter` инициализируется при первой отправке
- STARTTLS на порту 587 (`secure: false`)

**Шаблоны (lib/email-templates.ts):**
- `buildConfirmationEmail(booking, isCal)` → `{ subject, html, text }`
- `buildCancellationEmail(booking)` → `{ subject, html, text }`

**Содержимое подтверждения:**
- Детали встречи (дата, время, студия, услуга)
- `.ics` вложение (iCalendar)
- Ссылка "Добавить в Google Calendar"
- **Ссылка отмены**: `APP_URL/cancel?token=<cancellation_token>`

**Логирование:**
- Все отправки (успешные и неудачные) записываются в `email_logs`
- `sendBookingConfirmation()` перебрасывает SMTP-ошибки (fail-fast)

### Google Analytics 4 & Google Tag Manager

**GA4:**
- Прямое подключение через `gtag.js` (strategy="afterInteractive")
- Fallback: `<noscript>` iframe при наличии `NEXT_PUBLIC_GTM_ID`

**GTM:**
- Берёт приоритет над прямым GA, когда `NEXT_PUBLIC_GTM_ID` установлен

**Conversion Tracking:**
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID` для отслеживания конверсий Google Ads
- Event: `booking_completed` с studio_id, slot_id, value=1, currency='ILS'

---

## SEO и аналитика

### JSON-LD Structured Data

**app/(landing)/page.tsx содержит:**
- Два `BeautySalon` entities (по одному на студию)
- `ItemList` с перечислением услуг (Маникюр, Педикюр, Гель-лак и т. д.)
- Основная разметка согласна Schema.org

### Next.js Metadata API

```typescript
export const metadata = {
  title: { template: '%s | WOVSDH Nails', ... },
  openGraph: {
    locale: 'ru_IL',
    alternates: ['he_IL', 'en_US'],
    ...
  },
  twitter: { card: 'summary_large_image' },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION }
}
```

### Sitemap (sitemap.ts)

- `/` — приоритет 1.0, еженедельное обновление
- `/#services` — приоритет 0.8, ежемесячное обновление
- `/#booking` — приоритет 0.9, ежедневное обновление

### robots.txt (robots.ts)

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
```

### Analytics Implementation

**Порядок приоритета:**
1. GTM (если `NEXT_PUBLIC_GTM_ID` установлен) — управляет всеми тегами
2. GA4 (если только `NEXT_PUBLIC_GA_MEASUREMENT_ID`)

---

## Переменные окружения

### Supabase (3 переменные)

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>                    # client + server
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>                # server only
```

### Telegram (2 переменные)

```
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_WEBHOOK_SECRET=<random-secret>                     # validates inbound webhooks
```

### Google Calendar (7 переменных)

```
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-client-secret>
GOOGLE_REDIRECT_URI=<redirect-uri>
GOOGLE_REFRESH_TOKEN_RISHON=<token>
GOOGLE_REFRESH_TOKEN_ASHDOD=<token>
GOOGLE_CALENDAR_ID_RISHON=<calendar-id>
GOOGLE_CALENDAR_ID_ASHDOD=<calendar-id>
```

### SMTP (5 переменных)

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=<user>
SMTP_PASS=<password>
SMTP_FROM="WOVSDH Nails <noreply@example.com>"
```

### Приложение (2 переменные)

```
NEXT_PUBLIC_APP_URL=https://yourdomain.com                  # для ссылок отмены
ADMIN_SECRET_KEY=<long-random-string>                       # защита /api/admin/* и /api/internal/*
```

### Аналитика/SEO (4 переменные)

```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GTM_ID=GTM-XXXXXX
GOOGLE_SITE_VERIFICATION=<verification-code>
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID=<conversion-id>
```

### Важные примечания по безопасности

- **NEXT_PUBLIC_* переменные** включаются в клиентский JS; используйте только для безопасных значений (Supabase anon key, app URL, analytics IDs)
- **SUPABASE_SERVICE_ROLE_KEY** и **ADMIN_SECRET_KEY** должны оставаться исключительно на сервере
- Используйте `.env.local` для локальной разработки (в .gitignore)
- На Vercel используйте Project Settings → Environment Variables

---

## Модель безопасности

| Уровень | Механизм | Описание |
|---------|----------|---------|
| **База данных** | RLS | anon видит только доступные слоты и все студии; writes требуют service_role |
| **API записи** | service_role ключ на сервере | Все мутации через encrypted env vars, никогда не через клиент |
| **Admin endpoints** | `X-Admin-Secret` заголовок | Сравнивается с `ADMIN_SECRET_KEY` на каждом запросе |
| **Telegram webhook** | `X-Telegram-Bot-Api-Secret-Token` | Проверяется перед обработкой callback_query |
| **Ссылка отмены** | Уникальный UUID токен | Отдельный от booking.id; O(1) поиск через индекс; предотвращает перебор |
| **Доступ персонала** | Таблица `allowed_users` | Проверяется на каждом Telegram callback; soft revocation через `is_active` |

### Best Practices

- Все операции с БД используют параметризованные запросы (через Supabase SDK)
- Нет SQL-инъекций в пути
- Временные метки и audit logs сохраняют полную историю
- Отмены хранятся (soft delete), не удаляются
- Email логируются (для переиспытания и отладки)

---

## Структура файлов

```
/
├── app/
│   ├── layout.tsx                      Root layout: fonts, GTM/GA, OpenGraph
│   ├── globals.css                     CSS custom properties (colors, spacing)
│   ├── robots.ts                       robots.txt generation
│   ├── sitemap.ts                      sitemap.xml generation
│   ├── (landing)/
│   │   ├── layout.tsx                  Landing-specific wrapper
│   │   └── page.tsx                    Landing page: JSON-LD + section assembly
│   ├── admin/
│   │   └── page.tsx                    Admin dashboard (client-side, password-gated)
│   ├── cancel/
│   │   └── page.tsx                    Cancellation page (server component)
│   └── api/
│       ├── slots/route.ts              GET available slots
│       ├── bookings/route.ts           POST create booking
│       ├── bookings/cancel/route.ts    POST cancel by token
│       ├── calendar/ics/route.ts       GET .ics export
│       ├── telegram/webhook/route.ts   POST Telegram callbacks
│       ├── admin/slots/route.ts        GET/POST slot management
│       ├── admin/slots/[id]/route.ts   DELETE slot
│       ├── internal/confirm-booking/route.ts       Create GCal event
│       └── internal/send-confirmation-email/route.ts Send email
├── components/
│   ├── booking/
│   │   ├── BookingForm.tsx             Multi-step orchestrator
│   │   ├── CitySelector.tsx            Step 1: studio selection
│   │   ├── DatePicker.tsx              Step 2a: date selection
│   │   ├── TimePicker.tsx              Step 2b: time slot grid
│   │   ├── ContactForm.tsx             Step 3: client contact form
│   │   └── BookingSuccess.tsx          Step 4: success confirmation
│   ├── landing/
│   │   ├── Header.tsx                  Sticky nav with scroll-aware styling
│   │   ├── Hero.tsx                    Full-viewport hero banner
│   │   ├── Services.tsx                6-service card grid
│   │   ├── Gallery.tsx                 9-image photo grid
│   │   ├── Studios.tsx                 2-studio info cards
│   │   ├── BookingSection.tsx          Booking widget wrapper
│   │   ├── Contact.tsx                 Contact cards + social buttons
│   │   └── Footer.tsx                  Dark footer
│   └── ui/
│       └── Button.tsx                  Reusable button component
├── lib/
│   ├── supabase.ts                     Supabase client singletons (anon + admin)
│   ├── types.ts                        All TypeScript interfaces, enums, DTOs
│   ├── validation.ts                   Pure validation helpers
│   ├── utils.ts                        Date formatting, type guards
│   ├── telegram.ts                     Telegram API wrappers + message builders
│   ├── google-calendar.ts              Google Calendar OAuth2 + event CRUD
│   ├── email.ts                        Nodemailer transporter + send functions
│   ├── email-templates.ts              HTML/text email template builders
│   └── notify.ts                       notifyStaffNewBooking orchestrator
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      Full DB schema with RLS and triggers
├── docs/                               Reference documentation
├── .env.example                        All env variables with comments
└── package.json                        Dependencies and scripts
```

---

## Указатель существующих документов

| Документ | Содержание | Аудитория |
|----------|-----------|----------|
| **[docs/ARCHITECTURE.md](./ARCHITECTURE.md)** | Диаграммы компонентов, потоки букинга/отмены, конечный автомат, анализ race condition | Разработчики |
| **[docs/API_CONTRACTS.md](./API_CONTRACTS.md)** | Полные request/response bodies, коды ошибок, заметки per endpoint | Разработчики / интеграторы |
| **[docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** | Определения столбцов, rationale индексов, RLS политики, триггеры | Разработчики / DBAs |
| **[docs/SETUP.md](./SETUP.md)** | Локальная разработка, curl примеры, тестирование | Разработчики |
| **[docs/DEPLOYMENT.md](./DEPLOYMENT.md)** | Vercel deployment, domain setup, production checklist | Разработчики / DevOps |
| **[docs/TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md)** | BotFather steps, webhook registration, whitelist management | Разработчики |
| **[docs/GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md)** | Google Cloud Console OAuth2 setup | Разработчики |
| **[docs/SMTP_SETUP.md](./SMTP_SETUP.md)** | Gmail App Password, SMTP provider configuration | Разработчики |
| **[docs/ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** | Управление слотами, Telegram workflow (русский) | Персонал студии |
| **[docs/OPENAPI.yaml](./OPENAPI.yaml)** | OpenAPI 3.0 machine-readable spec | Потребители API |

---

## Ключевые артефакты и операции

### Локальная разработка

```bash
# 1. Установка зависимостей
npm install

# 2. Копирование примера env-файла
cp .env.example .env.local

# 3. Заполнение .env.local учётными данными (см. раздел SETUP.md)

# 4. Запуск dev-сервера
npm run dev

# 5. Доступ к приложению
# http://localhost:3000
```

> Подробнее: [docs/SETUP.md](./SETUP.md)

### CI/CD (Vercel)

- **Репозиторий:** Git (GitHub, GitLab, Bitbucket)
- **Триггер деплоя:** Push в `main` ветку
- **Build output:** Next.js оптимизированный production bundle
- **Environment variables:** Из Project Settings на Vercel (приватные от VCS)
- **Домен:** Настраивается через Vercel → Settings → Domains

> Подробнее: [docs/DEPLOYMENT.md](./DEPLOYMENT.md)

### Тестирование интеграций

**Telegram webhook (локально через ngrok):**
```bash
ngrok http 3000
# Скопировать URL из ngrok → WEBHOOK_URL
# curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEBHOOK_URL>
```

**Google Calendar OAuth2:**
1. Создать OAuth2 credentials в Google Cloud Console
2. Скопировать Client ID, Secret, Redirect URI
3. Запустить `npm run google-auth` для обмена authorization code на refresh token
4. Сохранить refresh tokens в .env.local

> Подробнее: [docs/GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md)

### Администрирование слотов

1. Открыть `/admin`
2. Ввести пароль (`ADMIN_SECRET_KEY`)
3. Выбрать студию (Ришон / Ашдод)
4. Заполнить форму генерации (дата, время начала/конца, длительность)
5. Кликнуть "Создать слоты"
6. Просмотреть список слотов, удалить при необходимости

> Подробнее: [docs/ADMIN_GUIDE.md](./ADMIN_GUIDE.md)

### Отладка

**Логи серверной части:**
```bash
# Vercel dev mode
npm run dev

# Переменные окружения
echo $TELEGRAM_BOT_TOKEN
```

**Логи базы данных (Supabase):**
- Supabase Dashboard → Logs → Postgres
- Фильтр по `booking`, `slot`, `email_logs`

**Логи email:**
- Supabase Dashboard → SQL Editor
- `SELECT * FROM email_logs ORDER BY sent_at DESC;`

**Тестирование Telegram webhook:**
```bash
curl -X POST http://localhost:3000/api/telegram/webhook \
  -H "X-Telegram-Bot-Api-Secret-Token: <SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"update_id":123,"callback_query":{...}}'
```

---

## Дополнительные ресурсы

### Стили и дизайн

- **Tailwind CSS 4** — конфиг в `tailwind.config.ts`
- **Цветовая схема**: cream (#FFF5F0), blush (#E8BEBA), rose (#C17078), charcoal (#2C2C2C)
- **Кастомные свойства CSS** в `app/globals.css` для переиспользования

### Форматирование и линтинг

```bash
npm run lint       # ESLint
npm run format     # Prettier
npm run type-check # TypeScript
```

### Развёртывание на production

**Checklist:**
1. Все env vars установлены на Vercel
2. Telegram webhook URL обновлён
3. Google Calendar credentials свежие (refresh tokens)
4. SMTP credentials проверены (тестовое письмо)
5. Домен настроен и SSL активен
6. Monitorinug настроен (ошибки, logs)

> Подробнее: [docs/DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Документ создан для оптимизации onboarding разработчиков и интеграторов. Для деталей обратитесь к приведённым выше специальным документам.**
