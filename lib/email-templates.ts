/**
 * HTML email templates for booking notifications.
 * All dates are formatted using Intl with locale 'uk-IL' and timeZone 'Asia/Jerusalem'.
 */

const TZ = 'Asia/Jerusalem'
const LOCALE = 'uk-IL'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatDate(isoUtc: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoUtc))
}

function formatTime(startIso: string, endIso: string): string {
  const timeFmt = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${timeFmt.format(new Date(startIso))} – ${timeFmt.format(new Date(endIso))}`
}

// ---------------------------------------------------------------------------
// Google Calendar link builder
// ---------------------------------------------------------------------------

function toGcalDate(isoUtc: string): string {
  // Format: YYYYMMDDTHHmmssZ
  return new Date(isoUtc)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function buildGoogleCalendarLink(params: {
  studioName: string
  startAt: string
  endAt: string
}): string {
  const { studioName, startAt, endAt } = params
  const dates = `${toGcalDate(startAt)}/${toGcalDate(endAt)}`
  const details = encodeURIComponent(`Студія: ${studioName}`)
  const location = encodeURIComponent(studioName)
  const text = encodeURIComponent('Запис у WOVSDH Nails')
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
}

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export function buildConfirmationEmail(params: ConfirmationEmailParams): EmailContent {
  const { clientName, studioName, startAt, endAt, cancellationToken, bookingId } = params

  const formattedDate = formatDate(startAt)
  const formattedTime = formatTime(startAt, endAt)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cancellationLink = `${appUrl}/cancel?token=${cancellationToken}`
  const icsLink = `${appUrl}/api/calendar/ics?booking_id=${bookingId}`
  const googleCalendarLink = buildGoogleCalendarLink({ studioName, startAt, endAt })

  const subject = 'Ваш запис підтверджено! — WOVSDH Nails'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #FAF6F3; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #C8968A, #C9A84C); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">WOVSDH Nails</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Ваш запис підтверджено! &#x2705;</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #3D3535;">Вітаємо, <strong>${clientName}</strong>!</p>
      <p style="color: #666;">Ваш запис успішно підтверджено. Чекаємо на вас!</p>

      <!-- Details block -->
      <div style="background: #F4E4E1; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px; color: #3D3535;">Деталі запису</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #666; width: 40%;">&#x1F4CD; Студія</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${studioName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666;">&#x1F4C5; Дата</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666;">&#x23F0; Час</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${formattedTime}</td>
          </tr>
        </table>
      </div>

      <!-- Buttons -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${googleCalendarLink}" target="_blank"
           style="display: inline-block; background: #4285F4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 8px 12px; font-size: 14px;">
          &#x1F4C5; Додати до Google Calendar
        </a>
        <a href="${icsLink}"
           style="display: inline-block; background: #34A853; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 8px 12px; font-size: 14px;">
          &#x1F4E5; Завантажити .ics файл
        </a>
      </div>

      <!-- Cancel link -->
      <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center;">
        <p style="color: #999; font-size: 14px;">Якщо ви хочете скасувати запис:</p>
        <a href="${cancellationLink}"
           style="color: #C8968A; font-size: 14px; text-decoration: underline;">
          Скасувати запис
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #F4E4E1; padding: 20px; text-align: center;">
      <p style="color: #999; font-size: 12px; margin: 0;">&#xa9; 2025 WOVSDH Nails. Всі права захищені.</p>
    </div>
  </div>
</body>
</html>`

  const text =
    `Вітаємо, ${clientName}!\n\n` +
    `Ваш запис успішно підтверджено.\n\n` +
    `Студія: ${studioName}\n` +
    `Дата: ${formattedDate}\n` +
    `Час: ${formattedTime}\n\n` +
    `Додати до Google Calendar: ${googleCalendarLink}\n` +
    `Завантажити .ics файл: ${icsLink}\n\n` +
    `Скасувати запис: ${cancellationLink}\n\n` +
    `© 2025 WOVSDH Nails`

  return { subject, html, text }
}

// ---------------------------------------------------------------------------
// Cancellation email
// ---------------------------------------------------------------------------

export interface CancellationEmailParams {
  clientName: string
  studioName: string
  startAt: string
  endAt: string
}

export function buildCancellationEmail(params: CancellationEmailParams): EmailContent {
  const { clientName, studioName, startAt, endAt } = params

  const formattedDate = formatDate(startAt)
  const formattedTime = formatTime(startAt, endAt)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const bookingLink = `${appUrl}`

  const subject = 'Ваш запис скасовано — WOVSDH Nails'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #FAF6F3; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #C8968A, #C9A84C); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">WOVSDH Nails</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Запис скасовано</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #3D3535;">Вітаємо, <strong>${clientName}</strong>!</p>
      <p style="color: #666;">Ваш запис було успішно скасовано.</p>

      <!-- Cancelled details block -->
      <div style="background: #F4E4E1; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px; color: #3D3535;">Скасований запис</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #666; width: 40%;">&#x1F4CD; Студія</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${studioName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666;">&#x1F4C5; Дата</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666;">&#x23F0; Час</td>
            <td style="padding: 6px 0; color: #3D3535; font-weight: bold;">${formattedTime}</td>
          </tr>
        </table>
      </div>

      <!-- Book again -->
      <div style="text-align: center; margin: 24px 0;">
        <p style="color: #666; margin-bottom: 16px;">Бажаєте записатися знову?</p>
        <a href="${bookingLink}"
           style="display: inline-block; background: linear-gradient(135deg, #C8968A, #C9A84C); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: bold;">
          Записатися знову
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #F4E4E1; padding: 20px; text-align: center;">
      <p style="color: #999; font-size: 12px; margin: 0;">&#xa9; 2025 WOVSDH Nails. Всі права захищені.</p>
    </div>
  </div>
</body>
</html>`

  const text =
    `Вітаємо, ${clientName}!\n\n` +
    `Ваш запис було успішно скасовано.\n\n` +
    `Студія: ${studioName}\n` +
    `Дата: ${formattedDate}\n` +
    `Час: ${formattedTime}\n\n` +
    `Бажаєте записатися знову? ${bookingLink}\n\n` +
    `© 2025 WOVSDH Nails`

  return { subject, html, text }
}
