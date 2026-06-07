import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          background: '#C8968A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FAF6F3',
          fontSize: 110,
          fontWeight: 700,
          fontFamily: 'serif',
        }}
      >
        W
      </div>
    ),
    { width: 180, height: 180 }
  )
}
