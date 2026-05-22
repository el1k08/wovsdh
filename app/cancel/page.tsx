import { supabaseAdmin } from '@/lib/supabase'
import { BookingStatus } from '@/lib/types'

// ---------------------------------------------------------------------------
// Inline translations — cancel page is visited from email links where the
// locale cookie may not be present, so we use the booking's language field.
// ---------------------------------------------------------------------------

type CancelLocale = 'uk' | 'en' | 'he'

const T: Record<CancelLocale, {
  error_heading: string
  info_heading: string
  success_heading: string
  home_btn: string
  rebook_btn: string
  invalid_token: string
  not_found: string
  already_cancelled: string
  cancel_failed: string
  success_msg: (name: string) => string
}> = {
  uk: {
    error_heading: 'Помилка',
    info_heading: 'Інформація',
    success_heading: 'Запис скасовано',
    home_btn: 'На головну',
    rebook_btn: 'Записатись знову',
    invalid_token: 'Посилання для скасування недійсне.',
    not_found: 'Запис не знайдено.',
    already_cancelled: 'Цей запис вже було скасовано.',
    cancel_failed: "Не вдалося скасувати запис. Спробуйте пізніше або зв'яжіться з нами.",
    success_msg: (name) => `${name}, ваш запис успішно скасовано. Будемо раді бачити вас знову!`,
  },
  en: {
    error_heading: 'Error',
    info_heading: 'Information',
    success_heading: 'Booking Cancelled',
    home_btn: 'Back to Home',
    rebook_btn: 'Book Again',
    invalid_token: 'Cancellation link is invalid.',
    not_found: 'Booking not found.',
    already_cancelled: 'This booking has already been cancelled.',
    cancel_failed: 'Could not cancel booking. Please try again later or contact us.',
    success_msg: (name) => `${name}, your booking has been successfully cancelled. We'd love to see you again!`,
  },
  he: {
    error_heading: 'שגיאה',
    info_heading: 'מידע',
    success_heading: 'ההזמנה בוטלה',
    home_btn: 'חזרה לדף הבית',
    rebook_btn: 'הזמן שוב',
    invalid_token: 'קישור הביטול אינו תקף.',
    not_found: 'ההזמנה לא נמצאה.',
    already_cancelled: 'ההזמנה כבר בוטלה.',
    cancel_failed: 'לא ניתן לבטל את ההזמנה. אנא נסה שוב מאוחר יותר או צור קשר.',
    success_msg: (name) => `${name}, ההזמנה שלך בוטלה בהצלחה. נשמח לראותך שוב!`,
  },
}

function resolveLocale(lang: string | null | undefined): CancelLocale {
  if (lang === 'en' || lang === 'he') return lang
  return 'uk'
}

// ---------------------------------------------------------------------------
// UI state components
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  maxWidth: '480px',
  width: '100%',
  background: 'white',
  borderRadius: '12px',
  padding: '40px 32px',
  textAlign: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}

const pageStyle: React.CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  background: '#FAF6F3',
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
}

const btnStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '24px',
  background: 'linear-gradient(135deg, #C8968A, #C9A84C)',
  color: 'white',
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 'bold',
}

function ErrorState({ heading, message, btnLabel }: { heading: string; message: string; btnLabel: string }) {
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x274C;</div>
        <h1 style={{ color: '#3D3535', fontSize: '22px', marginBottom: '12px' }}>{heading}</h1>
        <p style={{ color: '#666', fontSize: '16px' }}>{message}</p>
        <a href="/" style={btnStyle}>{btnLabel}</a>
      </div>
    </main>
  )
}

function InfoState({ heading, message, btnLabel }: { heading: string; message: string; btnLabel: string }) {
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x2139;&#xFE0F;</div>
        <h1 style={{ color: '#3D3535', fontSize: '22px', marginBottom: '12px' }}>{heading}</h1>
        <p style={{ color: '#666', fontSize: '16px' }}>{message}</p>
        <a href="/" style={btnStyle}>{btnLabel}</a>
      </div>
    </main>
  )
}

function SuccessState({ heading, message, btnLabel }: { heading: string; message: string; btnLabel: string }) {
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x2705;</div>
        <h1 style={{ color: '#3D3535', fontSize: '22px', marginBottom: '12px' }}>{heading}</h1>
        <p style={{ color: '#666', fontSize: '16px' }}>{message}</p>
        <a href="/" style={btnStyle}>{btnLabel}</a>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Page — Server Component
// ---------------------------------------------------------------------------

export default async function CancelPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  // No token — we don't know the booking language yet, default to uk
  if (!token) {
    const tr = T.uk
    return <ErrorState heading={tr.error_heading} message={tr.invalid_token} btnLabel={tr.home_btn} />
  }

  // Find booking by cancellation token — include language field
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select('id, status, client_first_name, studio_id, language')
    .eq('cancellation_token', token)
    .single()

  if (fetchError || !booking) {
    return <ErrorState heading={T.uk.error_heading} message={T.uk.not_found} btnLabel={T.uk.home_btn} />
  }

  const typedBooking = booking as {
    id: string
    status: BookingStatus
    client_first_name: string
    studio_id: string
    language: string | null
  }

  const locale = resolveLocale(typedBooking.language)
  const tr = T[locale]

  if (typedBooking.status === BookingStatus.Cancelled) {
    return <InfoState heading={tr.info_heading} message={tr.already_cancelled} btnLabel={tr.home_btn} />
  }

  // Perform cancellation via internal API
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  let res: Response
  try {
    res = await fetch(`${appUrl}/api/bookings/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })
  } catch {
    return <ErrorState heading={tr.error_heading} message={tr.cancel_failed} btnLabel={tr.home_btn} />
  }

  if (!res.ok) {
    return <ErrorState heading={tr.error_heading} message={tr.cancel_failed} btnLabel={tr.home_btn} />
  }

  return (
    <SuccessState
      heading={tr.success_heading}
      message={tr.success_msg(typedBooking.client_first_name)}
      btnLabel={tr.rebook_btn}
    />
  )
}
