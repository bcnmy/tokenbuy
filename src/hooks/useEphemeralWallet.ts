'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Account, Chain, Transport, WalletClient } from 'viem'
import {
  generateEphemeralWallet,
  loadEphemeralWallet,
  deleteEphemeralWallet,
  getStoredWalletMeta,
  requestRecoveryOtp,
  recoverEphemeralWallet,
  type EphemeralWallet,
} from '@/services/ephemeralWallet'

type ViemWalletClient = WalletClient<Transport, Chain | undefined, Account>

type EphemeralWalletState = {
  address: string
  walletClient: ViemWalletClient | null
  flowId: string | null
  isReady: boolean
  isCreating: boolean
  isInitialized: boolean
  hasPendingFlow: boolean
  error: string | null
}

export function useEphemeralWallet() {
  const [state, setState] = useState<EphemeralWalletState>({
    address: '',
    walletClient: null,
    flowId: null,
    isReady: false,
    isCreating: false,
    isInitialized: false,
    hasPendingFlow: false,
    error: null,
  })

  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const meta = getStoredWalletMeta()
    if (!meta) {
      setState((s) => ({ ...s, isInitialized: true }))
      return
    }

    loadEphemeralWallet()
      .then((wallet) => {
        if (wallet) {
          setState({
            address: wallet.address,
            walletClient: wallet.walletClient,
            flowId: wallet.flowId,
            isReady: true,
            isCreating: false,
            isInitialized: true,
            hasPendingFlow: false,
            error: null,
          })
        } else {
          setState((s) => ({
            ...s,
            isInitialized: true,
            hasPendingFlow: true,
            error: 'Wallet data found but decryption failed. Recovery may be needed.',
          }))
        }
      })
      .catch(() => {
        setState((s) => ({
          ...s,
          isInitialized: true,
          hasPendingFlow: true,
          error: 'Failed to load saved wallet.',
        }))
      })
  }, [])

  const create = useCallback(async (email: string, recipientAddress: string) => {
    if (state.isReady && state.walletClient) {
      return state as EphemeralWallet & { flowId: string }
    }

    setState((s) => ({ ...s, isCreating: true, error: null }))

    try {
      const wallet = await generateEphemeralWallet({ recipientAddress, email })
      setState({
        address: wallet.address,
        walletClient: wallet.walletClient,
        flowId: wallet.flowId,
        isReady: true,
        isCreating: false,
        hasPendingFlow: false,
        error: null,
      })
      return wallet
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ephemeral wallet'
      setState((s) => ({ ...s, isCreating: false, error: message }))
      throw err
    }
  }, [state.isReady, state.walletClient])

  const destroy = useCallback(async () => {
    const { flowId } = state
    setState({
      address: '',
      walletClient: null,
      flowId: null,
      isReady: false,
      isCreating: false,
      hasPendingFlow: false,
      error: null,
    })
    await deleteEphemeralWallet(flowId ?? undefined)
  }, [state.flowId])

  const sendRecoveryCode = useCallback(async (email: string) => {
    await requestRecoveryOtp(email)
  }, [])

  const verifyRecovery = useCallback(async (email: string, otp: string) => {
    setState((s) => ({ ...s, isCreating: true, error: null }))
    try {
      const wallet = await recoverEphemeralWallet({ email, otp })
      setState({
        address: wallet.address,
        walletClient: wallet.walletClient,
        flowId: wallet.flowId,
        isReady: true,
        isCreating: false,
        hasPendingFlow: false,
        error: null,
      })
      return wallet
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recovery failed'
      setState((s) => ({ ...s, isCreating: false, error: message }))
      throw err
    }
  }, [])

  return {
    ...state,
    create,
    destroy,
    sendRecoveryCode,
    verifyRecovery,
    storedMeta: getStoredWalletMeta(),
  }
}
