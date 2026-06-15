import type { MetadataRoute } from 'next'

// PWA manifest. The installable "app" is the admin panel — installing adds it to
// the home screen and launches it in standalone (no browser chrome).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WOVSDH Admin',
    short_name: 'WOVSDH',
    description: 'WOVSDH Nails — admin panel',
    start_url: '/admin',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF6F3',
    theme_color: '#FAF6F3',
    icons: [
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
