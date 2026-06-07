import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#C8968A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FAF6F3',
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'serif',
        }}
      >
        W
      </div>
    ),
    { width: 32, height: 32 }
  )
}
