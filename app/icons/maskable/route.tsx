import { ImageResponse } from 'next/og'

// 512×512 maskable icon for the PWA manifest (Android/Chrome install).
// Full-bleed background with the mark centred inside the maskable safe zone.
export const dynamic = 'force-static'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#C8968A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FAF6F3',
          fontSize: 280,
          fontWeight: 700,
          fontFamily: 'serif',
        }}
      >
        W
      </div>
    ),
    { width: 512, height: 512 },
  )
}
