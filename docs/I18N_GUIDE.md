# i18n Guide — Multi-Language Support

The app supports three languages: **Ukrainian (`uk`)**, **English (`en`)**, and **Hebrew (`he`)**. Ukrainian is the default fallback.

---

## Architecture Overview

| Layer | Mechanism |
|---|---|
| Library | `next-intl` v4 |
| Locale detection | `locale` cookie → `Accept-Language` header → `uk` fallback |
| Cookie persistence | Server Action `setLocaleCookie` + `router.refresh()` |
| Translation files | `/locales/uk.json`, `/locales/en.json`, `/locales/he.json` |
| Request config | `/i18n/request.ts` — reads cookie/header, imports the right JSON |
| Language switcher | `/components/LanguageSwitcher.tsx` |
| DB content | `translations` JSONB column on `services` and `studios` tables |
| Emails | Inline TypeScript translation objects in `/lib/email-templates.ts` |
| Cancel page | Inline TypeScript translation objects in `/app/cancel/page.tsx` (uses booking's `language` DB field — cookie not reliable from email links) |

---

## Adding a Translation Key

### 1. Add the key to all three locale files

Translation files live in `/locales/`. All three files must always have the **same key structure** — missing keys cause runtime errors.

```jsonc
// locales/uk.json
"services": {
  "book_link": "Записатись →",
  "my_new_key": "Нове значення"   // ← add here
}

// locales/en.json
"services": {
  "book_link": "Book →",
  "my_new_key": "New value"       // ← same key, English text
}

// locales/he.json
"services": {
  "book_link": "הזמן →",
  "my_new_key": "ערך חדש"         // ← same key, Hebrew text
}
```

### 2. Use the key in a component

**Client component** (`'use client'`):

```tsx
import { useTranslations } from 'next-intl'

export function MyComponent() {
  const t = useTranslations('services')
  return <p>{t('my_new_key')}</p>
}
```

**Server component** (async, no `'use client'`):

```tsx
import { getTranslations } from 'next-intl/server'

export default async function MyPage() {
  const t = await getTranslations('services')
  return <p>{t('my_new_key')}</p>
}
```

### 3. Keys with interpolated variables

```jsonc
// locale file
"price_from": "від {price} ₪"
```

```tsx
t('price_from', { price: 150 })  // → "від 150 ₪"
```

---

## Key Naming Convention

Keys use `snake_case`. They are grouped by namespace (top-level object in the JSON).

```
namespace.key_name
namespace.sub_namespace.key_name
```

### Existing namespaces

| Namespace | Used by |
|---|---|
| `header` | `Header.tsx`, `LanguageSwitcher.tsx` |
| `hero` | `Hero.tsx` |
| `services` | `Services.tsx`, `ServicePicker.tsx`, `ServiceStudioBadge.tsx` |
| `studios` | `Studios.tsx`, `CitySelector.tsx` |
| `gallery` | `Gallery.tsx` |
| `contact` | `Contact.tsx` |
| `contact_form` | `ContactForm.tsx` |
| `footer` | `Footer.tsx` |
| `booking` | `BookingForm.tsx`, `DatePicker.tsx`, `TimePicker.tsx` |
| `booking_success` | `BookingSuccess.tsx` |
| `common` | Shared labels (save, cancel, loading…) used across admin |
| `admin` | `app/admin/page.tsx` — all admin panel tabs and panels |

### Key naming patterns

- Labels: `name_label`, `phone_label`
- Buttons: `save_btn`, `cancel_btn`, `edit_btn`
- Headings: `heading`, `detail_heading`
- Error messages: `error_load`, `error_network_save`
- ARIA labels: `section_aria`, `instagram_aria`
- Placeholders: `search_placeholder`
- Empty states: `no_clients`, `no_bookings`

---

## Adding a New Namespace

If a new component doesn't fit any existing namespace, create one:

1. Add a new top-level key to all three locale files simultaneously.
2. Use it via `useTranslations('my_namespace')` or `getTranslations('my_namespace')`.

There is no registration step — next-intl picks up any key present in the loaded JSON.

---

## Language Switcher

`/components/LanguageSwitcher.tsx` — client component, rendered in `Header.tsx`.

- Calls `setLocaleCookie(locale)` (server action in `/app/actions.ts`)
- Then calls `router.refresh()` to re-render server components with the new locale
- The `locale` cookie lasts 1 year (`maxAge: 60 * 60 * 24 * 365`)
- On first visit (no cookie), `Accept-Language` browser header is used; falls back to `uk`

---

## Locale Resolution Utility

`/lib/locale-utils.ts` exports `resolveLocale(value)` — used anywhere outside next-intl context (API routes, email templates):

```ts
import { resolveLocale } from '@/lib/locale-utils'

const locale = resolveLocale(booking.language)  // 'uk' | 'en' | 'he'
```

Returns `'uk'` for any unknown/null/undefined input.

---

## Cancel Page — Special Case

`/app/cancel/page.tsx` is visited from email links where the `locale` cookie is not guaranteed to exist (e.g., different browser, incognito). It reads the `language` column from the booking row and uses inline translation objects to display the correct language without depending on next-intl.

Do not refactor this page to use `getTranslations` — the cookie dependency would cause wrong-language UI for email-link visitors.

---

## Verify No Keys Are Missing

Run this script to confirm all three locale files have identical key sets:

```bash
node -e "
const uk = require('./locales/uk.json');
const en = require('./locales/en.json');
const he = require('./locales/he.json');

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? \`\${prefix}.\${k}\` : k;
    return typeof v === 'object' && v !== null ? keys(v, full) : [full];
  });
}

const ukKeys = new Set(keys(uk));
const enKeys = new Set(keys(en));
const heKeys = new Set(keys(he));

const missingInEn = [...ukKeys].filter(k => !enKeys.has(k));
const missingInHe = [...ukKeys].filter(k => !heKeys.has(k));
const extraInEn   = [...enKeys].filter(k => !ukKeys.has(k));
const extraInHe   = [...heKeys].filter(k => !ukKeys.has(k));

if (missingInEn.length) console.log('Missing in en.json:', missingInEn);
if (missingInHe.length) console.log('Missing in he.json:', missingInHe);
if (extraInEn.length)   console.log('Extra in en.json:',   extraInEn);
if (extraInHe.length)   console.log('Extra in he.json:',   extraInHe);
if (!missingInEn.length && !missingInHe.length && !extraInEn.length && !extraInHe.length)
  console.log('All locale files are in sync ✓ (' + ukKeys.size + ' keys)');
"
```

---

## Troubleshooting

**UI shows translation key instead of text** (e.g., `services.book_link` renders literally)
→ The key is missing from the loaded locale file. Add it to all three files.

**Language switcher has no effect**
→ Check that `setLocaleCookie` server action is running without error. The cookie name must be `locale` (matches `i18n/request.ts`).

**Page shows wrong language on first load**
→ Expected behaviour if `Accept-Language` doesn't match `uk/en/he`. The fallback is `uk`. Use the language switcher to set the cookie.

**Email arrives in wrong language**
→ The `language` column on the `bookings` table stores the locale at booking time. Check that `BookingForm.tsx` sends `language: locale` in the request payload, and that `/app/api/bookings/route.ts` writes it to the DB.

**Admin panel strings not translated**
→ Admin panel uses `useTranslations('admin')` and sub-namespaces like `admin.clients_panel`. Check the `admin` key in all three locale files.
