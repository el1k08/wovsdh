/**
 * HTML email templates for booking notifications.
 * All dates are formatted using Intl with timeZone 'Asia/Jerusalem'.
 * Language-specific strings are defined inline per locale.
 */

type EmailLocale = 'uk' | 'en' | 'he'

const TZ = 'Asia/Jerusalem'

// Map our locale codes to Intl-compatible locale strings for date formatting
const INTL_LOCALE: Record<EmailLocale, string> = {
  uk: 'uk-UA',
  en: 'en-US',
  he: 'he-IL',
}

// ---------------------------------------------------------------------------
// Translation strings
// ---------------------------------------------------------------------------

interface ConfirmationStrings {
  subject: string
  header_tagline: string
  greeting: (name: string) => string
  intro: string
  details_heading: string
  studio_label: string
  date_label: string
  time_label: string
  gcal_btn: string
  ics_btn: string
  cancel_prompt: string
  cancel_link_text: string
  footer: string
  // plain-text fallbacks
  text_greeting: (name: string) => string
  text_intro: string
  text_studio: string
  text_date: string
  text_time: string
}

interface CancellationStrings {
  subject: string
  header_tagline: string
  greeting: (name: string) => string
  intro: string
  details_heading: string
  studio_label: string
  date_label: string
  time_label: string
  rebook_prompt: string
  rebook_btn: string
  footer: string
  text_greeting: (name: string) => string
  text_intro: string
  text_studio: string
  text_date: string
  text_time: string
}

const CONFIRMATION: Record<EmailLocale, ConfirmationStrings> = {
  uk: {
    subject: 'Ваш запис підтверджено! — WOVSDH Nails',
    header_tagline: 'Ваш запис підтверджено! &#x2705;',
    greeting: (name) => `Вітаємо, <strong>${name}</strong>!`,
    intro: 'Ваш запис успішно підтверджено. Чекаємо на вас!',
    details_heading: 'Деталі запису',
    studio_label: '&#x1F4CD; Студія',
    date_label: '&#x1F4C5; Дата',
    time_label: '&#x23F0; Час',
    gcal_btn: '&#x1F4C5; Додати до Google Calendar',
    ics_btn: '&#x1F4E5; Завантажити .ics файл',
    cancel_prompt: 'Якщо ви хочете скасувати запис:',
    cancel_link_text: 'Скасувати запис',
    footer: '&#xa9; 2025 WOVSDH Nails. Всі права захищені.',
    text_greeting: (name) => `Вітаємо, ${name}!`,
    text_intro: 'Ваш запис успішно підтверджено.',
    text_studio: 'Студія',
    text_date: 'Дата',
    text_time: 'Час',
  },
  en: {
    subject: 'Your booking is confirmed! — WOVSDH Nails',
    header_tagline: 'Your booking is confirmed! &#x2705;',
    greeting: (name) => `Hello, <strong>${name}</strong>!`,
    intro: 'Your appointment has been confirmed. We look forward to seeing you!',
    details_heading: 'Booking details',
    studio_label: '&#x1F4CD; Studio',
    date_label: '&#x1F4C5; Date',
    time_label: '&#x23F0; Time',
    gcal_btn: '&#x1F4C5; Add to Google Calendar',
    ics_btn: '&#x1F4E5; Download .ics file',
    cancel_prompt: 'Need to cancel your appointment?',
    cancel_link_text: 'Cancel booking',
    footer: '&#xa9; 2025 WOVSDH Nails. All rights reserved.',
    text_greeting: (name) => `Hello, ${name}!`,
    text_intro: 'Your appointment has been confirmed.',
    text_studio: 'Studio',
    text_date: 'Date',
    text_time: 'Time',
  },
  he: {
    subject: 'התור שלך אושר! — WOVSDH Nails',
    header_tagline: 'התור שלך אושר! &#x2705;',
    greeting: (name) => `שלום, <strong>${name}</strong>!`,
    intro: 'התור שלך אושר בהצלחה. מחכים לך!',
    details_heading: 'פרטי התור',
    studio_label: '&#x1F4CD; סטודיו',
    date_label: '&#x1F4C5; תאריך',
    time_label: '&#x23F0; שעה',
    gcal_btn: '&#x1F4C5; הוסף ל-Google Calendar',
    ics_btn: '&#x1F4E5; הורד קובץ .ics',
    cancel_prompt: 'רוצה לבטל את התור?',
    cancel_link_text: 'ביטול תור',
    footer: '&#xa9; 2025 WOVSDH Nails. כל הזכויות שמורות.',
    text_greeting: (name) => `שלום, ${name}!`,
    text_intro: 'התור שלך אושר בהצלחה.',
    text_studio: 'סטודיו',
    text_date: 'תאריך',
    text_time: 'שעה',
  },
}

