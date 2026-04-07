'use client'

import { motion } from 'motion/react'
import { Check, Clock, Landmark, ArrowRightLeft, Send, AlertCircle, ExternalLink } from 'lucide-react'
import type { TransactionStatus } from '@/types'

type ProcessingViewProps = {
  status: TransactionStatus | null
  pendingTxHash?: string | null
  error?: string | null
}

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  awaiting_payment: Clock,
  payment_received: Landmark,
  converting: ArrowRightLeft,
  sending: Send,
}

const STATUS_CONFIG: Record<
  TransactionStatus,
  { label: string; description: string; progress: number }
> = {
  awaiting_payment: {
    label: 'Waiting for EURe',
    description: 'Watching for your EURe deposit on Gnosis Chain. This can take a few minutes after your bank transfer is sent.',
    progress: 10,
  },
  payment_received: {
    label: 'EURe Received',
    description: 'EURe has arrived! Preparing the swap...',
    progress: 35,
  },
  converting: {
    label: 'Swapping Tokens',
    description: 'Please approve the transaction in your wallet. Biconomy is routing your swap...',
    progress: 55,
  },
  sending: {
    label: 'Executing Swap',
    description: 'Transaction submitted. Waiting for confirmation on-chain...',
    progress: 80,
  },
  complete: {
    label: 'Complete',
    description: 'Tokens have been delivered to your wallet!',
    progress: 100,
  },
  failed: {
    label: 'Failed',
    description: 'Something went wrong. Your EURe is safe in your wallet.',
    progress: 0,
  },
}

const VISIBLE_STEPS: TransactionStatus[] = [
  'awaiting_payment',
  'payment_received',
  'converting',
  'sending',
]

export function ProcessingView({ status, pendingTxHash, error }: ProcessingViewProps) {
  const config = status ? STATUS_CONFIG[status] : STATUS_CONFIG.awaiting_payment

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-5 py-2"
    >
      <div className="flex justify-center">
        <div className="relative">
          <svg className="w-20 h-20" viewBox="0 0 96 96">
            <circle
              cx="48" cy="48" r="42"
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth="4"
            />
            <motion.circle
              cx="48" cy="48" r="42"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={264}
              initial={{ strokeDashoffset: 264 }}
              animate={{ strokeDashoffset: 264 - (264 * config.progress / 100) }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-[family-name:var(--font-ibm-plex-mono)] font-semibold text-[var(--accent)]">
              {config.progress}%
            </span>
          </div>
        </div>
      </div>

      <div className="text-center space-y-1">
        <motion.h3
          key={config.label}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-base font-semibold text-[var(--text-primary)]"
        >
          {config.label}
        </motion.h3>
        <motion.p
          key={config.description}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-[12px] text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed"
        >
          {config.description}
        </motion.p>
        {pendingTxHash && status === 'sending' && (
          <motion.a
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            href={`https://meescan.biconomy.io/details/${pendingTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline mt-1"
          >
            View on MEEScan
            <ExternalLink className="w-3 h-3" />
          </motion.a>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-light))' }}
            initial={{ width: '0%' }}
            animate={{ width: `${config.progress}%` }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>

        <div className="space-y-0.5">
          {VISIBLE_STEPS.map((key) => {
              const val = STATUS_CONFIG[key]
              const keyIdx = VISIBLE_STEPS.indexOf(key)
              const statusIdx = status ? VISIBLE_STEPS.indexOf(status) : -1
              const stepStatus = status
                ? keyIdx < statusIdx
                  ? 'done'
                  : keyIdx === statusIdx
                    ? 'active'
                    : 'pending'
                : key === 'awaiting_payment'
                  ? 'active'
                  : 'pending'

              return (
                <div key={key} className="flex items-center gap-2.5 py-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] shrink-0 transition-all duration-300
                      ${stepStatus === 'done' ? 'bg-[var(--accent)] text-white' : ''}
                      ${stepStatus === 'active' ? 'bg-[var(--accent-wash)] text-[var(--accent)] ring-1.5 ring-[var(--accent)]/20' : ''}
                      ${stepStatus === 'pending' ? 'bg-[var(--surface-3)] text-[var(--text-muted)]' : ''}
                    `}
                    style={stepStatus === 'done' ? { boxShadow: 'var(--shadow-sm)' } : undefined}
                  >
                    {stepStatus === 'done' ? (
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    ) : stepStatus === 'active' ? (
                      (() => {
                        const Icon = STEP_ICONS[key]
                        return Icon ? <Icon className="w-2.5 h-2.5" strokeWidth={2} /> : <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                      })()
                    ) : (
                      (() => {
                        const Icon = STEP_ICONS[key]
                        return Icon ? <Icon className="w-2.5 h-2.5" strokeWidth={1.5} /> : null
                      })()
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-medium
                      ${stepStatus === 'done' ? 'text-[var(--text-secondary)]' : ''}
                      ${stepStatus === 'active' ? 'text-[var(--accent)]' : ''}
                      ${stepStatus === 'pending' ? 'text-[var(--text-muted)]' : ''}
                    `}
                  >
                    {val.label}
                  </span>
                </div>
              )
            })}
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[12px] text-[var(--error)] font-medium bg-[var(--error-wash)] rounded-xl px-3 py-2.5 flex items-start gap-2"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </motion.div>
      )}
    </motion.div>
  )
}
