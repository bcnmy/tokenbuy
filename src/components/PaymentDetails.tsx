'use client'

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, CheckCheck, AlertTriangle, Send, ArrowLeft, Landmark } from 'lucide-react'
import type { PaymentInfo } from '@/types'
import { FIAT_SYMBOLS } from '@/constants/tokens'

type PaymentDetailsProps = {
  payment: PaymentInfo
  onConfirmSent: () => void
  onBack: () => void
}

function CopyField({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex items-center justify-between group ${compact ? 'py-1.5' : 'py-2'}`}>
      <div className="flex flex-col gap-0 min-w-0 flex-1">
        <span className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
          {label}
        </span>
        <span className={`font-[family-name:var(--font-ibm-plex-mono)] text-[var(--text-primary)] truncate pr-2 font-medium ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={`
          px-2 py-1 rounded-lg text-[9px] font-bold
          transition-all duration-200 cursor-pointer shrink-0 inline-flex items-center gap-1
          ${copied
            ? 'bg-[var(--accent-tertiary-wash)] text-[var(--accent-tertiary)]'
            : 'bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-wash)] opacity-0 group-hover:opacity-100 focus:opacity-100'
          }
        `}
      >
        {copied ? <><CheckCheck className="w-2.5 h-2.5" /> Copied!</> : <><Copy className="w-2.5 h-2.5" /> Copy</>}
      </button>
    </div>
  )
}

function buildEpcPayload(payment: PaymentInfo): string {
  const iban = payment.iban.replace(/\s/g, '')
  const amount = `EUR${parseFloat(payment.amount).toFixed(2)}`

  return [
    'BCD',             // Service tag
    '002',             // Version
    '1',               // UTF-8
    'SCT',             // SEPA Credit Transfer
    payment.bic,       // BIC
    payment.beneficiary, // Beneficiary name
    iban,              // IBAN
    amount,            // Amount
    '',                // Purpose (optional)
    '',                // Structured reference (empty — using unstructured)
    payment.reference, // Unstructured remittance text
  ].join('\n')
}

export function PaymentDetails({ payment, onConfirmSent, onBack }: PaymentDetailsProps) {
  const symbol = FIAT_SYMBOLS[payment.currency]
  const epcPayload = useMemo(() => buildEpcPayload(payment), [payment])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-4"
    >
      <div className="flex items-stretch gap-4">
        <div className="w-1/3 min-w-0 space-y-1">
          <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-widest inline-flex items-center gap-1.5">
            <Landmark className="w-3 h-3" />
            Send payment
          </p>
          <p className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-ibm-plex-mono)]">
            {symbol}{payment.amount}
            <span className="text-xs ml-1 text-[var(--text-muted)] font-sans font-medium">
              {payment.currency}
            </span>
          </p>
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            Transfer any amount — it will be converted at the stated exchange rate.
          </p>
        </div>

        <div className="flex-1" />

        <div className="shrink-0 flex flex-col items-center">
          <div className="bg-white rounded-xl p-2 shadow-sm border border-[var(--border-light)] flex items-center justify-center self-stretch">
            <QRCodeSVG
              value={epcPayload}
              size={80}
              level="M"
              marginSize={0}
            />
          </div>
          <p className="text-[8px] text-[var(--text-muted)] font-medium tracking-wide mt-1">
            Scan with banking app
          </p>
        </div>
      </div>

      <div className="bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border-light)]">
        <div className="border-b border-[var(--border-light)]">
          <CopyField label="IBAN" value={payment.iban} />
        </div>

        <div className="grid grid-cols-2 gap-x-3">
          <div className="border-b border-[var(--border-light)]">
            <CopyField label="BIC / SWIFT" value={payment.bic} compact />
          </div>
          <div className="border-b border-[var(--border-light)]">
            <CopyField label="Beneficiary" value={payment.beneficiary} compact />
          </div>
          <div>
            <CopyField label="Bank" value={payment.bankName} compact />
          </div>
          <div>
            <CopyField label="Reference" value={payment.reference} compact />
          </div>
        </div>
      </div>

      <div className="bg-[var(--warning-wash)] border border-[var(--warning)]/20 rounded-xl p-2.5">
        <p className="text-[11px] text-[var(--warning)] font-medium leading-relaxed inline-flex items-start gap-1.5" style={{ color: '#B8860B' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2} />
          <span>
            Use the exact reference code above. Payment is auto-detected within ~30s of arrival.
          </span>
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="btn-secondary flex-1 py-3 text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <button
          type="button"
          onClick={onConfirmSent}
          className="btn-primary flex-[2] py-3 text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          I&apos;ve sent it
        </button>
      </div>
    </motion.div>
  )
}
