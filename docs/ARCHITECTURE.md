# System Architecture

## Component Overview

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

---

## Booking Flow

```
CLIENT                    NEXT.JS API              SUPABASE DB         TELEGRAM            GOOGLE CAL        SMTP
  │                           │                        │                   │                   │               │
  │── GET /api/slots ────────>│                        │                   │                   │               │
  │                           │── SELECT slots ───────>│                   │                   │               │
  │                           │<── available slots ────│                   │                   │               │
  │<── slots list ────────────│                        │                   │                   │               │
  │                           │                        │                   │                   │               │
  │ (client fills form)       │                        │                   │                   │               │
  │                           │                        │                   │                   │               │
  │── POST /api/bookings ────>│                        │                   │                   │               │
  │                           │── BEGIN TRANSACTION ──>│                   │                   │               │
  │                           │── UPDATE slot          │                   │                   │               │
  │                           │   status='booked' ────>│                   │                   │               │
  │                           │── INSERT booking ──────>│                   │                   │               │
  │                           │   status='PENDING'     │                   │                   │               │
  │                           │   [uq_bookings_slot_active enforced here]  │                   │               │
  │                           │── COMMIT ─────────────>│                   │                   │               │
  │                           │<── booking record ─────│                   │                   │               │
  │                           │                        │                   │                   │               │
  │                           │── sendMessage (staff alert) ──────────────>│                   │               │
  │                           │   [Confirm] [Cancel] buttons               │                   │               │
  │<── 201 Created ───────────│                        │                   │                   │               │
  │                           │                        │                   │                   │               │
  │                      (staff sees alert)            │                   │                   │               │
  │                           │                        │                   │         (staff taps Confirm)      │
  │                           │<── callback_query: "confirm:<booking_id>" ─│                   │               │
  │                           │                        │                   │                   │               │
  │── POST /api/telegram/webhook (Telegram sends) ────>│                   │                   │               │
  │                           │── verify allowed_users ─────────────────>│                   │               │
  │                           │<── authorized ─────────────────────────── │                   │               │
  │                           │── UPDATE booking ──────>│                   │                   │               │
  │                           │   status='CONFIRMED'   │                   │                   │               │
  │                           │   confirmed_at=NOW()   │                   │                   │               │
  │                           │<── updated ────────────│                   │                   │               │
  │                           │                        │                   │                   │               │
  │                           │── createEvent ─────────────────────────────────────────────>│               │
  │                           │<── event_id ───────────────────────────────────────────────│               │
  │                           │── UPDATE booking ──────>│                   │                   │               │
  │                           │   gcal_event_id=... ───>│                   │                   │               │
  │                           │                        │                   │                   │               │
  │                           │── sendMail (confirmation + cancel link) ────────────────────────────────────>│
  │                           │<── sent ────────────────────────────────────────────────────────────────────│
  │                           │── INSERT email_logs ───>│                   │                   │               │
  │                           │                        │                   │                   │               │
  │                           │── editMessage "Confirmed by <name>" ───────>│                   │               │
  │<── confirmation email ─────────────────────────────────────────────────────────────────────────────────│
```

---

## Cancellation Flow (Client-initiated)

```
CLIENT                    NEXT.JS API              SUPABASE DB         GOOGLE CAL        TELEGRAM          SMTP
  │                           │                        │                   │                 │               │
  │ (clicks link in email)    │                        │                   │                 │               │
  │── GET /api/bookings/[token] ──────────────────────>│                   │                 │               │
  │                           │── SELECT booking ──────>│                   │                 │               │
  │                           │   WHERE                │                   │                 │               │
  │                           │   cancellation_token=$ │                   │                 │               │
  │                           │<── booking data ───────│                   │                 │               │
  │<── booking summary ───────│                        │                   │                 │               │
  │                           │                        │                   │                 │               │
  │ (client confirms cancel)  │                        │                   │                 │               │
  │── POST /api/bookings/cancel ──────────────────────>│                   │                 │               │
  │   { token: "..." }        │                        │                   │                 │               │
  │                           │── UPDATE booking ──────>│                   │                 │               │
  │                           │   status='CANCELLED'   │                   │                 │               │
  │                           │   cancelled_at=NOW()   │                   │                 │               │
  │                           │── UPDATE slot ──────────>│                   │                 │               │
  │                           │   status='available'   │                   │                 │               │
  │                           │<── updated ────────────│                   │                 │               │
  │                           │                        │                   │                 │               │
  │                           │── deleteEvent ──────────────────────────>│                 │               │
  │                           │   (if gcal_event_id set)                  │                 │               │
  │                           │                        │                   │                 │               │
  │                           │── sendMessage (staff notification) ────────────────────────>│               │
  │                           │   "Booking cancelled by client"            │                 │               │
  │                           │                        │                   │                 │               │
  │                           │── sendMail (cancellation confirmation) ──────────────────────────────────>│
  │                           │── INSERT email_logs ───>│                   │                 │               │
  │<── 200 OK ────────────────│                        │                   │                 │               │
  │<── cancellation email ─────────────────────────────────────────────────────────────────────────────>│
```

