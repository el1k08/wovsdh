import Image from 'next/image'
import { MapPin, Clock } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'
import type { Studio } from '@/lib/types'

const IMAGE_SEEDS: Record<string, string> = {
  rishon: 'salon1',
  ashdod: 'salon2',
}

export default async function Studios() {
  const { data: studiosData } = await supabaseAdmin
    .from('studios')
    .select('id, name, city, street, schedule_text, image_url, sort_order')
    .order('sort_order', { ascending: true })
  const studios = (studiosData ?? []) as Array<Studio & { name: string }>
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
            Два міста — одна якість
          </p>
          <h2
            id="studios-heading"
            className="mb-4 font-light text-[var(--color-charcoal)]"
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            Наші студії
          </h2>
          <p className="mx-auto max-w-xl text-base text-[var(--color-charcoal)] opacity-70 leading-relaxed">
            Затишні студії в центрі міста з комфортною атмосферою та професійними майстрами
          </p>
        </div>

        {/* Studios list */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {studios.map((studio) => {
            const imageSeed = IMAGE_SEEDS[studio.id] ?? studio.id
            const imageAlt = `Інтер'єр студії WOVSDH Nails у ${studio.city}`
            return (
              <article
                key={studio.id}
                className="overflow-hidden rounded-2xl border border-[var(--color-blush)] bg-white shadow-sm"
                aria-label={`Студія у ${studio.city}`}
              >
                {/* Studio photo */}
                <div className="relative h-56 w-full sm:h-64">
                  <Image
                    src={studio.image_url ?? `https://picsum.photos/seed/${imageSeed}/800/400`}
                    alt={imageAlt}
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
                        {studio.street}
                      </p>
                      <p className="text-sm text-[var(--color-charcoal)] opacity-60">
                        {studio.city}, Ізраїль
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
                      aria-label="Години роботи"
                    >
                      {studio.schedule_text
                        ? studio.schedule_text.split('\n').map((line, i) => (
                            <li key={i}>{line}</li>
                          ))
                        : <li className="text-gray-400">Розклад не вказано</li>
                      }
                    </ul>
                  </div>

                  {/* CTA button */}
                  <a
                    href={`#booking`}
                    data-studio={studio.id}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-rose)] px-6 py-3 text-sm font-medium text-[var(--color-rose)] transition-all duration-200 hover:bg-gradient-to-r hover:from-[var(--color-rose)] hover:to-[var(--color-gold)] hover:text-white hover:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)] focus-visible:ring-offset-2"
                    aria-label={`Записатись до студії ${studio.city}`}
                  >
                    Записатись до цієї студії
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
