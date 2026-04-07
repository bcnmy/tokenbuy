import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'TokenBuy — The cheapest way to buy crypto in the EU'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function TwitterImage() {
  const accentPurple = '#7C6AEF'
  const accentCoral = '#F59E8F'
  const accentTeal = '#5CC9B8'
  const bgDeep = '#0F1017'
  const bgBase = '#161720'
  const surface = '#1E1F2B'
  const textPrimary = '#E8E9F0'
  const textSecondary = '#9498B5'
  const textMuted = '#5E6280'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: bgDeep,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient gradient blobs */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -80,
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accentPurple}25 0%, transparent 70%)`,
            filter: 'blur(2px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            left: -60,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accentCoral}20 0%, transparent 70%)`,
            filter: 'blur(2px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 200,
            left: 300,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accentTeal}12 0%, transparent 70%)`,
            filter: 'blur(2px)',
          }}
        />

        {/* Dot pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(circle at 1px 1px, ${textMuted}18 0.5px, transparent 0)`,
            backgroundSize: '28px 28px',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px 64px',
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {/* Top — logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${accentPurple}, ${accentCoral})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 20px ${accentPurple}40`,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: textPrimary,
                letterSpacing: '-0.02em',
              }}
            >
              TokenBuy
            </span>
          </div>

          {/* Middle — headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: textPrimary,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                maxWidth: 700,
              }}
            >
              The cheapest way to buy crypto
              <span style={{ color: accentPurple }}> in the EU</span>
            </div>
            <div
              style={{
                fontSize: 22,
                color: textSecondary,
                lineHeight: 1.5,
                maxWidth: 560,
              }}
            >
              Send EUR via bank transfer. Receive tokens in your wallet.
              Near-zero fees.
            </div>
          </div>

          {/* Bottom — pills */}
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: '~0% onramp fee', color: accentTeal },
              { label: 'EU bank transfers', color: accentPurple },
              { label: 'Instant delivery', color: accentCoral },
            ].map(({ label, color }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 12,
                  background: surface,
                  border: `1px solid ${color}30`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 8px ${color}60`,
                  }}
                />
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: textPrimary,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — swap card mock */}
        <div
          style={{
            position: 'absolute',
            right: 56,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 340,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: bgBase,
              borderRadius: 24,
              border: `1px solid ${textMuted}25`,
              padding: '28px 24px',
              boxShadow: `0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px ${textMuted}10`,
              gap: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: surface,
                borderRadius: 16,
                padding: '18px 20px',
                border: `1px solid ${textMuted}15`,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: textMuted, fontWeight: 500 }}>You send</span>
                <span style={{ fontSize: 28, fontWeight: 700, color: textPrimary, letterSpacing: '-0.02em' }}>€1,000</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: `${accentPurple}15`,
                  borderRadius: 10,
                  padding: '8px 14px',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: accentPurple }}>EUR</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: surface,
                  border: `1px solid ${textMuted}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12l7 7 7-7" stroke={accentPurple} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: surface,
                borderRadius: 16,
                padding: '18px 20px',
                border: `1px solid ${textMuted}15`,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: textMuted, fontWeight: 500 }}>You receive</span>
                <span style={{ fontSize: 28, fontWeight: 700, color: accentTeal, letterSpacing: '-0.02em' }}>997.14</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: `${accentTeal}15`,
                  borderRadius: 10,
                  padding: '8px 14px',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: accentTeal }}>USDC</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: 13, color: textMuted }}>Total fee</span>
              <span style={{ fontSize: 13, color: accentTeal, fontWeight: 600 }}>~0.3%</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
