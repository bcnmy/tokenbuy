'use client'

import { Wallet, Send } from 'lucide-react'
import type { InputMode } from '@/types'

type ModeToggleProps = {
  mode: InputMode
  onChange: (mode: InputMode) => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex bg-[var(--surface-2)] rounded-xl p-0.5 gap-0.5">
      <button
        type="button"
        className={`
          flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px]
          text-[11px] font-semibold transition-all duration-200 cursor-pointer
          ${mode === 'connect_wallet'
            ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }
        `}
        onClick={() => onChange('connect_wallet')}
      >
        <Wallet className="w-3 h-3" />
        Connect Wallet
      </button>
      <button
        type="button"
        className={`
          flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px]
          text-[11px] font-semibold transition-all duration-200 cursor-pointer
          ${mode === 'paste_address'
            ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }
        `}
        onClick={() => onChange('paste_address')}
      >
        <Send className="w-3 h-3" />
        Paste Address
      </button>
    </div>
  )
}
