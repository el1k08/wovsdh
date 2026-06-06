import { getTranslations } from 'next-intl/server'
import BookingForm from '@/components/booking/BookingForm'

export default async function BookingSection() {
  const t = await getTranslations('booking')

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
            {t('section_eyebrow')}
          </p>
          <h2
            id="booking-heading"
            className="mb-4 font-light text-[var(--color-charcoal)]"
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            {t('section_heading')}
          </h2>
          <p className="mx-auto max-w-lg text-base text-[var(--color-charcoal)] opacity-70 leading-relaxed">
            {t('section_subtitle')}
          </p>
        </div>

        {/* Booking form */}
        <div
          id="booking-form"
          className="rounded-2xl border border-[var(--color-rose)] border-opacity-30 bg-white p-6 sm:p-8 shadow-sm"
          role="region"
          aria-label={t('form_aria')}
        >
          {/* No-JS fallback */}
          <noscript>
            <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-6">
              {t('noscript')}
            </p>
          </noscript>

          <BookingForm />
        </div>

        {/* Trust indicators */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-8 text-sm text-[var(--color-charcoal)] opacity-60">
          <span>{t('trust_email')}</span>
          <span className="hidden sm:block h-3 w-px bg-current" aria-hidden="true" />
          <span>{t('trust_cancel')}</span>
          <span className="hidden sm:block h-3 w-px bg-current" aria-hidden="true" />
          <span>{t('trust_247')}</span>
        </div>
      </div>
    </section>
  )
}
