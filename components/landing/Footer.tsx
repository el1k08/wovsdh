import { Phone, Mail, MessageCircle } from 'lucide-react'

function InstagramIcon() {
  return (
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
  )
}

export default function Footer() {
  return (
    <footer
      className="py-12 md:py-16"
      style={{ background: 'var(--color-charcoal)' }}
      role="contentinfo"
      aria-label="Підвал сайту"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
          {/* Brand column */}
          <div>
            <div className="mb-3 flex items-baseline gap-1.5">
              <span
                className="font-semibold tracking-widest text-white"
                style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.5rem' }}
              >
                WOVSDH
              </span>
              <span
                className="font-light tracking-widest"
                style={{
                  fontFamily: 'var(--font-cormorant), serif',
                  fontSize: '1.5rem',
                  color: 'var(--color-rose)',
                }}
              >
                Nails
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white opacity-50">
              Професійний манікюр та педикюр в Ізраїлі. Студії в Рішон-ле-Ціон та Ашдоді.
            </p>
          </div>

          {/* Navigation column */}
          <nav aria-label="Навігація у підвалі">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white opacity-40">
              Навігація
            </p>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Послуги', href: '#services' },
                { label: 'Галерея', href: '#gallery' },
                { label: 'Студії', href: '#studios' },
                { label: 'Запис', href: '#booking' },
                { label: 'Контакти', href: '#contact' },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-white opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)] rounded"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Social & Legal column */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white opacity-40">
              Ми в соцмережах
            </p>
            <div className="mb-6 flex gap-3">
              <a
                href="https://wa.me/972XXXXXXXXX"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp (відкривається у новій вкладці)"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram (відкривається у новій вкладці)"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)]"
              >
                <InstagramIcon />
              </a>
              <a
                href="tel:+972XXXXXXXXX"
                aria-label="Зателефонувати нам"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)]"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="mailto:hello@wovsdh-nails.com"
                aria-label="Написати нам на email"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)]"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-white opacity-40">
              <a
                href="/privacy"
                className="hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-rose)] rounded"
              >
                Політика конфіденційності
              </a>
              <a
                href="/terms"
                className="hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-rose)] rounded"
              >
                Умови використання
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-10 border-t pt-6 text-center text-xs text-white opacity-30"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <p>© 2025 WOVSDH Nails. Всі права захищені.</p>
        </div>
      </div>
    </footer>
  )
}
