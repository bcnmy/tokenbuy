'use client'

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, CheckCheck, ArrowLeft, Landmark, Clock, ShieldAlert, ExternalLink, Loader2, CircleCheck } from 'lucide-react'
import type { PaymentInfo } from '@/types'
import { FIAT_SYMBOLS } from '@/constants/tokens'

type PaymentDetailsProps = {
  payment: PaymentInfo
  onBack: () => void
  supertxHash?: string | null
  isPreparingSupertx?: boolean
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

export function PaymentDetails({ payment, onBack, supertxHash, isPreparingSupertx }: PaymentDetailsProps) {
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

      {supertxHash ? (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--accent-tertiary-wash,var(--accent-wash))] border border-[var(--accent-tertiary,var(--accent))]/20">
          <CircleCheck className="w-3.5 h-3.5 text-[var(--accent-tertiary,var(--accent))] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
              <span className="font-semibold">Delivery is pre-signed.</span> Your tokens will arrive automatically once the bank transfer is received — even if you close this page.
            </p>
            <a
              href={`https://meescan.biconomy.io/details/${supertxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)] hover:underline mt-1"
            >
              Track on MEEScan
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      ) : isPreparingSupertx ? (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--accent-wash)] border border-[var(--accent)]/20">
          <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 animate-spin" />
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            <span className="font-semibold">Setting up automatic delivery</span> — signing transaction with Biconomy&hellip;
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--warning-wash,var(--accent-wash))] border border-[var(--warning,var(--accent))]/20">
          <ShieldAlert className="w-3.5 h-3.5 text-[var(--warning,var(--accent))] shrink-0 mt-0.5" />
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            <span className="font-semibold">Do not clear browser data</span> until your transaction completes. Your signing key is stored locally.
          </p>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative"
      >
        <motion.div
          className="absolute -inset-4 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 30% 50%, var(--accent-wash), transparent 55%)' }}
          animate={{ opacity: [0.7, 0.2, 0.7] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -inset-4 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 70% 50%, var(--accent-wash), transparent 55%)' }}
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="relative flex items-center gap-3 px-4 py-3.5">
          <div className="relative shrink-0">
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                inset: '-12px',
                background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
              }}
              animate={{ scale: [0.5, 1.2], opacity: [0.2, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-[var(--accent)]" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                Waiting for payment
              </span>
              <span className="flex gap-[3px] mt-[1px]">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="block w-[4px] h-[4px] rounded-full bg-[var(--accent)]"
                    animate={{ opacity: [0.15, 1, 0.15] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                  />
                ))}
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              {supertxHash
                ? 'Biconomy relays will auto-execute when EURe arrives'
                : 'Auto-detects within ~30s of arrival'}
            </p>
          </div>
        </div>
      </motion.div>

      <button
        type="button"
        onClick={onBack}
        className="btn-secondary w-full py-3 text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>
    </motion.div>
  )
}
