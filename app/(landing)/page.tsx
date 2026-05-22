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
  title: 'WOVSDH Nails — Манікюр та педикюр у Рішон-ле-Ціон та Ашдоді',
  description:
    'Професійний манікюр, педикюр та нейл-арт в Ізраїлі. Студії у Рішон-ле-Ціон та Ашдоді. Онлайн запис.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BeautySalon',
      '@id': 'https://wovsdh-nails.com/#rishon',
      name: 'WOVSDH Nails — Рішон-ле-Ціон',
      description: 'Студія манікюру та педикюру у Рішон-ле-Ціон',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Рішон-ле-Ціон',
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
      description: 'Студія манікюру та педикюру в Ашдоді',
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
      name: 'Послуги манікюру та педикюру',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Манікюр',
          description: 'Класичний, апаратний, європейський манікюр',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Педикюр',
          description: 'СПА-педикюр, апаратний, класичний педикюр',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Гель-лак',
          description: 'Покриття гель-лаком, зняття, зміцнення',
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'Нарощування нігтів',
          description: 'Гелеве нарощування, корекція',
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: 'Дизайн нігтів',
          description: 'Розпис, втирка, стемпінг, фольга',
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
