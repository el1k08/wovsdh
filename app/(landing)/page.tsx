import type { Metadata } from 'next'
import Header from '@/components/landing/Header'
import Hero from '@/components/landing/Hero'
import Services from '@/components/landing/Services'
import Gallery from '@/components/landing/Gallery'
import Studios from '@/components/landing/Studios'
import BookingSection from '@/components/landing/BookingSection'
import Contact from '@/components/landing/Contact'
import Footer from '@/components/landing/Footer'

export const metadata: Metadata = {
  title: 'WOVSDH Nails — Маникюр и педикюр в Ришон-ле-Цион и Ашдоде',
  description:
    'Профессиональный маникюр, педикюр и нейл-арт в Израиле. Студии в Ришон-ле-Цион и Ашдоде. Онлайн запись.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BeautySalon',
      '@id': 'https://wovsdh-nails.com/#rishon',
      name: 'WOVSDH Nails — Ришон-ле-Цион',
      description: 'Студия маникюра и педикюра в Ришон-ле-Цион',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Ришон-ле-Цион',
        addressCountry: 'IL',
      },
      telephone: '+972-XX-XXX-XXXX',
      priceRange: '₪₪',
      openingHours: 'Mo-Fr 10:00-19:00',
    },
    {
      '@type': 'BeautySalon',
      '@id': 'https://wovsdh-nails.com/#ashdod',
      name: 'WOVSDH Nails — Ашдод',
      description: 'Студия маникюра и педикюра в Ашдоде',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Ашдод',
        addressCountry: 'IL',
      },
      telephone: '+972-XX-XXX-XXXX',
      priceRange: '₪₪',
      openingHours: 'Mo-Fr 10:00-19:00',
    },
    {
      '@type': 'ItemList',
      name: 'Услуги маникюра и педикюра',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Маникюр',
          description: 'Классический, аппаратный, европейский маникюр',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Педикюр',
          description: 'СПА-педикюр, аппаратный, классический педикюр',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Гель-лак',
          description: 'Покрытие гель-лаком, снятие, укрепление',
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'Наращивание ногтей',
          description: 'Гелевое наращивание, коррекция',
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: 'Дизайн ногтей',
          description: 'Роспись, втирка, стемпинг, фольга',
        },
      ],
    },
  ],
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main>
        <Hero />
        <Services />
        <Gallery />
        <Studios />
        <BookingSection />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
