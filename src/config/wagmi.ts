import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { gnosis, mainnet, optimism, arbitrum, base, polygon } from 'wagmi/chains'
import type { Config } from 'wagmi'

let _config: Config | null = null

export function getWagmiConfig(): Config {
  if (!_config) {
    _config = getDefaultConfig({
      appName: 'TokenBuy',
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '413239793340bfec9aa4738cf8fbce0c',
      chains: [gnosis, mainnet, optimism, arbitrum, base, polygon],
      ssr: true,
    })
  }
  return _config
}
