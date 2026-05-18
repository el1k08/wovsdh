import type { Metadata } from 'next'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import Script from 'next/script'
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
    default: 'WOVSDH Nails — Маникюр и педикюр в Израиле',
    template: '%s | WOVSDH Nails',
  },
  description:
    'Профессиональный маникюр, педикюр и нейл-арт в Израиле. Студии в Ришон-ле-Цион и Ашдоде. Онлайн запись, доступные цены, опытные мастера.',
  keywords: [
    'маникюр Ришон-ле-Цион',
    'педикюр Ашдод',
    'маникюр Израиль',
    'нейл студия Израиль',
    'гель-лак Ришон',
    'записаться на маникюр',
    'nail studio Israel',
    'מניקור ראשון לציון',
    'מניקור אשדוד',
  ],
  authors: [{ name: 'WOVSDH Nails' }],
  creator: 'WOVSDH Nails',
  openGraph: {
    type: 'website',
    locale: 'ru_IL',
    alternateLocale: ['he_IL', 'en_US'],
    url: '/',
    siteName: 'WOVSDH Nails',
    title: 'WOVSDH Nails — Маникюр и педикюр в Израиле',
    description:
      'Профессиональный маникюр, педикюр и нейл-арт. Студии в Ришон-ле-Цион и Ашдоде. Онлайн запись.',
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
    title: 'WOVSDH Nails — Маникюр и педикюр в Израиле',
    description: 'Студии маникюра в Ришон-ле-Цион и Ашдоде. Онлайн запись.',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ru"
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
        {children}
      </body>
    </html>
  )
}
