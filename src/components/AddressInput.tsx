'use client'

import { useState, useRef, useEffect } from 'react'
import { isAddress } from 'viem'
import { Wallet, CircleCheck, X, Pencil } from 'lucide-react'

type AddressInputProps = {
  value: string
  onChange: (value: string) => void
}

function truncateAddress(address: string) {
  return `${address.slice(0, 7)}...${address.slice(-7)}`
}

export function AddressInput({ value, onChange }: AddressInputProps) {
  const isValid = value.length === 0 || isAddress(value, { strict: false })
  const isFilled = value.length === 42 && isValid
  const [isEditing, setIsEditing] = useState(!isFilled)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isFilled) setIsEditing(false)
  }, [isFilled])

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus()
  }, [isEditing])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleClear = () => {
    onChange('')
    setIsEditing(true)
  }

  if (isFilled && !isEditing) {
    return (
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold text-[var(--text-muted)] tracking-widest uppercase inline-flex items-center gap-1.5">
          <Wallet className="w-3 h-3" />
          Recipient wallet
        </label>
        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--accent-tertiary-wash)] border-[1.5px] border-[var(--accent-tertiary)]/30 transition-all duration-200">
          <div className="w-4.5 h-4.5 rounded-full bg-[var(--accent-tertiary)] flex items-center justify-center flex-shrink-0">
            <CircleCheck className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="flex-1 text-[13px] text-[var(--text-primary)] font-[family-name:var(--font-ibm-plex-mono)] tracking-wide">
            {truncateAddress(value)}
          </span>
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent-tertiary)] hover:text-[var(--text-primary)] tracking-wide uppercase transition-colors duration-150 cursor-pointer"
          >
            <Pencil className="w-2.5 h-2.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={handleClear}
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
        Recipient wallet
      </label>
      <div
        className={`
          flex items-center gap-2.5 p-3 rounded-2xl
          transition-all duration-200
          ${
            !isValid
              ? 'bg-[var(--error-wash)] border-[1.5px] border-[var(--error)]/30'
              : 'input-field'
          }
        `}
      >
        <span className="text-[13px] text-[var(--text-muted)] font-medium select-none">0x</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="1a2b...3c4d"
          value={value.startsWith('0x') ? value.slice(2) : value}
          onChange={(e) => {
            let raw = e.target.value
            if (raw.toLowerCase().startsWith('0x')) raw = raw.slice(2)
            raw = raw.replace(/[^a-fA-F0-9]/g, '').slice(0, 40)
            onChange(`0x${raw}`)
          }}
          className="
            flex-1 bg-transparent text-[13px] text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)]/40 outline-none
            font-[family-name:var(--font-ibm-plex-mono)] tracking-wide
          "
        />
      </div>
      {!isValid && (
        <p className="text-[10px] text-[var(--error)] font-medium pl-1">
          Invalid Ethereum address
        </p>
      )}
    </div>
  )
}
