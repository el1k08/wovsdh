import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

export default async function Gallery() {
  const t = await getTranslations('gallery')

  const galleryImages = Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    src: `https://picsum.photos/seed/nails${i + 10}/400/400`,
    alt: t('image_alt', { n: i + 1 }),
  }))

  return (
    <section
      id="gallery"
      className="py-20 md:py-28"
      style={{ background: 'var(--color-blush)' }}
      aria-labelledby="gallery-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[var(--color-rose)]">
            {t('eyebrow')}
          </p>
          <h2
            id="gallery-heading"
            className="mb-4 font-light text-[var(--color-charcoal)]"
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            {t('heading')}
          </h2>
          <p className="mx-auto max-w-xl text-base text-[var(--color-charcoal)] opacity-70 leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Gallery grid */}
        <ul
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
          role="list"
          aria-label={t('aria_list')}
        >
          {galleryImages.map((image) => (
            <li key={image.id} className="group relative aspect-square overflow-hidden rounded-xl">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 400px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    'linear-gradient(to top, rgba(200,150,138,0.6) 0%, transparent 60%)',
                }}
                aria-hidden="true"
              />
            </li>
          ))}
        </ul>

        {/* CTA below gallery */}
        <div className="mt-12 text-center">
          <p className="mb-4 text-sm text-[var(--color-charcoal)] opacity-60">
            {t('instagram_cta')}
          </p>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-rose)] px-6 py-3 text-sm font-medium text-[var(--color-rose)] hover:bg-[var(--color-blush)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)]"
            aria-label={t('instagram_aria')}
          >
            {/* Instagram inline SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            {t('instagram_btn')}
          </a>
        </div>
      </div>
    </section>
  )
}
