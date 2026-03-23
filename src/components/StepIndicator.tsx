'use client'

import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { useWidgetTheme } from './WidgetThemeProvider'
import type { FlowStep } from '@/types'

const STEPS: { key: FlowStep; label: string }[] = [
  { key: 'input', label: 'Amount' },
  { key: 'quote', label: 'Review' },
  { key: 'kyc', label: 'Verify' },
  { key: 'payment', label: 'Pay' },
  { key: 'complete', label: 'Done' },
]

export function StepIndicator({ currentStep }: { currentStep: FlowStep }) {
  const theme = useWidgetTheme()
  const stepStyle = theme?.stepStyle ?? 'numbered'

  const currentIndex = STEPS.findIndex((s) => s.key === currentStep)
  const resolvedIndex =
    currentStep === 'processing'
      ? STEPS.findIndex((s) => s.key === 'complete') - 1
      : currentIndex

  if (stepStyle === 'minimal') {
    const progress = resolvedIndex / (STEPS.length - 1)
    return (
      <div className="pb-3 mb-3">
        <div className="h-[3px] rounded-full bg-[var(--surface-3)] overflow-hidden">
          <motion.div
            className="h-full bg-[var(--accent)] rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-medium text-[var(--accent)]">
            {STEPS[resolvedIndex]?.label}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {resolvedIndex + 1}/{STEPS.length}
          </span>
        </div>
      </div>
    )
  }

  if (stepStyle === 'dots') {
    return (
      <div className="flex items-center justify-center gap-2.5 pb-4 mb-4 border-b border-[var(--border-light)]">
        {STEPS.map((step, i) => {
          const isActive = i === resolvedIndex
          const isComplete = i < resolvedIndex
          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5">
              <motion.div
                className={`
                  rounded-full transition-all duration-300
                  ${isComplete ? 'w-2.5 h-2.5 bg-[var(--accent)]' : ''}
                  ${isActive ? 'w-3 h-3 bg-[var(--accent)] ring-4 ring-[var(--accent-wash)]' : ''}
                  ${!isActive && !isComplete ? 'w-2 h-2 bg-[var(--surface-3)]' : ''}
                `}
                layout
              />
              <span
                className={`
                  text-[9px] font-medium tracking-wide
                  ${isActive ? 'text-[var(--accent)]' : ''}
                  ${isComplete ? 'text-[var(--text-secondary)]' : ''}
                  ${!isActive && !isComplete ? 'text-[var(--text-muted)]' : ''}
                `}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex items-center w-full pb-4 mb-4 border-b border-[var(--border-light)]">
      {STEPS.map((step, i) => {
        const isActive = i === resolvedIndex
        const isComplete = i < resolvedIndex

        return (
          <div key={step.key} className="contents">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`
                  w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0
                  transition-all duration-300
                  ${isComplete ? 'bg-[var(--accent)] text-white' : ''}
                  ${isActive ? 'bg-[var(--accent-wash)] text-[var(--accent)] ring-1.5 ring-[var(--accent)]/25' : ''}
                  ${!isActive && !isComplete ? 'bg-[var(--surface-2)] text-[var(--text-muted)]' : ''}
                `}
              >
                {isComplete ? (
                  <Check className="w-2.5 h-2.5" strokeWidth={3} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={`
                  text-[10px] font-medium tracking-wide
                  ${isActive ? 'text-[var(--accent)]' : ''}
                  ${isComplete ? 'text-[var(--text-secondary)]' : ''}
                  ${!isActive && !isComplete ? 'text-[var(--text-muted)]' : ''}
                `}
              >
                {step.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div className="flex-1 mx-1.5 h-[1.5px] rounded-full overflow-hidden bg-[var(--surface-3)] self-center mb-5">
                <motion.div
                  className="h-full bg-[var(--accent)] rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: isComplete ? '100%' : '0%' }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