---

## Booking Status State Machine

```
                    ┌─────────────────────────────────────┐
                    │         POST /api/bookings          │
                    │       (slot atomically locked)      │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │    PENDING      │◄──── Initial state
                              └────────┬────────┘
                                       │
                   ┌───────────────────┼────────────────────────┐
                   │                   │                        │
                   ▼                   ▼                        ▼
         Staff taps Confirm    Staff taps Cancel       (timeout / future)
                   │                   │
                   ▼                   ▼
          ┌──────────────┐    ┌──────────────────┐
          │  CONFIRMED   │    │   CANCELLED      │
          │              │    │                  │
          │ GCal created │    │ slot freed       │
          │ email sent   │    │ GCal deleted     │
          └──────┬───────┘    │ email sent       │
                 │            └──────────────────┘
                 │
                 ▼ client clicks cancel link
          ┌──────────────────┐
          │   CANCELLED      │
          │ (from CONFIRMED) │
          │ slot freed       │
          │ GCal deleted     │
          │ email sent       │
          └──────────────────┘

Note: CANCELLED is a terminal state. Re-booking requires a new slot selection.
```

---

## Data Flow: Race Condition Prevention

```
Client A                    Client B                    PostgreSQL
    │                           │                           │
    │── read slot (available) ──────────────────────────>  │
    │                           │── read slot (available) ──>│
    │                           │                           │
    │── INSERT booking ─────────────────────────────────>  │
    │   slot_id = X             │                           │── uq_bookings_slot_active
    │                           │                           │   index: no conflict yet
    │                           │                           │◄─ INSERT succeeds
    │                           │                           │
    │                           │── INSERT booking ─────────>│
    │                           │   slot_id = X             │── uq_bookings_slot_active
    │                           │                           │   detects conflict
    │                           │                           │◄─ unique_violation (23505)
    │                           │◄── 409 Conflict ──────────│
    │◄── 201 Created ───────────│                           │
```

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server only, never exposed to client

# Telegram
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_WEBHOOK_SECRET=<random-secret>        # shared with Telegram, validates inbound webhooks

# Google Calendar
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-client-secret>
GOOGLE_REFRESH_TOKEN_RISHON=<token>            # per-studio refresh tokens
GOOGLE_REFRESH_TOKEN_ASHDOD=<token>

# Email (SMTP via Nodemailer)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=<user>
SMTP_PASS=<password>
SMTP_FROM="Nail Studio <noreply@example.com>"

# Admin
ADMIN_SECRET=<long-random-string>             # guards /api/admin/* routes

# Application
NEXT_PUBLIC_BASE_URL=https://yourdomain.com   # used to build cancellation links
```

---

## Security Model Summary

| Layer             | Mechanism                                                                 |
|-------------------|---------------------------------------------------------------------------|
| Database          | RLS — anon can only read available slots; bookings/users are service-role only |
| API writes        | All mutations via `service_role` key on server; client never touches DB directly |
| Admin endpoints   | `Authorization: Bearer <ADMIN_SECRET>` checked on every request           |
| Telegram webhook  | `X-Telegram-Bot-Api-Secret-Token` header validated before processing      |
| Cancellation link | HMAC-free UUID token stored in DB; lookup is O(1) via unique index; token is separate from booking ID |
| Staff access      | `allowed_users` whitelist keyed by Telegram `chat_id` checked on every callback |
