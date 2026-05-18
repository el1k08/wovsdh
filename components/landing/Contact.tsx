import { Phone, Mail, MessageCircle } from 'lucide-react'

const contactItems = [
  {
    icon: Phone,
    label: 'Телефон',
    value: '+972-XX-XXX-XXXX',
    href: 'tel:+972XXXXXXXXX',
    ariaLabel: 'Позвонить в студию',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'hello@wovsdh-nails.com',
    href: 'mailto:hello@wovsdh-nails.com',
    ariaLabel: 'Написать нам на email',
  },
]

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function Contact() {
  return (
    <section
      id="contact"
      className="py-20 md:py-28"
      style={{ background: 'var(--color-cream)' }}
      aria-labelledby="contact-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[var(--color-rose)]">
            Мы всегда на связи
          </p>
          <h2
            id="contact-heading"
            className="mb-4 font-light text-[var(--color-charcoal)]"
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            Контакты
          </h2>
          <p className="mx-auto max-w-xl text-base text-[var(--color-charcoal)] opacity-70 leading-relaxed">
            Свяжитесь с нами любым удобным способом — мы ответим быстро
          </p>
        </div>

        <div className="flex flex-col items-center gap-10">
          {/* Contact cards */}
          <ul
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 w-full max-w-2xl"
            role="list"
            aria-label="Контактная информация"
          >
            {contactItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.label}>
                  <a
                    href={item.href}
                    aria-label={item.ariaLabel}
                    className="flex items-center gap-4 rounded-2xl border border-[var(--color-blush)] bg-white p-5 transition-all duration-200 hover:border-[var(--color-rose)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)]"
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'var(--color-blush)' }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: 'var(--color-rose)' }}
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-charcoal)] opacity-50">
                        {item.label}
                      </p>
                      <p className="text-sm font-medium text-[var(--color-charcoal)]">
                        {item.value}
                      </p>
                    </div>
                  </a>
                </li>
              )
            })}
          </ul>

          {/* Social links */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            {/* WhatsApp */}
            <a
              href="https://wa.me/972XXXXXXXXX"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Написать нам в WhatsApp (открывается в новой вкладке)"
              className="inline-flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366]"
              style={{ background: '#25D366' }}
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              WhatsApp
            </a>

            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Наш Instagram (открывается в новой вкладке)"
              className="inline-flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-rose)]"
              style={{
                background:
                  'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              }}
            >
              <InstagramIcon />
              Instagram
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
