'use client'

import type { FiatCurrency } from '@/types'
import { FIAT_SYMBOLS, SUPPORTED_FIAT } from '@/constants/tokens'

type AmountInputProps = {
  amount: string
  currency: FiatCurrency
  onAmountChange: (amount: string) => void
  onCurrencyChange: (currency: FiatCurrency) => void
}

export function AmountInput({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
}: AmountInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
      onAmountChange(val)
    }
  }

  return (
    <div className="bg-[var(--surface-2)] rounded-2xl p-3.5 transition-colors">
      <span className="text-[12px] text-[var(--text-muted)] font-medium">You pay</span>
      <div className="flex items-center justify-between gap-3 mt-2.5">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={handleChange}
          className="
            bg-transparent text-[32px] font-medium text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)]/25 outline-none
            w-full min-w-0
            font-[family-name:var(--font-ibm-plex-mono)] tracking-tight
          "
        />
        <div className="flex items-center gap-0.5 bg-[var(--surface)] rounded-full p-1 shadow-sm shrink-0">
          {SUPPORTED_FIAT.map((fiat) => (
            <button
              key={fiat}
              type="button"
              onClick={() => onCurrencyChange(fiat)}
              className={`
                px-2.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all duration-200
                cursor-pointer whitespace-nowrap
                ${
                  currency === fiat
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }
              `}
              style={currency === fiat ? { boxShadow: 'var(--shadow-sm)' } : undefined}
            >
              {FIAT_SYMBOLS[fiat]} {fiat}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
