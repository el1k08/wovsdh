import type { Metadata } from 'next'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import Script from 'next/script'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
})

const cormorantGaramond = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wovsdh-nails.com'
const gtmId = process.env.NEXT_PUBLIC_GTM_ID
const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'WOVSDH Nails — Манікюр та педикюр в Ізраїлі',
    template: '%s | WOVSDH Nails',
  },
  description:
    'Професійний манікюр, педикюр та нейл-арт в Ізраїлі. Студії у Рішон-ле-Ціон та Ашдоді. Онлайн запис, доступні ціни, досвідчені майстри.',
  keywords: [
    'манікюр Рішон-ле-Ціон',
    'педикюр Ашдод',
    'манікюр Ізраїль',
    'нейл студія Ізраїль',
    'гель-лак Рішон',
    'записатись на манікюр',
    'nail studio Israel',
    'מניקור ראשון לציון',
    'מניקור אשדוד',
  ],
  authors: [{ name: 'WOVSDH Nails' }],
  creator: 'WOVSDH Nails',
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    alternateLocale: ['he_IL', 'en_US'],
    url: '/',
    siteName: 'WOVSDH Nails',
    title: 'WOVSDH Nails — Манікюр та педикюр в Ізраїлі',
    description:
      'Професійний манікюр, педикюр та нейл-арт. Студії у Рішон-ле-Ціон та Ашдоді. Онлайн запис.',
    images: [
      {
        url: '/og-placeholder.svg',
        width: 1200,
        height: 630,
        alt: 'WOVSDH Nails — Nail Studio Israel',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WOVSDH Nails — Манікюр та педикюр в Ізраїлі',
    description: 'Студії манікюру у Рішон-ле-Ціон та Ашдоді. Онлайн запис.',
    images: ['/og-placeholder.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION ?? '',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      className={`${inter.variable} ${cormorantGaramond.variable} h-full antialiased`}
    >
      <head>
        {/* Google Tag Manager — must be as high in <head> as possible */}
        {gtmId && (
          <Script id="gtm-script" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
        )}
        {/* Google Analytics — only when GTM is not present */}
        {gaId && !gtmId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-script" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col">
        {/* Google Tag Manager — noscript fallback */}
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
