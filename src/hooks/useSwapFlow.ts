'use client'

import { useReducer, useCallback, useEffect, useRef } from 'react'
import type {
  FlowStep,
  SwapQuote,
  QuoteEstimate,
  PaymentInfo,
  Transaction,
  TransactionStatus,
  Token,
  FiatCurrency,
  Hex,
} from '@/types'
import { fetchQuote, fetchEstimate } from '@/services/quote'
import {
  initiateMoneriumAuth,
  fetchIban,
  buildPaymentInfo,
  saveFlowStateForRedirect,
  loadFlowStateAfterRedirect,
  clearFlowState,
  watchForEureDeposit,
} from '@/services/payment'
import { getManualRouteQuote, buildBungeeTx } from '@/services/bungee'
import { executeFusionSwap, getNexusAddress, BRIDGE_FEE_RESERVE_EUR } from '@/services/biconomy'
import { DEFAULT_TOKEN, GBP_TO_EUR } from '@/constants/tokens'
import * as logger from '@/services/logger'
import type { Account, Chain, Transport, WalletClient } from 'viem'

type SwapFlowState = {
  step: FlowStep
  fiatCurrency: FiatCurrency
  fiatAmount: string
  selectedToken: Token
  recipientAddress: string
  signerAddress: string
  flowId: string | null
  estimate: QuoteEstimate | null
  isEstimating: boolean
  quote: SwapQuote | null
  paymentInfo: PaymentInfo | null
  transaction: Transaction | null
  transactionStatus: TransactionStatus | null
  pendingTxHash: string | null
  isWaitingForIban: boolean
  isLoading: boolean
  error: string | null
}

type SwapFlowAction =
  | { type: 'SET_FIAT_CURRENCY'; currency: FiatCurrency }
  | { type: 'SET_FIAT_AMOUNT'; amount: string }
  | { type: 'SET_TOKEN'; token: Token }
  | { type: 'SET_ADDRESS'; address: string }
  | { type: 'SET_SIGNER_ADDRESS'; address: string }
  | { type: 'SET_FLOW_ID'; flowId: string }
  | { type: 'ESTIMATING' }
  | { type: 'SET_ESTIMATE'; estimate: QuoteEstimate | null }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_QUOTE'; quote: SwapQuote }
  | { type: 'SET_PAYMENT_INFO'; info: PaymentInfo }
  | { type: 'SET_TRANSACTION_STATUS'; status: TransactionStatus }
  | { type: 'SET_PENDING_TX_HASH'; hash: string }
  | { type: 'SET_TRANSACTION'; transaction: Transaction }
  | { type: 'WAITING_FOR_IBAN' }
  | { type: 'GO_TO_STEP'; step: FlowStep }
  | { type: 'RESET' }

