'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion } from 'motion/react'
import {
  ShieldCheck,
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react'
import SumsubWebSdk from '@sumsub/websdk-react'
import { getKycAccessToken, getKycStatus } from '@/services/kyc'
import * as logger from '@/services/logger'
import { useWidgetTheme } from './WidgetThemeProvider'
import type { WidgetConfig } from '@/types/widget'

type KycGateProps = {
  walletAddress: string
  onComplete: () => void
  onBack: () => void
  isLoading: boolean
  flowError?: string | null
  onSdkActiveChange?: (active: boolean) => void
}

function buildSumsubCss(theme: WidgetConfig | null): string {
  const dark = theme?.colorMode === 'dark'
  const accent = theme?.accentColor ?? '#7C6AEF'
  const radius = theme?.borderRadius ?? 24
  const error = theme?.errorColor ?? '#EF6461'
  const success = theme?.successColor ?? '#5CC9B8'
  const btnRadius = Math.round(radius * 0.583)

  const bg = dark ? '#1E1F2B' : '#FFFFFF'
  const bgAlt = dark ? '#262736' : '#F0F2F8'
  const textPrimary = dark ? '#E8E9F0' : '#1C1F37'
  const textSecondary = dark ? '#9498B5' : '#6B7194'
  const border = dark ? '#363850' : '#E0E4EF'
  const inputBg = dark ? '#262736' : '#F0F2F8'

  return `
    body {
      background: ${bg} !important;
      color: ${textPrimary} !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    }

    /* primary action buttons */
    .submit-btn, button[type="submit"],
    button.primary, .btn-primary,
    [class*="submit"], [class*="actionBtn"] {
      background: ${accent} !important;
      color: #fff !important;
      border: none !important;
      border-radius: ${btnRadius}px !important;
      font-weight: 600 !important;
      transition: filter 0.2s !important;
    }
    .submit-btn:hover, button[type="submit"]:hover,
    button.primary:hover, .btn-primary:hover,
    [class*="submit"]:hover, [class*="actionBtn"]:hover {
      filter: brightness(1.08) !important;
    }

    /* secondary / outline buttons */
    button.secondary, .btn-secondary, button[class*="alt"] {
      background: ${bgAlt} !important;
      color: ${textSecondary} !important;
      border: 1px solid ${border} !important;
      border-radius: ${btnRadius}px !important;
    }

    /* inputs */
    input, select, textarea,
    [class*="input"], [class*="Input"] {
      background: ${inputBg} !important;
      border: 1.5px solid ${border} !important;
      border-radius: ${Math.round(radius * 0.5)}px !important;
      color: ${textPrimary} !important;
    }
    input:focus, select:focus, textarea:focus {
      border-color: ${accent} !important;
      box-shadow: 0 0 0 3px ${accent}20 !important;
    }

    /* headings and body text */
    h1, h2, h3, h4, [class*="title"], [class*="Title"] {
      color: ${textPrimary} !important;
    }
    p, span, label, [class*="desc"], [class*="subtitle"],
    [class*="Desc"], [class*="Subtitle"] {
      color: ${textSecondary} !important;
    }

    /* links and accent-colored text */
    a, [class*="link"], [class*="Link"] {
      color: ${accent} !important;
    }

    /* upload / drop zones */
    [class*="upload"], [class*="Upload"],
    [class*="dropzone"], [class*="Dropzone"] {
      background: ${bgAlt} !important;
      border-color: ${border} !important;
      border-radius: ${Math.round(radius * 0.667)}px !important;
    }

    /* cards, panels, containers */
    [class*="card"], [class*="Card"],
    [class*="panel"], [class*="Panel"],
    [class*="container"], [class*="section"] {
      background: ${bg} !important;
      border-color: ${border} !important;
    }

    /* error / success states */
    [class*="error"], [class*="Error"] {
      color: ${error} !important;
    }
    [class*="success"], [class*="Success"] {
      color: ${success} !important;
    }

    /* progress / active indicators */
    [class*="progress"], [class*="active"],
    [class*="check"]:checked {
      color: ${accent} !important;
    }
    [class*="progressBar"] > *, [class*="progress-bar"] > * {
      background: ${accent} !important;
    }

    /* scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: ${dark ? '#363850' : '#E0E4EF'};
      border-radius: 2px;
    }
  `
}

export function KycGate({
  walletAddress,
  onComplete,
  onBack,
  isLoading,
  flowError,
  onSdkActiveChange,
}: KycGateProps) {
  const theme = useWidgetTheme()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [approved, setApproved] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sdkConfig = useMemo(
    () => ({
      lang: 'en' as const,
      uiConf: {
        customCssStr: buildSumsubCss(theme),
      },
    }),
    [theme],
  )

  useEffect(() => {
    logger.logInfo('kyc', 'kyc_sdk_initializing', { walletAddress })
    setTokenLoading(true)
    getKycAccessToken(walletAddress)
      .then((token) => {
        logger.logInfo('kyc', 'kyc_sdk_token_received', { walletAddress })
        setAccessToken(token)
        setTokenLoading(false)
      })
      .catch((e) => {
        logger.logError('kyc', 'kyc_sdk_token_failed', e, { walletAddress })
        setError(e.message)
        setTokenLoading(false)
      })
  }, [walletAddress])

  useEffect(() => {
    if (!submitted || approved) return

    logger.logInfo('kyc', 'kyc_polling_started', { walletAddress })

    const poll = async () => {
      try {
        const status = await getKycStatus(walletAddress)
        if (status === 'approved') {
          logger.logInfo('kyc', 'kyc_approved_via_poll', { walletAddress })
          setApproved(true)
        }
      } catch {
        // ignore poll errors
      }
    }

    pollRef.current = setInterval(poll, 3000)
    poll()

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [submitted, approved, walletAddress])

  useEffect(() => {
    if (approved && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [approved])

  const handleTokenExpiration = useCallback(async () => {
    return getKycAccessToken(walletAddress)
  }, [walletAddress])

  const handleMessage = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      logger.logInfo('kyc', 'kyc_sdk_message', {
        messageType: type,
        walletAddress,
      })

      if (type === 'idCheck.onApplicantSubmitted') {
        logger.logInfo('kyc', 'kyc_applicant_submitted', { walletAddress })
        setSubmitted(true)
      }

      if (
        type === 'idCheck.onApplicantStatusChanged' ||
        type === 'idCheck.applicantStatus'
      ) {
        const result = payload?.reviewResult as
          | { reviewAnswer?: string }
          | undefined
        logger.logInfo('kyc', 'kyc_status_changed_sdk', {
          walletAddress,
          reviewAnswer: result?.reviewAnswer,
        })
        if (result?.reviewAnswer === 'GREEN') {
          logger.logInfo('kyc', 'kyc_approved_via_sdk', { walletAddress })
          setApproved(true)
        }
      }
    },
    [walletAddress],
  )

  const handleError = useCallback((err: unknown) => {
    logger.logError('kyc', 'kyc_sdk_error', err, { walletAddress })
  }, [walletAddress])

  const sdkActive = !tokenLoading && !error && !approved && !!accessToken

  useEffect(() => {
    onSdkActiveChange?.(sdkActive)
    return () => { onSdkActiveChange?.(false) }
  }, [sdkActive, onSdkActiveChange])

  const handleRetry = useCallback(() => {
    logger.logInfo('kyc', 'kyc_sdk_retry', { walletAddress })
    setError(null)
    setTokenLoading(true)
    getKycAccessToken(walletAddress)
      .then((token) => {
        logger.logInfo('kyc', 'kyc_sdk_retry_success', { walletAddress })
        setAccessToken(token)
        setTokenLoading(false)
      })
      .catch((e) => {
        logger.logError('kyc', 'kyc_sdk_retry_failed', e, { walletAddress })
        setError(e.message)
        setTokenLoading(false)
      })
  }, [walletAddress])

  if (tokenLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-4"
      >
        <div className="text-center space-y-3 py-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--accent-wash)]">
            <ShieldCheck
              className="w-6 h-6 text-[var(--accent)]"
              strokeWidth={1.5}
            />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Identity Verification
          </h3>
          <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[12px]">Initializing verification...</span>
          </div>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-4"
      >
        <div className="text-center space-y-3 py-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--error-wash)]">
            <AlertCircle
              className="w-6 h-6 text-[var(--error)]"
              strokeWidth={1.5}
            />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Verification Unavailable
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
            {error}
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
            onClick={handleRetry}
            className="btn-primary flex-[2] py-3 text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      </motion.div>
    )
  }

  if (approved) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-4"
      >
        <div className="text-center space-y-3 py-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
              delay: 0.1,
            }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--success-wash)]"
          >
            <CheckCircle2
              className="w-7 h-7 text-[var(--success)]"
              strokeWidth={1.5}
            />
          </motion.div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Verification Complete
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
            Your identity has been verified. You can now proceed with the
            purchase.
          </p>
        </div>

        {flowError && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[12px] text-[var(--error)] font-medium bg-[var(--error-wash)] rounded-xl px-3 py-2 inline-flex items-center gap-2"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {flowError}
          </motion.p>
        )}

        <button
          type="button"
          onClick={onComplete}
          disabled={isLoading}
          className="btn-primary w-full py-3.5 text-sm cursor-pointer"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Setting up payment...
            </span>
          ) : (
            'Continue to Payment'
          )}
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div style={{ minHeight: 460 }}>
        <SumsubWebSdk
          accessToken={accessToken!}
          expirationHandler={handleTokenExpiration}
          config={sdkConfig}
          options={{ adaptIframeHeight: true }}
          onMessage={handleMessage}
          onError={handleError}
        />
      </div>
    </motion.div>
  )
}
