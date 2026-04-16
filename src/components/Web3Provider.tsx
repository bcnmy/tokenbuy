'use client'

import { useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getWagmiConfig } from '@/config/wagmi'
import '@rainbow-me/rainbowkit/styles.css'

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [config] = useState(() => getWagmiConfig())
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={{
            lightMode: lightTheme({ accentColor: '#FF4E17', borderRadius: 'medium' }),
            darkMode: darkTheme({ accentColor: '#FF4E17', borderRadius: 'medium' }),
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
