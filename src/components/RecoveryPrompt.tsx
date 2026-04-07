'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { ShieldCheck, Mail, ArrowRight, Loader2, AlertCircle, KeyRound } from 'lucide-react'

type RecoveryPromptProps = {
  onRecover: (email: string, otp: string) => Promise<void>
  onSendCode: (email: string) => Promise<void>
  onDismiss: () => void
  defaultEmail?: string
}

type RecoveryStep = 'email' | 'otp'

export function RecoveryPrompt({ onRecover, onSendCode, onDismiss, defaultEmail }: RecoveryPromptProps) {
  const [step, setStep] = useState<RecoveryStep>('email')
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendCode = async () => {
    if (!email) return
    setIsLoading(true)
    setError(null)
    try {
      await onSendCode(email)
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send recovery code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) return
    setIsLoading(true)
    setError(null)
    try {
      await onRecover(email, otp)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed')
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] inline-flex items-center gap-2">
          <KeyRound className="w-4.5 h-4.5 text-[var(--accent)]" strokeWidth={2} />
          Recover Transaction
        </h2>
        <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
          A pending transaction was detected but your local signing key is missing. Enter your recovery email to restore it.
        </p>
      </div>

      {step === 'email' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-[var(--text-muted)] tracking-widest uppercase inline-flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              Recovery email
            </label>
            <div className="input-field flex items-center gap-2.5 p-3 rounded-2xl transition-all duration-200">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                className="
                  flex-1 bg-transparent text-[13px] text-[var(--text-primary)]
                  placeholder:text-[var(--text-muted)]/40 outline-none
                "
              />
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[12px] text-[var(--error)] font-medium bg-[var(--error-wash)] rounded-xl px-3 py-2 inline-flex items-center gap-2"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </motion.p>
          )}

          <button
            type="button"
            onClick={handleSendCode}
            disabled={isLoading || !email}
            className="btn-primary w-full py-3.5 text-sm cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending code...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                Send Recovery Code
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="btn-secondary w-full py-2.5 text-sm cursor-pointer text-[var(--text-muted)]"
          >
            Start fresh instead
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--accent-wash)] border border-[var(--accent)]/20">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
              A 6-digit code was sent to <span className="font-semibold">{email}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-[var(--text-muted)] tracking-widest uppercase inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" />
              Verification code
            </label>
            <div className="input-field flex items-center gap-2.5 p-3 rounded-2xl transition-all duration-200">
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                className="
                  flex-1 bg-transparent text-[16px] text-[var(--text-primary)]
                  placeholder:text-[var(--text-muted)]/40 outline-none text-center
                  font-[family-name:var(--font-ibm-plex-mono)] tracking-[0.5em]
                "
              />
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[12px] text-[var(--error)] font-medium bg-[var(--error-wash)] rounded-xl px-3 py-2 inline-flex items-center gap-2"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </motion.p>
          )}

          <button
            type="button"
            onClick={handleVerify}
            disabled={isLoading || otp.length !== 6}
            className="btn-primary w-full py-3.5 text-sm cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                Recover Wallet
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setStep('email'); setOtp(''); setError(null) }}
            className="btn-secondary w-full py-2.5 text-sm cursor-pointer text-[var(--text-muted)]"
          >
            Use a different email
          </button>
        </div>
      )}
    </motion.div>
  )
}
