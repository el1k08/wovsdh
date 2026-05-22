import { supabaseAdmin } from '@/lib/supabase'
import { BookingStatus } from '@/lib/types'

// ---------------------------------------------------------------------------
// UI state components
// ---------------------------------------------------------------------------

function ErrorState({ message }: { message: string }) {
  return (
    <main
      style={{
        fontFamily: 'Arial, sans-serif',
        background: '#FAF6F3',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          background: 'white',
          borderRadius: '12px',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x274C;</div>
        <h1 style={{ color: '#3D3535', fontSize: '22px', marginBottom: '12px' }}>
          Помилка
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>{message}</p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '24px',
            background: 'linear-gradient(135deg, #C8968A, #C9A84C)',
            color: 'white',
            padding: '12px 28px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          На головну
        </a>
      </div>
    </main>
  )
}

function InfoState({ message }: { message: string }) {
  return (
    <main
      style={{
        fontFamily: 'Arial, sans-serif',
        background: '#FAF6F3',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          background: 'white',
          borderRadius: '12px',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x2139;&#xFE0F;</div>
        <h1 style={{ color: '#3D3535', fontSize: '22px', marginBottom: '12px' }}>
          Інформація
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>{message}</p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '24px',
            background: 'linear-gradient(135deg, #C8968A, #C9A84C)',
            color: 'white',
            padding: '12px 28px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          На головну
        </a>
      </div>
    </main>
  )
}

function SuccessState({ clientName }: { clientName: string }) {
  return (
    <main
      style={{
        fontFamily: 'Arial, sans-serif',
        background: '#FAF6F3',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          background: 'white',
          borderRadius: '12px',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x2705;</div>
        <h1 style={{ color: '#3D3535', fontSize: '22px', marginBottom: '12px' }}>
          Запис скасовано
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          {clientName}, ваш запис успішно скасовано. Будемо раді бачити вас знову!
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '24px',
            background: 'linear-gradient(135deg, #C8968A, #C9A84C)',
            color: 'white',
            padding: '12px 28px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Записатись знову
        </a>
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

  if (!token) {
    return <ErrorState message="Посилання для скасування недійсне." />
  }

  // Find booking by cancellation token
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select('id, status, client_first_name, studio_id')
    .eq('cancellation_token', token)
    .single()

  if (fetchError || !booking) {
    return <ErrorState message="Запис не знайдено." />
  }

  const typedBooking = booking as {
    id: string
    status: BookingStatus
    client_first_name: string
    studio_id: string
  }

  if (typedBooking.status === BookingStatus.Cancelled) {
    return <InfoState message="Цей запис вже було скасовано." />
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
    return (
      <ErrorState message="Не вдалося скасувати запис. Спробуйте пізніше або зв'яжіться з нами." />
    )
  }

  if (!res.ok) {
    return (
      <ErrorState message="Не вдалося скасувати запис. Спробуйте пізніше або зв'яжіться з нами." />
    )
  }

  return <SuccessState clientName={typedBooking.client_first_name} />
}
