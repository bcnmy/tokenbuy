import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { gnosis, mainnet, optimism, arbitrum, base, polygon } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'TokenBuy',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '413239793340bfec9aa4738cf8fbce0c',
  chains: [gnosis, mainnet, optimism, arbitrum, base, polygon],
  ssr: true,
})
