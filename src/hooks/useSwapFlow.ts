'use client'

import { useReducer, useCallback, useEffect, useRef } from 'react'
import type {
  FlowStep,
  SwapQuote,
  QuoteEstimate,
  KycSession,
  PaymentInfo,
  Transaction,
  TransactionStatus,
  Token,
  FiatCurrency,
  Hex,
} from '@/types'
import { fetchQuote, fetchEstimate } from '@/services/quote'
import { getKycStatus } from '@/services/kyc'
import {
  initiateMoneriumAuth,
  fetchIban,
  buildPaymentInfo,
  saveFlowStateForRedirect,
  loadFlowStateAfterRedirect,
  clearFlowState,
  simulatePaymentFlow,
} from '@/services/payment'
import { DEFAULT_TOKEN } from '@/constants/tokens'
import * as logger from '@/services/logger'

type SwapFlowState = {
  step: FlowStep
  fiatCurrency: FiatCurrency
  fiatAmount: string
  selectedToken: Token
  recipientAddress: string
  estimate: QuoteEstimate | null
  isEstimating: boolean
  quote: SwapQuote | null
  kycSession: KycSession | null
  paymentInfo: PaymentInfo | null
  transaction: Transaction | null
  transactionStatus: TransactionStatus | null
  isLoading: boolean
  error: string | null
}

type SwapFlowAction =
  | { type: 'SET_FIAT_CURRENCY'; currency: FiatCurrency }
  | { type: 'SET_FIAT_AMOUNT'; amount: string }
  | { type: 'SET_TOKEN'; token: Token }
  | { type: 'SET_ADDRESS'; address: string }
  | { type: 'ESTIMATING' }
  | { type: 'SET_ESTIMATE'; estimate: QuoteEstimate | null }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_QUOTE'; quote: SwapQuote }
  | { type: 'SET_KYC_SESSION'; session: KycSession }
  | { type: 'SET_PAYMENT_INFO'; info: PaymentInfo }
  | { type: 'SET_TRANSACTION_STATUS'; status: TransactionStatus }
  | { type: 'SET_TRANSACTION'; transaction: Transaction }
  | { type: 'GO_TO_STEP'; step: FlowStep }
  | { type: 'RESET' }

const initialState: SwapFlowState = {
  step: 'input',
  fiatCurrency: 'EUR',
  fiatAmount: '',
  selectedToken: DEFAULT_TOKEN,
  recipientAddress: '',
  estimate: null,
  isEstimating: false,
  quote: null,
  kycSession: null,
  paymentInfo: null,
  transaction: null,
  transactionStatus: null,
  isLoading: false,
  error: null,
}

