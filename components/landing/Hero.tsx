import { getTranslations } from 'next-intl/server'
import Button from '@/components/ui/Button'

export default async function Hero() {
  const t = await getTranslations('hero')

  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, var(--color-cream) 0%, var(--color-blush) 50%, #EDD9D5 100%)',
      }}
      aria-label={t('banner_aria')}
    >
      {/* Decorative SVG — top-right petal cluster */}
      <svg
        className="pointer-events-none absolute top-8 right-0 w-72 opacity-25 md:w-96"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <ellipse cx="200" cy="120" rx="60" ry="110" fill="var(--color-rose)" transform="rotate(-20 200 120)" />
        <ellipse cx="280" cy="160" rx="50" ry="95" fill="var(--color-gold)" transform="rotate(30 280 160)" />
        <ellipse cx="150" cy="170" rx="45" ry="90" fill="var(--color-rose)" transform="rotate(10 150 170)" />
        <circle cx="220" cy="200" r="18" fill="var(--color-gold)" opacity="0.6" />
      </svg>

      {/* Decorative SVG — bottom-left lines */}
      <svg
        className="pointer-events-none absolute bottom-0 left-0 w-56 opacity-20 md:w-80"
        viewBox="0 0 320 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M0 280 Q80 200 160 240 Q240 280 320 180" stroke="var(--color-rose)" strokeWidth="2" />
        <path d="M0 300 Q80 220 160 260 Q240 300 320 200" stroke="var(--color-gold)" strokeWidth="1.5" />
        <path d="M0 320 Q80 240 160 280 Q240 320 320 220" stroke="var(--color-rose)" strokeWidth="1" />
        <circle cx="40" cy="60" r="30" stroke="var(--color-rose)" strokeWidth="1.5" fill="none" />
        <circle cx="40" cy="60" r="18" stroke="var(--color-gold)" strokeWidth="1" fill="none" />
        <circle cx="40" cy="60" r="5" fill="var(--color-rose)" />
      </svg>

      {/* Decorative floating dots */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/4 w-3 h-3 rounded-full opacity-30"
        style={{ background: 'var(--color-gold)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 right-1/3 w-2 h-2 rounded-full opacity-20"
        style={{ background: 'var(--color-rose)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-1/3 right-1/4 w-4 h-4 rounded-full opacity-20"
        style={{ background: 'var(--color-gold)' }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center pt-24 pb-16">
        {/* Eyebrow */}
        <p
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-[var(--color-rose)]"
          aria-label={t('eyebrow_aria')}
        >
          <span
            className="h-px w-8 inline-block"
            style={{ background: 'var(--color-rose)' }}
            aria-hidden="true"
          />
          {t('eyebrow')}
          <span
            className="h-px w-8 inline-block"
            style={{ background: 'var(--color-rose)' }}
            aria-hidden="true"
          />
        </p>

        {/* Main heading */}
        <h1
          className="mb-6 font-light leading-tight text-[var(--color-charcoal)]"
          style={{
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: 'clamp(2.5rem, 7vw, 5rem)',
            letterSpacing: '0.02em',
          }}
        >
          {t('title_line1')}
          <br />
          <span style={{ color: 'var(--color-rose)' }}>{t('title_line2')}</span>
        </h1>

        {/* Subheading */}
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[var(--color-charcoal)] opacity-80 sm:text-xl">
          {t('subtitle')}
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button as="a" href="#booking" variant="primary" size="lg">
            {t('cta_primary')}
          </Button>
          <Button as="a" href="#gallery" variant="secondary" size="lg">
            {t('cta_secondary')}
          </Button>
        </div>

        {/* Social proof strip */}
        <div className="mt-14 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-8">
          <div className="flex items-center gap-1.5 text-sm text-[var(--color-charcoal)] opacity-70">
            <span aria-hidden="true">★★★★★</span>
            <span>{t('social_proof_clients')}</span>
          </div>
          <span className="hidden sm:block h-4 w-px bg-[var(--color-rose)] opacity-40" aria-hidden="true" />
          <div className="text-sm text-[var(--color-charcoal)] opacity-70">
            {t('social_proof_studios')}
          </div>
          <span className="hidden sm:block h-4 w-px bg-[var(--color-rose)] opacity-40" aria-hidden="true" />
          <div className="text-sm text-[var(--color-charcoal)] opacity-70">
            {t('social_proof_online')}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40"
        aria-hidden="true"
      >
        <span className="text-xs tracking-widest uppercase text-[var(--color-charcoal)]">{t('scroll_label')}</span>
        <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
          <rect x="1" y="1" width="18" height="26" rx="9" stroke="var(--color-rose)" strokeWidth="1.5" />
          <circle cx="10" cy="8" r="3" fill="var(--color-rose)">
            <animate attributeName="cy" values="8;18;8" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
    </section>
  )
}
