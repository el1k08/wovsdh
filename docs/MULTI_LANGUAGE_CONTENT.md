# Multi-Language Content Management

Services and Studios store user-facing text in all three languages via a `translations` JSONB column. This is separate from the UI string translations in `/locales/*.json`.

---

## Database Schema

### `services.translations`

```jsonc
{
  "uk": { "name": "Манікюр", "description": "Класичний манікюр" },
  "en": { "name": "Manicure", "description": "Classic manicure" },
  "he": { "name": "מניקור", "description": "מניקור קלאסי" }
}
```

### `studios.translations`

```jsonc
{
  "uk": { "name": "Рішон-ле-Ціон", "schedule_text": "Пн–Пт 10:00–19:00" },
  "en": { "name": "Rishon LeZion", "schedule_text": "Mon–Fri 10:00–19:00" },
  "he": { "name": "ראשון לציון", "schedule_text": "ב׳–ו׳ 10:00–19:00" }
}
```

The `name` and `description`/`schedule_text` columns on the table rows are the legacy primary-language values and are still written on create/update for backward compatibility.

---

## Admin Panel — Editing Translations

In the admin panel, **Services** and **Studios** forms show three language tabs (UA / EN / HE). Fill in each tab before saving. All three language fields are written in a single API call.

The form submits a `translations` object with the structure above. Saving only updates the fields you changed — other languages are merged server-side via Supabase's JSONB update (the `||` operator).

---

## API — Fetching Content by Language

Public endpoints accept an optional `language` query parameter:

```
GET /api/services?studio_id=rishon&language=en
GET /api/studios?language=he
```

The response `name` and `description`/`schedule_text` fields are resolved from `translations[language]`, falling back to `translations.uk`, then to the raw column value.

Omitting `language` defaults to `uk`.

### Admin endpoints

Admin endpoints (`/api/admin/services`, `/api/admin/studios`) always return the full `translations` object so the admin form can display all languages at once.

---

## TypeScript Types

```ts
import type { ServiceTranslations, StudioTranslations, Locale } from '@/lib/types'

// Locale: 'uk' | 'en' | 'he'

// ServiceTranslations: Record<Locale, { name: string; description: string }>
// StudioTranslations:  Record<Locale, { name: string; schedule_text: string }>
```

---

## Adding a New Language

1. **Add the locale code** to `lib/types.ts`:
   ```ts
   export type Locale = 'uk' | 'en' | 'he' | 'ru'  // example
   ```

2. **Create the UI translation file** `/locales/ru.json` — copy `uk.json` and translate all values.

3. **Register the locale** in `i18n/request.ts`:
   ```ts
   const validLocales = ['uk', 'en', 'he', 'ru'] as const
   ```

4. **Register in the server action** `/app/actions.ts`:
   ```ts
   const VALID_LOCALES = ['uk', 'en', 'he', 'ru'] as const
   ```

5. **Add the locale button** to `components/LanguageSwitcher.tsx`:
   ```ts
   const LOCALES = [
     { code: 'uk', label: 'UA' },
     { code: 'en', label: 'EN' },
     { code: 'he', label: 'HE' },
     { code: 'ru', label: 'RU' },  // ← add
   ] as const
   ```

6. **Add DB content** for the new locale: run an UPDATE on existing `services` and `studios` rows to populate `translations->'ru'` with translated values.

7. **Update email templates** in `/lib/email-templates.ts` — add a `ru` entry to the `CONFIRMATION` and `CANCELLATION` translation objects.

8. **Update cancel page** in `/app/cancel/page.tsx` — add a `ru` entry to the `T` object and update `CancelLocale` type.

9. **Update `resolveLocale`** in `/lib/locale-utils.ts`:
   ```ts
   export function resolveLocale(value: string | null | undefined): Locale {
     if (value === 'en' || value === 'he' || value === 'ru') return value
     return 'uk'
   }
   ```

10. **Update booking API** in `/app/api/bookings/route.ts` — add `'ru'` to the language validation:
    ```ts
    const validLanguage = ['en', 'he', 'ru'].includes(language as string) ? language as string : 'uk'
    ```

11. **Verify locale file sync** using the script in `docs/I18N_GUIDE.md`.

---

## Checklist: Creating a Service with Translations

- [ ] Open Admin → Services tab
- [ ] Click "Add service"
- [ ] Fill in shared fields: icon, price, duration
- [ ] Switch to **UA** tab → fill name and description in Ukrainian
- [ ] Switch to **EN** tab → fill name and description in English
- [ ] Switch to **HE** tab → fill name and description in Hebrew
- [ ] Save
- [ ] Verify the service appears correctly on the landing page in all three languages (use the language switcher in the header)

## Checklist: Creating a Studio with Translations

- [ ] Open Admin → Studios tab
- [ ] Click "Add studio"
- [ ] Fill in shared fields: ID, street, city, timezone
- [ ] Fill schedule (days/hours)
- [ ] Switch to **UA** tab → fill studio name and schedule text in Ukrainian
- [ ] Switch to **EN** tab → fill in English
- [ ] Switch to **HE** tab → fill in Hebrew
- [ ] Save
- [ ] Verify the studio card on the landing page shows the correct text per language