function reducer(state: SwapFlowState, action: SwapFlowAction): SwapFlowState {
  switch (action.type) {
    case 'SET_FIAT_CURRENCY':
      return { ...state, fiatCurrency: action.currency, error: null }
    case 'SET_FIAT_AMOUNT':
      return { ...state, fiatAmount: action.amount, error: null }
    case 'SET_TOKEN':
      return { ...state, selectedToken: action.token, error: null }
    case 'SET_ADDRESS':
      return { ...state, recipientAddress: action.address, error: null }
    case 'ESTIMATING':
      return { ...state, isEstimating: true }
    case 'SET_ESTIMATE':
      return { ...state, estimate: action.estimate, isEstimating: false }
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading }
    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false }
    case 'SET_QUOTE':
      return { ...state, quote: action.quote, step: 'quote', isLoading: false }
    case 'SET_KYC_SESSION':
      return { ...state, kycSession: action.session }
    case 'SET_PAYMENT_INFO':
      return {
        ...state,
        paymentInfo: action.info,
        step: 'payment',
        isLoading: false,
      }
    case 'SET_TRANSACTION_STATUS':
      return { ...state, transactionStatus: action.status }
    case 'SET_TRANSACTION':
      return {
        ...state,
        transaction: action.transaction,
        step: 'complete',
        isLoading: false,
      }
    case 'GO_TO_STEP':
      return { ...state, step: action.step, error: null, isLoading: false }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function useSwapFlow(defaultFiat?: FiatCurrency) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    fiatCurrency: defaultFiat ?? 'EUR',
  })

  const prevStepRef = useRef(state.step)

  useEffect(() => {
    if (state.step !== prevStepRef.current) {
      logger.logInfo('flow', 'step_changed', {
        from: prevStepRef.current,
        to: state.step,
        walletAddress: state.recipientAddress || undefined,
      })
      prevStepRef.current = state.step
    }
  }, [state.step, state.recipientAddress])

  useEffect(() => {
    if (state.error) {
      logger.logError('flow', 'flow_error_displayed', new Error(state.error), {
        step: state.step,
        walletAddress: state.recipientAddress || undefined,
      })
    }
  }, [state.error, state.step, state.recipientAddress])

  useEffect(() => {
    logger.logInfo('flow', 'session_started', {
      defaultFiat: defaultFiat ?? 'EUR',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore flow after Monerium redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const moneriumResult = params.get('monerium')
    const wallet = params.get('wallet')

    if (!moneriumResult) return

    logger.logInfo('monerium', 'redirect_return', {
      result: moneriumResult,
      walletAddress: wallet ?? undefined,
    })

    // Clean URL
    const url = new URL(window.location.href)
    url.searchParams.delete('monerium')
    url.searchParams.delete('wallet')
    url.searchParams.delete('message')
    window.history.replaceState({}, '', url.pathname + (url.search || ''))

    if (moneriumResult === 'error') {
      const message = params.get('message') || 'Monerium authorization failed'
      logger.logError('monerium', 'redirect_error', new Error(decodeURIComponent(message)), {
        walletAddress: wallet ?? undefined,
      })
      dispatch({ type: 'SET_ERROR', error: decodeURIComponent(message) })
      return
    }

    if (moneriumResult === 'success' && wallet) {
      const saved = loadFlowStateAfterRedirect()
      clearFlowState()

      logger.logInfo('monerium', 'redirect_success_restoring_flow', {
        walletAddress: wallet,
        hasSavedState: !!saved,
        savedAmount: saved?.fiatAmount,
        savedCurrency: saved?.fiatCurrency,
      })

      if (saved) {
        dispatch({ type: 'SET_FIAT_AMOUNT', amount: saved.fiatAmount })
        dispatch({ type: 'SET_FIAT_CURRENCY', currency: saved.fiatCurrency })
        dispatch({ type: 'SET_ADDRESS', address: saved.recipientAddress })
      }

      const targetWallet = saved?.recipientAddress || wallet

      dispatch({ type: 'SET_LOADING', loading: true })

      fetchIban(targetWallet)
        .then((result) => {
          logger.logInfo('monerium', 'iban_fetched_after_redirect', {
            walletAddress: targetWallet,
            ready: result.ready,
            hasIban: !!result.iban,
          })

          if (result.ready && result.iban && result.bic) {
            const info = buildPaymentInfo({
              iban: result.iban,
              bic: result.bic,
              beneficiary: result.beneficiary,
              amount: saved?.fiatAmount || '0',
              currency: saved?.fiatCurrency || 'EUR',
              quoteId: saved?.quoteId || 'restored',
            })
            dispatch({ type: 'SET_ADDRESS', address: targetWallet })
            dispatch({ type: 'SET_PAYMENT_INFO', info })
          } else {
            dispatch({
              type: 'SET_ERROR',
              error: 'Monerium account connected but IBAN is not ready yet. Please try again.',
            })
          }
        })
        .catch((err) => {
          logger.logError('monerium', 'iban_fetch_after_redirect_failed', err, {
            walletAddress: targetWallet,
          })
          dispatch({
            type: 'SET_ERROR',
            error: err instanceof Error ? err.message : 'Failed to load payment info',
          })
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setFiatCurrency = useCallback((currency: FiatCurrency) => {
    dispatch({ type: 'SET_FIAT_CURRENCY', currency })
  }, [])

  const setFiatAmount = useCallback((amount: string) => {
    dispatch({ type: 'SET_FIAT_AMOUNT', amount })
  }, [])

  const setToken = useCallback((token: Token) => {
    logger.logInfo('flow', 'token_selected', {
      symbol: token.symbol,
      chainId: token.chainId,
      name: token.name,
    })
    dispatch({ type: 'SET_TOKEN', token })
  }, [])

  const setAddress = useCallback((address: string) => {
    dispatch({ type: 'SET_ADDRESS', address })
  }, [])

  const requestQuote = useCallback(async () => {
    if (!state.fiatAmount || !state.recipientAddress) {
      dispatch({ type: 'SET_ERROR', error: 'Please fill in all fields' })
      return
    }

    if (
      !state.recipientAddress.startsWith('0x') ||
      state.recipientAddress.length !== 42
    ) {
      logger.logWarn('flow', 'invalid_wallet_address', {
        walletAddress: state.recipientAddress,
        addressLength: state.recipientAddress.length,
      })
      dispatch({ type: 'SET_ERROR', error: 'Invalid wallet address' })
      return
    }

    const amount = parseFloat(state.fiatAmount)
    if (isNaN(amount) || amount < 10) {
      logger.logWarn('flow', 'amount_below_minimum', {
        amount: state.fiatAmount,
        walletAddress: state.recipientAddress,
      })
      dispatch({ type: 'SET_ERROR', error: 'Minimum amount is 10' })
      return
    }

    logger.logInfo('quote', 'quote_requested', {
      fiatAmount: state.fiatAmount,
      fiatCurrency: state.fiatCurrency,
      token: state.selectedToken.symbol,
      chainId: state.selectedToken.chainId,
      walletAddress: state.recipientAddress,
    })

    dispatch({ type: 'SET_LOADING', loading: true })
    dispatch({ type: 'SET_ERROR', error: null })

    try {
      const quote = await fetchQuote({
        fiatCurrency: state.fiatCurrency,
        fiatAmount: state.fiatAmount,
        token: state.selectedToken,
        recipientAddress: state.recipientAddress as Hex,
      })

      logger.logInfo('quote', 'quote_received', {
        quoteId: quote.id,
        tokenAmount: quote.tokenAmount,
        exchangeRate: quote.exchangeRate,
        fees: quote.fees.total,
        estimatedTime: quote.estimatedTime,
        routeName: quote.routeName,
        walletAddress: state.recipientAddress,
      })

      dispatch({ type: 'SET_QUOTE', quote })
    } catch (err) {
      logger.logError('quote', 'quote_failed', err, {
        fiatAmount: state.fiatAmount,
        fiatCurrency: state.fiatCurrency,
        token: state.selectedToken.symbol,
        walletAddress: state.recipientAddress,
      })
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to fetch quote',
      })
    }
  }, [
    state.fiatAmount,
    state.fiatCurrency,
    state.selectedToken,
    state.recipientAddress,
  ])

  const startMoneriumAuth = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true })
    dispatch({ type: 'SET_ERROR', error: null })

    logger.logInfo('monerium', 'auth_initiated', {
      walletAddress: state.recipientAddress,
    })

    try {
      const result = await initiateMoneriumAuth(state.recipientAddress)

      if (!result.authUrl) {
        const ibanResult = await fetchIban(state.recipientAddress)
        if (ibanResult.ready && ibanResult.iban && ibanResult.bic) {
          logger.logInfo('monerium', 'already_onboarded', {
            walletAddress: state.recipientAddress,
            hasIban: true,
          })
          const info = buildPaymentInfo({
            iban: ibanResult.iban,
            bic: ibanResult.bic,
            beneficiary: ibanResult.beneficiary,
            amount: state.fiatAmount,
            currency: state.fiatCurrency,
            quoteId: state.quote?.id || 'direct',
          })
          dispatch({ type: 'SET_PAYMENT_INFO', info })
          return
        }
      }

      if (result.authUrl) {
        logger.logInfo('monerium', 'redirecting_to_auth', {
          walletAddress: state.recipientAddress,
          fiatAmount: state.fiatAmount,
          fiatCurrency: state.fiatCurrency,
        })

        saveFlowStateForRedirect({
          fiatAmount: state.fiatAmount,
          fiatCurrency: state.fiatCurrency,
          quoteId: state.quote?.id || '',
          recipientAddress: state.recipientAddress,
          tokenSymbol: state.selectedToken.symbol,
          savedAt: Date.now(),
        })

        window.location.href = result.authUrl
      }
    } catch (err) {
      logger.logError('monerium', 'auth_failed', err, {
        walletAddress: state.recipientAddress,
      })
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to connect to Monerium',
      })
    }
  }, [state.recipientAddress, state.fiatAmount, state.fiatCurrency, state.quote, state.selectedToken])

  const proceedFromQuote = useCallback(async () => {
    logger.logInfo('flow', 'proceeding_from_quote', {
      quoteId: state.quote?.id,
      walletAddress: state.recipientAddress,
    })

    dispatch({ type: 'SET_LOADING', loading: true })

    try {
      const kycStatus = await getKycStatus(state.recipientAddress)

      logger.logInfo('kyc', 'status_checked', {
        status: kycStatus,
        walletAddress: state.recipientAddress,
      })

      if (kycStatus === 'approved') {
        const ibanResult = await fetchIban(state.recipientAddress)

        logger.logInfo('monerium', 'iban_checked_after_kyc', {
          walletAddress: state.recipientAddress,
          ready: ibanResult.ready,
          hasIban: !!ibanResult.iban,
          needsAuth: ibanResult.needsAuth,
        })

        if (ibanResult.ready && ibanResult.iban && ibanResult.bic) {
          const info = buildPaymentInfo({
            iban: ibanResult.iban,
            bic: ibanResult.bic,
            beneficiary: ibanResult.beneficiary,
            amount: state.fiatAmount,
            currency: state.fiatCurrency,
            quoteId: state.quote!.id,
          })
          dispatch({ type: 'SET_PAYMENT_INFO', info })
        } else if (ibanResult.needsAuth) {
          logger.logInfo('monerium', 'needs_auth_redirect', {
            walletAddress: state.recipientAddress,
          })
          await startMoneriumAuth()
        } else {
          dispatch({
            type: 'SET_ERROR',
            error: 'IBAN is not ready yet. Please try again in a moment.',
          })
        }
      } else {
        logger.logInfo('kyc', 'kyc_required', {
          currentStatus: kycStatus,
          walletAddress: state.recipientAddress,
        })
        dispatch({ type: 'GO_TO_STEP', step: 'kyc' })
      }
    } catch (err) {
      logger.logError('flow', 'proceed_from_quote_failed', err, {
        walletAddress: state.recipientAddress,
        quoteId: state.quote?.id,
      })
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Something went wrong',
      })
    }
  }, [state.recipientAddress, state.fiatAmount, state.fiatCurrency, state.quote, startMoneriumAuth])

  const completeKyc = useCallback(async () => {
    logger.logInfo('kyc', 'kyc_completion_attempted', {
      walletAddress: state.recipientAddress,
    })

    dispatch({ type: 'SET_LOADING', loading: true })

    try {
      const status = await getKycStatus(state.recipientAddress)

      logger.logInfo('kyc', 'kyc_status_after_completion', {
        status,
        walletAddress: state.recipientAddress,
      })

      if (status !== 'approved') {
        logger.logWarn('kyc', 'kyc_not_yet_approved', {
          status,
          walletAddress: state.recipientAddress,
        })
        dispatch({
          type: 'SET_ERROR',
          error: 'Verification is still processing. Please wait a moment and try again.',
        })
        return
      }

      dispatch({
        type: 'SET_KYC_SESSION',
        session: {
          applicantId: '',
          status: 'approved',
          provider: 'sumsub',
        },
      })

      const ibanResult = await fetchIban(state.recipientAddress)

      logger.logInfo('monerium', 'iban_checked_after_kyc_complete', {
        walletAddress: state.recipientAddress,
        ready: ibanResult.ready,
        hasIban: !!ibanResult.iban,
        needsAuth: ibanResult.needsAuth,
      })

      if (ibanResult.ready && ibanResult.iban && ibanResult.bic) {
        const info = buildPaymentInfo({
          iban: ibanResult.iban,
          bic: ibanResult.bic,
          beneficiary: ibanResult.beneficiary,
          amount: state.fiatAmount,
          currency: state.fiatCurrency,
          quoteId: state.quote?.id || 'kyc-complete',
        })
        dispatch({ type: 'SET_PAYMENT_INFO', info })
      } else {
        logger.logInfo('monerium', 'redirecting_to_monerium_after_kyc', {
          walletAddress: state.recipientAddress,
        })
        await startMoneriumAuth()
      }
    } catch (err) {
      logger.logError('kyc', 'kyc_completion_failed', err, {
        walletAddress: state.recipientAddress,
      })
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'KYC verification failed',
      })
    }
  }, [state.recipientAddress, state.fiatAmount, state.fiatCurrency, state.quote, startMoneriumAuth])

  const confirmPayment = useCallback(async () => {
    logger.logInfo('payment', 'payment_confirmed', {
      quoteId: state.quote?.id,
      token: state.selectedToken.symbol,
      tokenAmount: state.quote?.tokenAmount,
      walletAddress: state.recipientAddress,
    })

    dispatch({ type: 'GO_TO_STEP', step: 'processing' })
    dispatch({ type: 'SET_TRANSACTION_STATUS', status: 'awaiting_payment' })

    try {
      const transaction = await simulatePaymentFlow({
        quoteId: state.quote?.id || 'direct',
        token: state.selectedToken,
        tokenAmount: state.quote?.tokenAmount || '0',
        onStatusChange: (status) => {
          logger.logInfo('payment', 'transaction_status_changed', {
            status,
            quoteId: state.quote?.id,
            walletAddress: state.recipientAddress,
          })
          dispatch({ type: 'SET_TRANSACTION_STATUS', status })
        },
      })

      logger.logInfo('payment', 'transaction_complete', {
        transactionId: transaction.id,
        txHash: transaction.txHash,
        tokenAmount: transaction.tokenAmount,
        token: transaction.token.symbol,
        walletAddress: state.recipientAddress,
      })

      dispatch({ type: 'SET_TRANSACTION', transaction })
    } catch (err) {
      logger.logError('payment', 'transaction_failed', err, {
        quoteId: state.quote?.id,
        walletAddress: state.recipientAddress,
      })
      dispatch({
        type: 'SET_ERROR',
        error:
          err instanceof Error ? err.message : 'Transaction failed',
      })
    }
  }, [state.quote, state.selectedToken, state.recipientAddress])

  const ESTIMATE_DEBOUNCE_MS = 600

  useEffect(() => {
    const amount = parseFloat(state.fiatAmount)
    if (!state.fiatAmount || isNaN(amount) || amount <= 0) {
      dispatch({ type: 'SET_ESTIMATE', estimate: null })
      return
    }

    dispatch({ type: 'ESTIMATING' })

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const result = await fetchEstimate(
          {
            fiatCurrency: state.fiatCurrency,
            fiatAmount: state.fiatAmount,
            token: state.selectedToken,
          },
          controller.signal,
        )
        dispatch({ type: 'SET_ESTIMATE', estimate: result })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        logger.logWarn('quote', 'estimate_failed', {
          fiatAmount: state.fiatAmount,
          fiatCurrency: state.fiatCurrency,
          token: state.selectedToken.symbol,
          errorMessage: err instanceof Error ? err.message : String(err),
        })
        dispatch({ type: 'SET_ESTIMATE', estimate: null })
      }
    }, ESTIMATE_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [state.fiatAmount, state.fiatCurrency, state.selectedToken])

  const reset = useCallback(() => {
    logger.logInfo('flow', 'flow_reset', {
      previousStep: state.step,
      walletAddress: state.recipientAddress || undefined,
    })
    logger.resetSession()
    dispatch({ type: 'RESET' })
  }, [state.step, state.recipientAddress])

  const goBack = useCallback(() => {
    const stepOrder: FlowStep[] = [
      'input',
      'quote',
      'kyc',
      'payment',
      'processing',
      'complete',
    ]
    const currentIndex = stepOrder.indexOf(state.step)
    if (currentIndex > 0) {
      logger.logInfo('flow', 'step_back', {
        from: state.step,
        to: stepOrder[currentIndex - 1],
        walletAddress: state.recipientAddress || undefined,
      })
      dispatch({ type: 'GO_TO_STEP', step: stepOrder[currentIndex - 1] })
    }
  }, [state.step, state.recipientAddress])

  return {
    ...state,
    setFiatCurrency,
    setFiatAmount,
    setToken,
    setAddress,
    requestQuote,
    proceedFromQuote,
    completeKyc,
    confirmPayment,
    reset,
    goBack,
  }
}
