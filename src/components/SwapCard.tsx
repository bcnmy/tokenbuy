'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownUp, ArrowDown, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { useSwapFlow } from '@/hooks/useSwapFlow'
import { useWidgetTheme } from './WidgetThemeProvider'
import { StepIndicator } from './StepIndicator'
import { AmountInput } from './AmountInput'
import { TokenSelectorTrigger, TokenSelectorPanel } from './TokenSelector'
import { AddressInput } from './AddressInput'
import { QuoteReview } from './QuoteReview'
import { KycGate } from './KycGate'
import { PaymentDetails } from './PaymentDetails'
import { ProcessingView } from './ProcessingView'
import { CompleteView } from './CompleteView'
import { getChainName } from '@/services/bungee'

export function SwapCard() {
  const theme = useWidgetTheme()
  const flow = useSwapFlow(theme?.defaultFiat)
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(false)
  const [kycSdkActive, setKycSdkActive] = useState(false)
  const handleKycSdkActiveChange = useCallback((active: boolean) => setKycSdkActive(active), [])

  const compact = theme?.compactMode ?? false

  return (
    <div className="max-w-full mx-auto" style={{ width: `${theme?.widgetWidth ?? 440}px` }}>
      <motion.div
        layout="position"
        className="card-elevated relative overflow-hidden flex flex-col"
        style={{ maxHeight: '680px' }}
      >
        {(theme?.showStepIndicator !== false) && (
          <div className={compact ? 'px-3.5 pt-3.5' : 'px-5 pt-5'}>
            <StepIndicator currentStep={flow.step} />
          </div>
        )}

        <div className={`flex-1 overflow-y-auto ${compact ? 'px-3.5 pb-3' : 'px-5 pb-4'} relative`}>
          <AnimatePresence mode="wait">
            {flow.step === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="space-y-4"
              >
                <div className="space-y-0.5">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] inline-flex items-center gap-2">
                    <ArrowDownUp className="w-4.5 h-4.5 text-[var(--accent)]" strokeWidth={2} />
                    {theme?.title || 'Buy Crypto'}
                  </h2>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    {theme?.subtitle || '0% onramp fee via Monerium · EU bank transfers'}
                  </p>
                </div>

                <div className="relative">
                  <AmountInput
                    amount={flow.fiatAmount}
                    currency={flow.fiatCurrency}
                    onAmountChange={flow.setFiatAmount}
                    onCurrencyChange={flow.setFiatCurrency}
                  />

                  <div className="flex justify-center -my-[11px] relative z-10">
                    <div className="bg-[var(--surface)] rounded-xl p-0.5">
                      <div className="bg-[var(--surface-3)] rounded-lg p-1.5 border border-[var(--border-light)]">
                        <ArrowDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--surface-2)] rounded-2xl p-3.5 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--text-muted)] font-medium">You receive</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                        on {getChainName(flow.selectedToken.chainId)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-2.5">
                      {flow.isEstimating ? (
                        <div className="flex items-center h-[40px]">
                          <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
                        </div>
                      ) : (
                        <span
                          className={`
                            text-[32px] font-medium tracking-tight select-none
                            font-[family-name:var(--font-ibm-plex-mono)]
                            transition-colors duration-200
                            ${flow.estimate
                              ? 'text-[var(--text-primary)]'
                              : 'text-[var(--text-muted)]/20'
                            }
                          `}
                        >
                          {flow.estimate?.tokenAmount ?? '0'}
                        </span>
                      )}
                      <TokenSelectorTrigger
                        selected={flow.selectedToken}
                        onClick={() => setTokenSelectorOpen(true)}
                      />
                    </div>
                  </div>
                </div>

                {(flow.estimate || flow.isEstimating) && (
                  <div className={`
                    flex items-center justify-between px-1 text-[11px] text-[var(--text-muted)]
                    transition-opacity duration-200
                    ${flow.isEstimating ? 'opacity-40' : ''}
                  `}>
                    {flow.estimate ? (
                      <>
                        <span>{flow.estimate.exchangeRate}</span>
                        <span>Fee {flow.estimate.totalFee}</span>
                      </>
                    ) : (
                      <span className="animate-pulse">Fetching price…</span>
                    )}
                  </div>
                )}

                <AddressInput
                  value={flow.recipientAddress}
                  onChange={flow.setAddress}
                />

                {flow.error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[12px] text-[var(--error)] font-medium bg-[var(--error-wash)] rounded-xl px-3 py-2 inline-flex items-center gap-2"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {flow.error}
                  </motion.p>
                )}

                <button
                  type="button"
                  onClick={flow.requestQuote}
                  disabled={flow.isLoading || !flow.fiatAmount || !flow.recipientAddress}
                  className="btn-primary w-full py-3.5 text-sm cursor-pointer"
                >
                  {flow.isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Getting quote...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      {theme?.ctaText || 'Get Quote'}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </motion.div>
            )}

            {flow.step === 'quote' && flow.quote && (
              <div key="quote" className="space-y-0">
                <QuoteReview
                  quote={flow.quote}
                  onConfirm={flow.proceedFromQuote}
                  onBack={flow.goBack}
                  isLoading={flow.isLoading}
                />
                {flow.error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[12px] text-[var(--error)] font-medium bg-[var(--error-wash)] rounded-xl px-3 py-2 mt-3 inline-flex items-center gap-2"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {flow.error}
                  </motion.p>
                )}
              </div>
            )}

            {flow.step === 'kyc' && (
              <KycGate
                key="kyc"
                walletAddress={flow.recipientAddress}
                onComplete={flow.completeKyc}
                onBack={flow.goBack}
                isLoading={flow.isLoading}
                flowError={flow.error}
                onSdkActiveChange={handleKycSdkActiveChange}
              />
            )}

            {flow.step === 'payment' && flow.paymentInfo && (
              <PaymentDetails
                key="payment"
                payment={flow.paymentInfo}
                onConfirmSent={flow.confirmPayment}
                onBack={flow.goBack}
              />
            )}

            {flow.step === 'processing' && (
              <ProcessingView key="processing" status={flow.transactionStatus} />
            )}

            {flow.step === 'complete' && flow.transaction && (
              <CompleteView
                key="complete"
                transaction={flow.transaction}
                onNewSwap={flow.reset}
              />
            )}
          </AnimatePresence>

        </div>

        {flow.step === 'kyc' && kycSdkActive ? (
          <div className={`${compact ? 'px-3.5 pb-2.5' : 'px-5 pb-3.5'} pt-2 border-t border-[var(--border-light)]`}>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={flow.goBack}
                className="btn-secondary flex-1 py-2.5 text-sm cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={flow.reset}
                className="btn-secondary flex-1 py-2.5 text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (theme?.showFooter !== false) && (
          <div className={`${compact ? 'px-3.5 pb-2.5' : 'px-5 pb-3.5'} pt-2 border-t border-[var(--border-light)]`}>
            <div className="flex flex-col items-center gap-1 w-full">
              {theme?.footerLogoUrl ? (
                <img
                  src={theme.footerLogoUrl}
                  alt=""
                  className="h-4 w-auto object-contain"
                />
              ) : (
                <BiconomyLogo className="h-4 w-auto" />
              )}
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                {theme?.footerText || 'Powered by Biconomy'}
              </span>
            </div>
          </div>
        )}

        <TokenSelectorPanel
          isOpen={tokenSelectorOpen}
          selected={flow.selectedToken}
          onSelect={flow.setToken}
          onClose={() => setTokenSelectorOpen(false)}
        />
      </motion.div>
    </div>
  )
}

function BiconomyLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#FF4E17" />
      <path d="M8 7h3.5c2.2 0 3.5 1 3.5 2.8 0 1.2-.7 2-1.6 2.3 1.1.3 1.9 1.3 1.9 2.7 0 2-1.4 3.2-3.8 3.2H8V7Zm3.3 4.2c1 0 1.5-.5 1.5-1.3 0-.7-.5-1.2-1.5-1.2H10v2.5h1.3Zm.2 4.8c1.1 0 1.7-.5 1.7-1.4 0-.8-.6-1.4-1.7-1.4H10v2.8h1.5Z" fill="white" />
    </svg>
  )
}
