const services = [
  {
    name: 'Маникюр',
    desc: 'Классический, аппаратный, европейский',
    price: 'от 120 ₪',
    icon: '✨',
  },
  {
    name: 'Педикюр',
    desc: 'СПА-педикюр, аппаратный, классический',
    price: 'от 150 ₪',
    icon: '🌸',
  },
  {
    name: 'Гель-лак',
    desc: 'Покрытие гель-лаком, снятие, укрепление',
    price: 'от 90 ₪',
    icon: '💅',
  },
  {
    name: 'Наращивание',
    desc: 'Гелевое наращивание, коррекция',
    price: 'от 200 ₪',
    icon: '💎',
  },
  {
    name: 'Дизайн',
    desc: 'Роспись, втирка, стемпинг, фольга',
    price: 'от 30 ₪',
    icon: '🎨',
  },
  {
    name: 'Парафинотерапия',
    desc: 'Увлажнение и питание кожи рук и ног',
    price: 'от 60 ₪',
    icon: '🕯️',
  },
]

export default function Services() {
  return (
    <section
      id="services"
      className="py-20 md:py-28"
      style={{ background: 'var(--color-cream)' }}
      aria-labelledby="services-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[var(--color-rose)]">
            Что мы предлагаем
          </p>
          <h2
            id="services-heading"
            className="mb-4 font-light text-[var(--color-charcoal)]"
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            Наши услуги
          </h2>
          <p className="mx-auto max-w-xl text-base text-[var(--color-charcoal)] opacity-70 leading-relaxed">
            Полный спектр услуг по уходу за ногтями — от классического маникюра до изысканного нейл-арта
          </p>
        </div>

        {/* Services grid */}
        <ul
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
          aria-label="Список услуг"
        >
          {services.map((service) => (
            <li
              key={service.name}
              className="group relative rounded-2xl border border-[var(--color-blush)] bg-white p-6 transition-all duration-300 hover:shadow-lg hover:border-[var(--color-rose)] hover:-translate-y-0.5"
            >
              {/* Icon */}
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                style={{ background: 'var(--color-blush)' }}
                aria-hidden="true"
              >
                {service.icon}
              </div>

              {/* Name */}
              <h3
                className="mb-2 font-semibold text-[var(--color-charcoal)]"
                style={{
                  fontFamily: 'var(--font-cormorant), serif',
                  fontSize: '1.375rem',
                }}
              >
                {service.name}
              </h3>

              {/* Description */}
              <p className="mb-4 text-sm leading-relaxed text-[var(--color-charcoal)] opacity-65">
                {service.desc}
              </p>

              {/* Price */}
              <div className="flex items-center justify-between">
                <span
                  className="text-base font-semibold"
                  style={{ color: 'var(--color-rose)' }}
                  aria-label={`Цена: ${service.price}`}
                >
                  {service.price}
                </span>
                <a
                  href="#booking"
                  className="text-sm font-medium text-[var(--color-gold)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)] rounded"
                  aria-label={`Записаться на ${service.name}`}
                >
                  Записаться →
                </a>
              </div>

              {/* Decorative accent line */}
              <div
                className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    'linear-gradient(to right, var(--color-rose), var(--color-gold))',
                }}
                aria-hidden="true"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
