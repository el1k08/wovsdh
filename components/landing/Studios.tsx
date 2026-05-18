import Image from 'next/image'
import { MapPin, Clock } from 'lucide-react'

interface StudioData {
  id: string
  city: string
  address: string
  addressLine2: string
  hours: string[]
  imageSeed: string
  imageAlt: string
}

const studios: StudioData[] = [
  {
    id: 'rishon',
    city: 'Ришон-ле-Цион',
    address: 'ул. Ротшильд, 12',
    addressLine2: 'Ришон-ле-Цион, Израиль',
    hours: [
      'Воскресенье — четверг: 9:00–20:00',
      'Пятница: 9:00–15:00',
      'Суббота: выходной',
    ],
    imageSeed: 'salon1',
    imageAlt: 'Интерьер студии WOVSDH Nails в Ришон-ле-Цион',
  },
  {
    id: 'ashdod',
    city: 'Ашдод',
    address: 'ул. ха-Менора, 35',
    addressLine2: 'Ашдод, Израиль',
    hours: [
      'Воскресенье — четверг: 9:00–20:00',
      'Пятница: 9:00–14:00',
      'Суббота: выходной',
    ],
    imageSeed: 'salon2',
    imageAlt: 'Интерьер студии WOVSDH Nails в Ашдоде',
  },
]

export default function Studios() {
  return (
    <section
      id="studios"
      className="py-20 md:py-28"
      style={{ background: 'var(--color-cream)' }}
      aria-labelledby="studios-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[var(--color-rose)]">
            Два города — одно качество
          </p>
          <h2
            id="studios-heading"
            className="mb-4 font-light text-[var(--color-charcoal)]"
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            Наши студии
          </h2>
          <p className="mx-auto max-w-xl text-base text-[var(--color-charcoal)] opacity-70 leading-relaxed">
            Уютные студии в центре города с комфортной атмосферой и профессиональными мастерами
          </p>
        </div>

        {/* Studios list */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {studios.map((studio) => (
            <article
              key={studio.id}
              className="overflow-hidden rounded-2xl border border-[var(--color-blush)] bg-white shadow-sm"
              aria-label={`Студия в ${studio.city}`}
            >
              {/* Studio photo */}
              <div className="relative h-56 w-full sm:h-64">
                <Image
                  src={`https://picsum.photos/seed/${studio.imageSeed}/800/400`}
                  alt={studio.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  loading="lazy"
                />
                {/* City badge */}
                <div
                  className="absolute top-4 left-4 rounded-full px-4 py-1.5 text-sm font-medium text-white shadow"
                  style={{
                    background:
                      'linear-gradient(to right, var(--color-rose), var(--color-gold))',
                  }}
                >
                  {studio.city}
                </div>
              </div>

              {/* Studio info */}
              <div className="p-6">
                <h3
                  className="mb-4 font-semibold text-[var(--color-charcoal)]"
                  style={{
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: '1.5rem',
                  }}
                >
                  {studio.city}
                </h3>

                {/* Address */}
                <div className="mb-3 flex items-start gap-3">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: 'var(--color-rose)' }}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-charcoal)]">
                      {studio.address}
                    </p>
                    <p className="text-sm text-[var(--color-charcoal)] opacity-60">
                      {studio.addressLine2}
                    </p>
                  </div>
                </div>

                {/* Working hours */}
                <div className="mb-6 flex items-start gap-3">
                  <Clock
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: 'var(--color-rose)' }}
                    aria-hidden="true"
                  />
                  <ul
                    className="text-sm text-[var(--color-charcoal)] opacity-70 space-y-0.5"
                    aria-label="Часы работы"
                  >
                    {studio.hours.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>

                {/* CTA button */}
                <a
                  href={`#booking`}
                  data-studio={studio.id}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-rose)] px-6 py-3 text-sm font-medium text-[var(--color-rose)] transition-all duration-200 hover:bg-gradient-to-r hover:from-[var(--color-rose)] hover:to-[var(--color-gold)] hover:text-white hover:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)] focus-visible:ring-offset-2"
                  aria-label={`Записаться в студию ${studio.city}`}
                >
                  Записаться в эту студию
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
