'use client'

import { motion } from 'motion/react'
import { Check, Clock, Landmark, ArrowRightLeft, Send } from 'lucide-react'
import type { TransactionStatus } from '@/types'

type ProcessingViewProps = {
  status: TransactionStatus | null
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
    label: 'Awaiting Payment',
    description: 'Monitoring your IBAN for the incoming transfer...',
    progress: 10,
  },
  payment_received: {
    label: 'Payment Received',
    description: 'Your EUR has arrived. Minting EURe on-chain...',
    progress: 35,
  },
  converting: {
    label: 'Swapping Tokens',
    description: 'Converting EURe to your selected token via DEX...',
    progress: 65,
  },
  sending: {
    label: 'Sending to Wallet',
    description: 'Transferring tokens to your wallet address...',
    progress: 90,
  },
  complete: {
    label: 'Complete',
    description: 'Tokens have been delivered to your wallet.',
    progress: 100,
  },
  failed: {
    label: 'Failed',
    description: 'Something went wrong. Please contact support.',
    progress: 0,
  },
}

export function ProcessingView({ status }: ProcessingViewProps) {
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
          {Object.entries(STATUS_CONFIG)
            .filter(([key]) => key !== 'complete' && key !== 'failed')
            .map(([key, val]) => {
              const stepStatus = status
                ? Object.keys(STATUS_CONFIG).indexOf(key) <=
                  Object.keys(STATUS_CONFIG).indexOf(status)
                  ? 'done'
                  : Object.keys(STATUS_CONFIG).indexOf(key) ===
                      Object.keys(STATUS_CONFIG).indexOf(status) + 1
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
    </motion.div>
  )
}
