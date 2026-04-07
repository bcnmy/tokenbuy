'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownUp, ArrowDown, ArrowRight, ArrowLeft, Loader2, AlertCircle, Mail, LogOut } from 'lucide-react'
import { useAccount, useWalletClient } from 'wagmi'
import { isAddress } from 'viem'
import { useSwapFlow } from '@/hooks/useSwapFlow'
import { useEphemeralWallet } from '@/hooks/useEphemeralWallet'
import { useWidgetTheme } from './WidgetThemeProvider'
import { StepIndicator } from './StepIndicator'
import { AmountInput } from './AmountInput'
import { TokenSelectorTrigger, TokenSelectorPanel } from './TokenSelector'
import { WalletButton } from './WalletButton'
import { AddressInput } from './AddressInput'
import { ModeToggle } from './ModeToggle'
import { QuoteReview } from './QuoteReview'
import { PaymentDetails } from './PaymentDetails'
import { ProcessingView } from './ProcessingView'
import { CompleteView } from './CompleteView'
import { RecoveryPrompt } from './RecoveryPrompt'
import { getChainName } from '@/services/bungee'
import { logoutMonerium } from '@/services/payment'
import type { InputMode } from '@/types'

export function SwapCard() {
  const theme = useWidgetTheme()
  const flow = useSwapFlow(theme?.defaultFiat)
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(false)
  const [mode, setMode] = useState<InputMode>('connect_wallet')
  const [email, setEmail] = useState('')
  const [showRecovery, setShowRecovery] = useState(false)
  const { isConnected } = useAccount()
  const { data: wagmiWalletClient } = useWalletClient()
  const ephemeral = useEphemeralWallet()

  const compact = theme?.compactMode ?? false

  // Persist and restore mode across page refreshes
  useEffect(() => {
    const saved = localStorage.getItem('tokenbuy_input_mode')
    if (saved === 'connect_wallet' || saved === 'paste_address') {
      setMode(saved)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tokenbuy_input_mode', mode)
  }, [mode])

  // Sync wagmi wallet client as signer in connect_wallet mode
  useEffect(() => {
    if (mode === 'connect_wallet' && wagmiWalletClient) {
      flow.setSigner(wagmiWalletClient)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wagmiWalletClient])

  // Sync ephemeral wallet as signer in paste_address mode
  useEffect(() => {
    if (mode === 'paste_address' && ephemeral.walletClient) {
      flow.setSigner(ephemeral.walletClient)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ephemeral.walletClient])

  // Sync ephemeral wallet address as signerAddress in paste_address mode
  useEffect(() => {
    if (mode === 'paste_address' && ephemeral.address) {
      flow.setSignerAddress(ephemeral.address)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ephemeral.address])

  // Restore email from stored ephemeral wallet metadata
  useEffect(() => {
    if (mode === 'paste_address' && ephemeral.storedMeta?.email && !email) {
      setEmail(ephemeral.storedMeta.email)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ephemeral.storedMeta])

  // Show recovery prompt only after init completes and we confirmed the key is unloadable
  useEffect(() => {
    if (ephemeral.isInitialized && ephemeral.hasPendingFlow && !ephemeral.isReady && !ephemeral.isCreating) {
      setShowRecovery(true)
      setMode('paste_address')
    }
  }, [ephemeral.isInitialized, ephemeral.hasPendingFlow, ephemeral.isReady, ephemeral.isCreating])

  // Clean up ephemeral wallet when transaction completes
  useEffect(() => {
    if (flow.step === 'complete' && ephemeral.isReady) {
      ephemeral.destroy()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.step])

  const handleReset = useCallback(() => {
    ephemeral.destroy()
    setEmail('')
    flow.reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ephemeral.destroy, flow.reset])

  const handleLogout = useCallback(async () => {
    const walletAddress = flow.signerAddress || flow.recipientAddress || ephemeral.address || ephemeral.storedMeta?.address
    if (walletAddress) {
      try { await logoutMonerium(walletAddress) } catch { /* best effort */ }
    }
    await ephemeral.destroy()
    setEmail('')
    localStorage.removeItem('tokenbuy_input_mode')
    flow.reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.signerAddress, flow.recipientAddress, ephemeral.address, ephemeral.destroy, flow.reset])

  const handleModeChange = useCallback((newMode: InputMode) => {
    setMode(newMode)
    setEmail('')
    flow.setAddress('')
    flow.setSignerAddress('')
    flow.setSigner(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWalletAddressChange = useCallback((addr: string) => {
    flow.setAddress(addr)
    flow.setSignerAddress(addr)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGetQuote = async () => {
    if (mode === 'paste_address') {
      if (!ephemeral.isReady) {
        try {
          const wallet = await ephemeral.create(email, flow.recipientAddress)
          flow.setSigner(wallet.walletClient)
          flow.setSignerAddress(wallet.address)
          flow.setFlowId(wallet.flowId)
        } catch {
          return
        }
      }
    }
    flow.requestQuote()
  }

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const isAddressReady = mode === 'connect_wallet'
    ? isConnected
    : flow.recipientAddress.length === 42
      && isAddress(flow.recipientAddress, { strict: false })
      && isEmailValid

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
            {flow.step === 'input' && showRecovery && (
              <RecoveryPrompt
                key="recovery"
                defaultEmail={ephemeral.storedMeta?.email}
                onSendCode={ephemeral.sendRecoveryCode}
                onRecover={async (recoveryEmail, otp) => {
                  const wallet = await ephemeral.verifyRecovery(recoveryEmail, otp)
                  flow.setSigner(wallet.walletClient)
                  flow.setSignerAddress(wallet.address)
                  flow.setFlowId(wallet.flowId)
                  setShowRecovery(false)
                }}
                onDismiss={() => {
                  setShowRecovery(false)
                  ephemeral.destroy()
                }}
              />
            )}

            {flow.step === 'input' && !showRecovery && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="space-y-4"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)] inline-flex items-center gap-2">
                      <ArrowDownUp className="w-4.5 h-4.5 text-[var(--accent)]" strokeWidth={2} />
                      {theme?.title || 'Buy Crypto'}
                    </h2>
                    <button
                      type="button"
                      onClick={handleLogout}
                      title="Log out and clear data"
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-wash)] transition-colors duration-150 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

                <ModeToggle mode={mode} onChange={handleModeChange} />

                {mode === 'connect_wallet' ? (
                  <WalletButton onAddressChange={handleWalletAddressChange} />
                ) : (
                  <>
                    <AddressInput value={flow.recipientAddress} onChange={flow.setAddress} />
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
                          className="
                            flex-1 bg-transparent text-[13px] text-[var(--text-primary)]
                            placeholder:text-[var(--text-muted)]/40 outline-none
                          "
                        />
                      </div>
                      <p className="text-[9px] text-[var(--text-muted)] pl-1">
                        Used only for fund recovery if you clear browser data mid-transaction
                      </p>
                    </div>
                  </>
                )}

                {(flow.error || ephemeral.error) && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[12px] text-[var(--error)] font-medium bg-[var(--error-wash)] rounded-xl px-3 py-2 inline-flex items-center gap-2"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {flow.error || ephemeral.error}
                  </motion.p>
                )}

                <button
                  type="button"
                  onClick={handleGetQuote}
                  disabled={flow.isLoading || ephemeral.isCreating || !flow.fiatAmount || !isAddressReady}
                  className="btn-primary w-full py-3.5 text-sm cursor-pointer"
                >
                  {flow.isLoading || ephemeral.isCreating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {ephemeral.isCreating ? 'Preparing wallet...' : 'Getting quote...'}
                    </span>
                  ) : !isAddressReady ? (
                    <span className="text-[var(--text-muted)]">
                      {mode === 'connect_wallet'
                        ? 'Connect wallet to continue'
                        : !flow.recipientAddress || flow.recipientAddress.length < 42
                          ? 'Enter recipient address to continue'
                          : 'Enter recovery email to continue'}
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

            {flow.step === 'payment' && !flow.paymentInfo && (
              <motion.div
                key="payment-waiting"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center justify-center py-12 space-y-5">
                  <div className="relative">
                    <motion.div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        inset: '-16px',
                        background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
                      }}
                      animate={{ scale: [0.5, 1.2], opacity: [0.15, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
                    </div>
                  </div>
                  <div className="text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                        Waiting for IBAN
                      </p>
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
                    <p className="text-[12px] text-[var(--text-muted)] leading-relaxed max-w-[260px]">
                      Your Monerium account is being provisioned. This usually takes a few seconds.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={flow.goBack}
                  className="btn-secondary w-full py-3 text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              </motion.div>
            )}

            {flow.step === 'payment' && flow.paymentInfo && (
              <PaymentDetails
                key="payment"
                payment={flow.paymentInfo}
                onBack={flow.goBack}
              />
            )}

            {flow.step === 'processing' && (
              <ProcessingView key="processing" status={flow.transactionStatus} pendingTxHash={flow.pendingTxHash} error={flow.error} />
            )}

            {flow.step === 'complete' && flow.transaction && (
              <CompleteView
                key="complete"
                transaction={flow.transaction}
                onNewSwap={handleReset}
              />
            )}
          </AnimatePresence>

        </div>

        {(theme?.showFooter !== false) && (
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
