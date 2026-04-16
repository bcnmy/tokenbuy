'use client'

import dynamic from 'next/dynamic'

const Web3Provider = dynamic(
  () => import('@/components/Web3Provider').then((m) => m.Web3Provider),
  { ssr: false },
)

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>
}
