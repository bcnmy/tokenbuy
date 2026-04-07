'use client'

import { useEffect } from 'react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect } from 'wagmi'
import { Wallet, CircleCheck, X } from 'lucide-react'

type WalletButtonProps = {
  onAddressChange: (address: string) => void
}

function truncateAddress(address: string) {
  return `${address.slice(0, 7)}...${address.slice(-5)}`
}

export function WalletButton({ onAddressChange }: WalletButtonProps) {
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    if (isConnected && address) {
      onAddressChange(address)
    } else {
      onAddressChange('')
    }
  }, [address, isConnected, onAddressChange])

  if (isConnected && address) {

    return (
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold text-[var(--text-muted)] tracking-widest uppercase inline-flex items-center gap-1.5">
          <Wallet className="w-3 h-3" />
          Connected wallet
        </label>
        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--accent-tertiary-wash)] border-[1.5px] border-[var(--accent-tertiary)]/30 transition-all duration-200">
          <div className="w-4.5 h-4.5 rounded-full bg-[var(--accent-tertiary)] flex items-center justify-center flex-shrink-0">
            <CircleCheck className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="flex-1 text-[13px] text-[var(--text-primary)] font-[family-name:var(--font-ibm-plex-mono)] tracking-wide">
            {truncateAddress(address)}
          </span>
          <button
            type="button"
            onClick={() => disconnect()}
            className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-wash)] transition-all duration-150 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-[var(--text-muted)] tracking-widest uppercase inline-flex items-center gap-1.5">
        <Wallet className="w-3 h-3" />
        Your wallet
      </label>
      <button
        type="button"
        onClick={openConnectModal}
        className="
          w-full flex items-center justify-center gap-2 p-3 rounded-2xl
          input-field cursor-pointer
          text-[13px] font-medium text-[var(--accent)]
          hover:bg-[var(--accent-wash)] transition-colors duration-200
        "
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
    </div>
  )
}