const CANCELLATION: Record<EmailLocale, CancellationStrings> = {
  uk: {
    subject: 'Ваш запис скасовано — WOVSDH Nails',
    header_tagline: 'Запис скасовано',
    greeting: (name) => `Вітаємо, <strong>${name}</strong>!`,
    intro: 'Ваш запис було успішно скасовано.',
    details_heading: 'Скасований запис',
    studio_label: '&#x1F4CD; Студія',
    date_label: '&#x1F4C5; Дата',
    time_label: '&#x23F0; Час',
    rebook_prompt: 'Бажаєте записатися знову?',
    rebook_btn: 'Записатися знову',
    footer: '&#xa9; 2025 WOVSDH Nails. Всі права захищені.',
    text_greeting: (name) => `Вітаємо, ${name}!`,
    text_intro: 'Ваш запис було успішно скасовано.',
    text_studio: 'Студія',
    text_date: 'Дата',
    text_time: 'Час',
  },
  en: {
    subject: 'Your booking has been cancelled — WOVSDH Nails',
    header_tagline: 'Booking cancelled',
    greeting: (name) => `Hello, <strong>${name}</strong>!`,
    intro: 'Your appointment has been successfully cancelled.',
    details_heading: 'Cancelled booking',
    studio_label: '&#x1F4CD; Studio',
    date_label: '&#x1F4C5; Date',
    time_label: '&#x23F0; Time',
    rebook_prompt: 'Would you like to book again?',
    rebook_btn: 'Book again',
    footer: '&#xa9; 2025 WOVSDH Nails. All rights reserved.',
    text_greeting: (name) => `Hello, ${name}!`,
    text_intro: 'Your appointment has been successfully cancelled.',
    text_studio: 'Studio',
    text_date: 'Date',
    text_time: 'Time',
  },
  he: {
    subject: 'התור שלך בוטל — WOVSDH Nails',
    header_tagline: 'התור בוטל',
    greeting: (name) => `שלום, <strong>${name}</strong>!`,
    intro: 'התור שלך בוטל בהצלחה.',
    details_heading: 'תור שבוטל',
    studio_label: '&#x1F4CD; סטודיו',
    date_label: '&#x1F4C5; תאריך',
    time_label: '&#x23F0; שעה',
    rebook_prompt: 'רוצה לקבוע תור מחדש?',
    rebook_btn: 'קביעת תור מחדש',
    footer: '&#xa9; 2025 WOVSDH Nails. כל הזכויות שמורות.',
    text_greeting: (name) => `שלום, ${name}!`,
    text_intro: 'התור שלך בוטל בהצלחה.',
    text_studio: 'סטודיו',
    text_date: 'תאריך',
    text_time: 'שעה',
  },
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatDate(isoUtc: string, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoUtc))
}

function formatTime(startIso: string, endIso: string, locale: EmailLocale): string {
  const timeFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${timeFmt.format(new Date(startIso))} – ${timeFmt.format(new Date(endIso))}`
}

function resolveLocale(raw: string | undefined): EmailLocale {
  if (raw === 'en' || raw === 'he') return raw
  return 'uk'
}

// ---------------------------------------------------------------------------
// Google Calendar link builder
// ---------------------------------------------------------------------------

function toGcalDate(isoUtc: string): string {
  return new Date(isoUtc)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

const GCAL_EVENT_TITLE: Record<EmailLocale, string> = {
  uk: 'Запис у WOVSDH Nails',
  en: 'Appointment at WOVSDH Nails',
  he: 'תור ב-WOVSDH Nails',
}

const GCAL_STUDIO_PREFIX: Record<EmailLocale, string> = {
  uk: 'Студія',
  en: 'Studio',
  he: 'סטודיו',
}

function buildGoogleCalendarLink(params: {
  studioName: string
  startAt: string
  endAt: string
  locale: EmailLocale
}): string {
  const { studioName, startAt, endAt, locale } = params
  const dates = `${toGcalDate(startAt)}/${toGcalDate(endAt)}`
  const details = encodeURIComponent(`${GCAL_STUDIO_PREFIX[locale]}: ${studioName}`)
  const location = encodeURIComponent(studioName)
  const text = encodeURIComponent(GCAL_EVENT_TITLE[locale])
  return (
    `https://www.google.com/calendar/render?action=TEMPLATE` +
    `&text=${text}` +
    `&dates=${dates}` +
    `&details=${details}` +
    `&location=${location}`
  )
}

// ---------------------------------------------------------------------------
// Confirmation email
// ---------------------------------------------------------------------------