const initialState: SwapFlowState = {
  step: 'input',
  fiatCurrency: 'EUR',
  fiatAmount: '',
  selectedToken: DEFAULT_TOKEN,
  recipientAddress: '',
  signerAddress: '',
  flowId: null,
  estimate: null,
  isEstimating: false,
  quote: null,
  paymentInfo: null,
  transaction: null,
  transactionStatus: null,
  pendingTxHash: null,
  isWaitingForIban: false,
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
    case 'SET_SIGNER_ADDRESS':
      return { ...state, signerAddress: action.address, error: null }
    case 'SET_FLOW_ID':
      return { ...state, flowId: action.flowId }
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
    case 'SET_PAYMENT_INFO':
      return {
        ...state,
        paymentInfo: action.info,
        step: 'payment',
        isLoading: false,
        isWaitingForIban: false,
      }
    case 'SET_TRANSACTION_STATUS':
      return { ...state, transactionStatus: action.status }
    case 'SET_PENDING_TX_HASH':
      return { ...state, pendingTxHash: action.hash }
    case 'SET_TRANSACTION':
      return {
        ...state,
        transaction: action.transaction,
        step: 'complete',
        isLoading: false,
      }
    case 'WAITING_FOR_IBAN':
      return { ...state, step: 'payment', isWaitingForIban: true, isLoading: false, error: null }
    case 'GO_TO_STEP':
      return { ...state, step: action.step, error: null, isLoading: false, isWaitingForIban: false }
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
  const pollAbortRef = useRef<AbortController | null>(null)
  const walletClientRef = useRef<WalletClient<Transport, Chain | undefined, Account> | null>(null)

  const setSigner = useCallback((wc: WalletClient<Transport, Chain | undefined, Account> | null) => {
    walletClientRef.current = wc
  }, [])

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
        if (saved.signerAddress) {
          dispatch({ type: 'SET_SIGNER_ADDRESS', address: saved.signerAddress })
        }
        if (saved.flowId) {
          dispatch({ type: 'SET_FLOW_ID', flowId: saved.flowId })
        }
      }

      const targetWallet = saved?.signerAddress || saved?.recipientAddress || wallet

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
            dispatch({ type: 'WAITING_FOR_IBAN' })
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

  // Poll for IBAN when waiting for Monerium provisioning
  useEffect(() => {
    if (!state.isWaitingForIban) return

    const moneriumWallet = state.signerAddress || state.recipientAddress
    if (!moneriumWallet) return

    let cancelled = false
    const IBAN_POLL_MS = 3_000

    logger.logInfo('monerium', 'iban_polling_started', { walletAddress: moneriumWallet })

    ;(async () => {
      while (!cancelled) {
        await new Promise(r => setTimeout(r, IBAN_POLL_MS))
        if (cancelled) return
        try {
          const result = await fetchIban(moneriumWallet)
          if (cancelled) return
          if (result.ready && result.iban && result.bic) {
            logger.logInfo('monerium', 'iban_polling_resolved', {
              walletAddress: moneriumWallet,
              iban: result.iban,
            })
            const info = buildPaymentInfo({
              iban: result.iban,
              bic: result.bic,
              beneficiary: result.beneficiary,
              amount: state.fiatAmount,
              currency: state.fiatCurrency,
              quoteId: state.quote?.id || 'restored',
            })
            dispatch({ type: 'SET_PAYMENT_INFO', info })
            return
          }
        } catch {
          // non-fatal: retry on next tick
        }
      }
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isWaitingForIban])

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

  const setSignerAddress = useCallback((address: string) => {
    dispatch({ type: 'SET_SIGNER_ADDRESS', address })
  }, [])

  const setFlowId = useCallback((flowId: string) => {
    dispatch({ type: 'SET_FLOW_ID', flowId })
  }, [])

  const requestQuote = useCallback(async () => {
    if (!state.fiatAmount || !state.recipientAddress) {
      dispatch({ type: 'SET_ERROR', error: 'Please enter an amount and wallet address' })
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

    dispatch({ type: 'SET_ERROR', error: null })
    dispatch({ type: 'SET_LOADING', loading: true })

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

  const MONERIUM_LINK_MESSAGE = 'I hereby declare that I am the address owner.'

  const startMoneriumAuth = useCallback(async () => {
    const moneriumWallet = state.signerAddress || state.recipientAddress
    dispatch({ type: 'SET_ERROR', error: null })
    dispatch({ type: 'SET_LOADING', loading: true })

    logger.logInfo('monerium', 'auth_initiated', {
      walletAddress: moneriumWallet,
    })

    try {
      let signature: string | undefined
      const wc = walletClientRef.current
      if (wc && state.signerAddress && state.signerAddress !== state.recipientAddress) {
        try {
          signature = await wc.signMessage({ message: MONERIUM_LINK_MESSAGE })
          logger.logInfo('monerium', 'auto_link_signature_created', { walletAddress: moneriumWallet })
        } catch (err) {
          logger.logWarn('monerium', 'auto_link_signature_failed', {
            walletAddress: moneriumWallet,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      const result = await initiateMoneriumAuth(moneriumWallet, { signature })

      if (!result.authUrl) {
        dispatch({
          type: 'SET_ERROR',
          error: 'Unable to start Monerium authorization. Please try again.',
        })
        return
      }

      logger.logInfo('monerium', 'redirecting_to_auth', {
        walletAddress: moneriumWallet,
        fiatAmount: state.fiatAmount,
        fiatCurrency: state.fiatCurrency,
      })

      saveFlowStateForRedirect({
        fiatAmount: state.fiatAmount,
        fiatCurrency: state.fiatCurrency,
        quoteId: state.quote?.id || '',
        recipientAddress: state.recipientAddress,
        signerAddress: state.signerAddress || undefined,
        tokenSymbol: state.selectedToken.symbol,
        flowId: state.flowId || undefined,
        savedAt: Date.now(),
      })

      window.location.href = result.authUrl
    } catch (err) {
      logger.logError('monerium', 'auth_failed', err, {
        walletAddress: moneriumWallet,
      })
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to connect to Monerium',
      })
    }
  }, [state.recipientAddress, state.signerAddress, state.fiatAmount, state.fiatCurrency, state.quote, state.selectedToken])

  const proceedFromQuote = useCallback(async () => {
    const moneriumWallet = state.signerAddress || state.recipientAddress

    logger.logInfo('flow', 'proceeding_from_quote', {
      quoteId: state.quote?.id,
      walletAddress: moneriumWallet,
      recipientAddress: state.recipientAddress,
    })

    dispatch({ type: 'SET_LOADING', loading: true })

    try {
      const ibanResult = await fetchIban(moneriumWallet)

      logger.logInfo('monerium', 'iban_checked', {
        walletAddress: moneriumWallet,
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
          walletAddress: moneriumWallet,
        })
        await startMoneriumAuth()
      } else {
        dispatch({ type: 'WAITING_FOR_IBAN' })
      }
    } catch (err) {
      logger.logError('flow', 'proceed_from_quote_failed', err, {
        walletAddress: moneriumWallet,
        quoteId: state.quote?.id,
      })
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Something went wrong',
      })
    }
  }, [state.recipientAddress, state.signerAddress, state.fiatAmount, state.fiatCurrency, state.quote, startMoneriumAuth])

  const executeSwapRef = useRef<((depositedAmount: bigint) => Promise<void>) | undefined>(undefined)

  const executeSwapAfterDeposit = useCallback(async (depositedAmount: bigint) => {
    const wc = walletClientRef.current
    if (!wc) {
      logger.logError('swap', 'no_signer_available', new Error('Wallet not connected for swap'))
      dispatch({
        type: 'SET_ERROR',
        error: 'Wallet disconnected. Please reconnect to complete the swap.',
      })
      return
    }

    dispatch({ type: 'SET_TRANSACTION_STATUS', status: 'converting' })

    try {
      const eurAmount = state.fiatCurrency === 'GBP'
        ? parseFloat(state.fiatAmount) * GBP_TO_EUR
        : parseFloat(state.fiatAmount)

      const nexusAddress = await getNexusAddress(wc)

      logger.logInfo('swap', 're_quoting_bungee', {
        walletAddress: state.recipientAddress,
        nexusAddress,
        eurAmount,
        token: state.selectedToken.symbol,
      })

      const freshQuote = await getManualRouteQuote({
        eurAmount: eurAmount - BRIDGE_FEE_RESERVE_EUR,
        destinationChainId: state.selectedToken.chainId,
        outputToken: state.selectedToken.address,
        receiverAddress: state.recipientAddress,
        userAddress: nexusAddress,
      })

      logger.logInfo('swap', 'building_bungee_tx', { quoteId: freshQuote.quoteId })

      const bungeeTx = await buildBungeeTx(freshQuote.quoteId)

      logger.logInfo('swap', 'executing_fusion_swap', {
        walletAddress: state.recipientAddress,
        txTo: bungeeTx.txData.to,
        chainId: bungeeTx.txData.chainId,
        hasApproval: !!bungeeTx.approvalData,
      })

      const result = await executeFusionSwap({
        walletClient: wc,
        eureAmount: depositedAmount,
        bungeeTx,
        recipientAddress: state.recipientAddress as `0x${string}`,
        onStatusChange: (status, hash) => {
          logger.logInfo('swap', 'fusion_status', { status, hash })
          if (status === 'executing') {
            dispatch({ type: 'SET_TRANSACTION_STATUS', status: 'sending' })
          }
          if (hash) {
            dispatch({ type: 'SET_PENDING_TX_HASH', hash })
          }
        },
      })

      logger.logInfo('swap', 'fusion_swap_complete', { hash: result.hash })

      dispatch({
        type: 'SET_TRANSACTION',
        transaction: {
          id: `tx_${Date.now()}`,
          status: 'complete',
          txHash: result.hash,
          tokenAmount: state.quote?.tokenAmount ?? '0',
          token: state.selectedToken,
          createdAt: Date.now(),
        },
      })
    } catch (err) {
      logger.logError('swap', 'fusion_swap_failed', err, {
        walletAddress: state.recipientAddress,
      })
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Swap failed. Your EURe is safe in your wallet.',
      })
    }
  }, [state.fiatAmount, state.fiatCurrency, state.selectedToken, state.recipientAddress, state.quote])

  executeSwapRef.current = executeSwapAfterDeposit

  // Auto-start watching for EURe deposit when entering the payment step
  useEffect(() => {
    if (state.step !== 'payment' || !state.paymentInfo) return

    const depositWallet = state.signerAddress || state.recipientAddress
    if (!depositWallet) return

    const abortController = new AbortController()
    pollAbortRef.current?.abort()
    pollAbortRef.current = abortController

    logger.logInfo('payment', 'auto_watch_started', {
      quoteId: state.quote?.id,
      walletAddress: depositWallet,
    })

    dispatch({ type: 'SET_TRANSACTION_STATUS', status: 'awaiting_payment' })

    ;(async () => {
      try {
        const { depositedWei, transaction } = await watchForEureDeposit({
          walletAddress: depositWallet,
          onStatusChange: (status) => {
            logger.logInfo('payment', 'transaction_status_changed', {
              status,
              walletAddress: depositWallet,
            })
            dispatch({ type: 'SET_TRANSACTION_STATUS', status })
          },
          signal: abortController.signal,
        })

        logger.logInfo('payment', 'eure_deposit_detected', {
          transactionId: transaction.id,
          eureAmount: transaction.tokenAmount,
          depositedWei: depositedWei.toString(),
          walletAddress: depositWallet,
        })

        dispatch({ type: 'GO_TO_STEP', step: 'processing' })
        dispatch({ type: 'SET_TRANSACTION_STATUS', status: 'payment_received' })

        await executeSwapRef.current?.(depositedWei)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        logger.logError('payment', 'deposit_watch_failed', err, {
          walletAddress: depositWallet,
        })
        dispatch({
          type: 'SET_ERROR',
          error:
            err instanceof Error ? err.message : 'Failed to detect deposit',
        })
      }
    })()

    return () => {
      abortController.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.paymentInfo])

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

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort()
    }
  }, [])

  const reset = useCallback(() => {
    pollAbortRef.current?.abort()
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
    setSignerAddress,
    setFlowId,
    setSigner,
    requestQuote,
    proceedFromQuote,
    reset,
    goBack,
  }
}
