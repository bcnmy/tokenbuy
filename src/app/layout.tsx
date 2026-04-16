import type { Metadata } from 'next'
import { Sora, IBM_Plex_Mono, Inter, DM_Sans } from 'next/font/google'
import { SystemThemeSync } from '@/components/SystemThemeSync'
import { ClientProviders } from '@/components/ClientProviders'
import './globals.css'

const themeScript = `(function(){try{if(window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('dark')}catch(e){}})()`

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://tokenbuy.app'),
  title: 'TokenBuy — The cheapest way to buy crypto in the EU',
  description:
    'The cheapest way to buy crypto tokens in the EU. Send EUR via bank transfer, receive tokens in your wallet. Near-zero fees powered by Monerium.',
  openGraph: {
    title: 'TokenBuy — The cheapest way to buy crypto in the EU',
    description:
      'Send EUR via bank transfer, receive tokens in your wallet. ~0% onramp fee for EU users.',
    type: 'website',
    siteName: 'TokenBuy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TokenBuy — The cheapest way to buy crypto in the EU',
    description:
      'Send EUR via bank transfer, receive tokens in your wallet. ~0% onramp fee for EU users.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sora.variable} ${ibmPlexMono.variable} ${inter.variable} ${dmSans.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className="min-h-full flex flex-col antialiased"
        style={{ fontFamily: 'var(--font-sora), system-ui, sans-serif' }}
      >
        <SystemThemeSync />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
