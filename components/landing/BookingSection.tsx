'use client'

import BookingForm from '@/components/booking/BookingForm'

export default function BookingSection() {
  return (
    <section
      id="booking"
      className="py-20 md:py-28"
      style={{ background: 'var(--color-blush)' }}
      aria-labelledby="booking-heading"
    >
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[var(--color-rose)]">
            Онлайн запись
          </p>
          <h2
            id="booking-heading"
            className="mb-4 font-light text-[var(--color-charcoal)]"
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            Запись онлайн
          </h2>
          <p className="mx-auto max-w-lg text-base text-[var(--color-charcoal)] opacity-70 leading-relaxed">
            Выберите студию, удобное время и оставьте контакты
          </p>
        </div>

        {/* Booking form */}
        <div
          id="booking-form"
          className="rounded-2xl border border-[var(--color-rose)] border-opacity-30 bg-white p-6 sm:p-8 shadow-sm"
          role="region"
          aria-label="Форма записи на приём"
        >
          {/* No-JS fallback */}
          <noscript>
            <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-6">
              Для работы формы необходимо включить JavaScript. Позвоните нам или напишите в WhatsApp для записи.
            </p>
          </noscript>

          <BookingForm />
        </div>

        {/* Trust indicators */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-8 text-sm text-[var(--color-charcoal)] opacity-60">
          <span>Подтверждение по SMS/WhatsApp</span>
          <span className="hidden sm:block h-3 w-px bg-current" aria-hidden="true" />
          <span>Бесплатная отмена за 24 ч</span>
          <span className="hidden sm:block h-3 w-px bg-current" aria-hidden="true" />
          <span>Запись доступна 24/7</span>
        </div>
      </div>
    </section>
  )
}