export interface ConfirmationEmailParams {
  clientName: string
  studioName: string
  startAt: string
  endAt: string
  cancellationToken: string
  bookingId: string
  locale?: string
}

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export function buildConfirmationEmail(params: ConfirmationEmailParams): EmailContent {
  const { clientName, studioName, startAt, endAt, cancellationToken, bookingId } = params
  const locale = resolveLocale(params.locale)
  const s = CONFIRMATION[locale]

  const formattedDate = formatDate(startAt, locale)
  const formattedTime = formatTime(startAt, endAt, locale)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cancellationLink = `${appUrl}/cancel?token=${cancellationToken}`
  const icsLink = `${appUrl}/api/calendar/ics?booking_id=${bookingId}`
  const googleCalendarLink = buildGoogleCalendarLink({ studioName, startAt, endAt, locale })

  const html = `<!DOCTYPE html>
<html${locale === 'he' ? ' dir="rtl"' : ''}>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #FAF6F3; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #C8968A, #C9A84C); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">WOVSDH Nails</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">${s.header_tagline}</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #3D3535;">${s.greeting(clientName)}</p>
      <p style="color: #666;">${s.intro}</p>

      <!-- Details block -->
      <div style="background: #F4E4E1; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px; color: #3D3535;">${s.details_heading}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #666; width: 40%;">${s.studio_label}</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${studioName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666;">${s.date_label}</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666;">${s.time_label}</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${formattedTime}</td>
          </tr>
        </table>
      </div>

      <!-- Calendar buttons -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${googleCalendarLink}" target="_blank"
           style="display: inline-block; background: #4285F4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 8px 12px; font-size: 14px;">
          ${s.gcal_btn}
        </a>
        <a href="${icsLink}"
           style="display: inline-block; background: #34A853; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 8px 12px; font-size: 14px;">
          ${s.ics_btn}
        </a>
      </div>

      <!-- Cancel link -->
      <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center;">
        <p style="color: #999; font-size: 14px;">${s.cancel_prompt}</p>
        <a href="${cancellationLink}"
           style="color: #C8968A; font-size: 14px; text-decoration: underline;">
          ${s.cancel_link_text}
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #F4E4E1; padding: 20px; text-align: center;">
      <p style="color: #999; font-size: 12px; margin: 0;">${s.footer}</p>
    </div>
  </div>
</body>
</html>`

  const text =
    `${s.text_greeting(clientName)}\n\n` +
    `${s.text_intro}\n\n` +
    `${s.text_studio}: ${studioName}\n` +
    `${s.text_date}: ${formattedDate}\n` +
    `${s.text_time}: ${formattedTime}\n\n` +
    `${s.gcal_btn.replace(/&#x[0-9A-Fa-f]+;/g, '').trim()}: ${googleCalendarLink}\n` +
    `${s.ics_btn.replace(/&#x[0-9A-Fa-f]+;/g, '').trim()}: ${icsLink}\n\n` +
    `${s.cancel_link_text}: ${cancellationLink}\n\n` +
    `${s.footer.replace(/&#xa9;/g, '©').replace(/&#x[0-9A-Fa-f]+;/g, '').trim()}`

  return { subject: s.subject, html, text }
}

// ---------------------------------------------------------------------------
// Cancellation email
// ---------------------------------------------------------------------------

export interface CancellationEmailParams {
  clientName: string
  studioName: string
  startAt: string
  endAt: string
  locale?: string
}

export function buildCancellationEmail(params: CancellationEmailParams): EmailContent {
  const { clientName, studioName, startAt, endAt } = params
  const locale = resolveLocale(params.locale)
  const s = CANCELLATION[locale]

  const formattedDate = formatDate(startAt, locale)
  const formattedTime = formatTime(startAt, endAt, locale)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const html = `<!DOCTYPE html>
<html${locale === 'he' ? ' dir="rtl"' : ''}>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #FAF6F3; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #C8968A, #C9A84C); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">WOVSDH Nails</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">${s.header_tagline}</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #3D3535;">${s.greeting(clientName)}</p>
      <p style="color: #666;">${s.intro}</p>

      <!-- Cancelled details block -->
      <div style="background: #F4E4E1; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px; color: #3D3535;">${s.details_heading}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #666; width: 40%;">${s.studio_label}</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${studioName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666;">${s.date_label}</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666;">${s.time_label}</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${formattedTime}</td>
          </tr>
        </table>
      </div>

      <!-- Book again -->
      <div style="text-align: center; margin: 24px 0;">
        <p style="color: #666; margin-bottom: 16px;">${s.rebook_prompt}</p>
        <a href="${appUrl}"
           style="display: inline-block; background: linear-gradient(135deg, #C8968A, #C9A84C); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: bold;">
          ${s.rebook_btn}
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #F4E4E1; padding: 20px; text-align: center;">
      <p style="color: #999; font-size: 12px; margin: 0;">${s.footer}</p>
    </div>
  </div>
</body>
</html>`

  const text =
    `${s.text_greeting(clientName)}\n\n` +
    `${s.text_intro}\n\n` +
    `${s.text_studio}: ${studioName}\n` +
    `${s.text_date}: ${formattedDate}\n` +
    `${s.text_time}: ${formattedTime}\n\n` +
    `${s.rebook_prompt} ${appUrl}\n\n` +
    `${s.footer.replace(/&#xa9;/g, '©').replace(/&#x[0-9A-Fa-f]+;/g, '').trim()}`

  return { subject: s.subject, html, text }
}
