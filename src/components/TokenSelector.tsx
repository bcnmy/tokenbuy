'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, X, Search, Check, Loader2 } from 'lucide-react'
import type { Token, Chain } from '@/types'
import { getReceivableChains, getTokenList, registerChains, getChainName, getChainColor } from '@/services/bungee'

function TokenIcon({ token, size = 20, className = '' }: { token: Token; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  const color = getChainColor(token.chainId)

  if (failed || !token.icon) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4, background: color }}
      >
        {token.symbol[0]}
      </span>
    )
  }

  return (
    <img
      src={token.icon}
      alt={token.symbol}
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className}`}
      onError={() => setFailed(true)}
    />
  )
}

function ChainIcon({ chain, size = 16, className = '' }: { chain: Chain; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.5, background: chain.color }}
      >
        {chain.name[0]}
      </span>
    )
  }

  return (
    <img
      src={chain.icon}
      alt={chain.name}
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className}`}
      onError={() => setFailed(true)}
    />
  )
}

function TokenWithChainBadge({ token, size = 24 }: { token: Token; size?: number }) {
  const badgeSize = Math.round(size * 0.5)
  const color = getChainColor(token.chainId)
  const chainName = getChainName(token.chainId)

  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <TokenIcon token={token} size={size} />
      <span
        className="absolute block rounded-full border-2 border-[var(--surface)] overflow-hidden"
        style={{ width: badgeSize + 4, height: badgeSize + 4, bottom: -2, right: -2, background: color }}
        title={chainName}
      >
        <span
          className="flex items-center justify-center w-full h-full text-white font-bold"
          style={{ fontSize: badgeSize * 0.5 }}
        >
          {chainName[0]}
        </span>
      </span>
    </span>
  )
}

type TokenSelectorTriggerProps = {
  selected: Token
  onClick: () => void
}

export function TokenSelectorTrigger({ selected, onClick }: TokenSelectorTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        flex items-center gap-2.5 px-3 py-2 rounded-full
        bg-[var(--surface)] hover:bg-[var(--surface-3)]
        shadow-sm hover:shadow-md
        transition-all duration-200 cursor-pointer
      "
    >
      <TokenWithChainBadge token={selected} size={24} />
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        {selected.symbol}
      </span>
      <ChevronDown
        className="w-3.5 h-3.5 ml-auto text-[var(--text-muted)]"
        strokeWidth={2.5}
      />
    </button>
  )
}

type TokenSelectorPanelProps = {
  isOpen: boolean
  selected: Token
  onSelect: (token: Token) => void
  onClose: () => void
}

export function TokenSelectorPanel({ isOpen, selected, onSelect, onClose }: TokenSelectorPanelProps) {
  const [search, setSearch] = useState('')
  const [chainFilter, setChainFilter] = useState<number | null>(null)
  const [chains, setChains] = useState<Chain[]>([])
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    const controller = new AbortController()

    async function load() {
      if (tokens.length > 0) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [chainsData, tokensData] = await Promise.all([
          getReceivableChains(controller.signal),
          getTokenList(controller.signal),
        ])

        if (cancelled) return

        registerChains(chainsData)
        setChains(chainsData)
        setTokens(tokensData)
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load tokens')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isOpen, tokens.length])

  const filteredTokens = useMemo(() => {
    return tokens.filter((token) => {
      if (chainFilter && token.chainId !== chainFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          token.symbol.toLowerCase().includes(q) ||
          token.name.toLowerCase().includes(q) ||
          getChainName(token.chainId).toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [tokens, search, chainFilter])

  const popularTokens = useMemo(() => tokens.slice(0, 5), [tokens])

  const handleClose = useCallback(() => {
    onClose()
    setSearch('')
    setChainFilter(null)
  }, [onClose])

  const handleSelect = useCallback((token: Token) => {
    onSelect(token)
    handleClose()
  }, [onSelect, handleClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-40 bg-black/5 rounded-3xl"
            onClick={handleClose}
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 380, mass: 0.8 }}
            className="absolute inset-0 z-50 bg-[var(--surface)] rounded-3xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                Select Token
              </h3>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 -mr-1.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
              >
                <X className="w-[18px] h-[18px] text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="px-5 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by token name or chain…"
                  className="
                    w-full bg-[var(--surface-2)] text-[13px] text-[var(--text-primary)]
                    placeholder:text-[var(--text-muted)] rounded-xl pl-9 pr-4 py-2.5
                    outline-none border border-transparent
                    focus:border-[var(--accent-light)] focus:bg-[var(--surface)]
                    transition-all duration-200
                  "
                  autoFocus
                />
              </div>
            </div>

            {chains.length > 0 && (
              <div className="px-5 pb-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setChainFilter(null)}
                  className={`
                    px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer shrink-0
                    ${chainFilter === null
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]'
                    }
                  `}
                  style={chainFilter === null ? { boxShadow: 'var(--shadow-sm)' } : undefined}
                >
                  All
                </button>
                {chains.map((chain) => (
                  <button
                    key={chain.chainId}
                    type="button"
                    onClick={() => setChainFilter(chain.chainId === chainFilter ? null : chain.chainId)}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold
                      transition-all duration-200 cursor-pointer shrink-0
                      ${chainFilter === chain.chainId
                        ? 'text-white shadow-sm'
                        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]'
                      }
                    `}
                    style={chainFilter === chain.chainId ? { background: chain.color, boxShadow: `0 2px 8px ${chain.color}33` } : undefined}
                  >
                    <ChainIcon chain={chain} size={16} />
                    {chain.name}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
                <p className="text-[13px] text-[var(--text-muted)]">Loading tokens…</p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 px-5">
                <p className="text-[13px] text-[var(--error)] text-center">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    setTokens([])
                    setLoading(true)
                  }}
                  className="text-[12px] text-[var(--accent)] font-medium hover:underline cursor-pointer"
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                {!search && !chainFilter && popularTokens.length > 0 && (
                  <div className="px-5 pb-2">
                    <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Popular
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto scrollbar-none">
                      {popularTokens.map((token) => {
                        const isSelected = selected.address === token.address && selected.chainId === token.chainId
                        return (
                          <button
                            key={`pop-${token.symbol}-${token.chainId}`}
                            type="button"
                            onClick={() => handleSelect(token)}
                            className={`
                              flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[12px] font-medium
                              transition-all duration-150 cursor-pointer border shrink-0
                              ${isSelected
                                ? 'bg-[var(--accent-wash)] border-[var(--accent-light)] text-[var(--accent)]'
                                : 'bg-[var(--surface-2)] border-transparent text-[var(--text-primary)] hover:border-[var(--border)]'
                              }
                            `}
                          >
                            <TokenIcon token={token} size={18} />
                            {token.symbol}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="mx-5 border-t border-[var(--border-light)]" />

                <div className="flex-1 overflow-y-auto px-2.5 pt-2 pb-3">
                  {filteredTokens.length === 0 ? (
                    <div className="text-center py-10 text-[13px] text-[var(--text-muted)]">
                      No tokens found
                    </div>
                  ) : (
                    filteredTokens.map((token) => {
                      const isSelected = selected.address === token.address && selected.chainId === token.chainId
                      const color = getChainColor(token.chainId)
                      const chainName = getChainName(token.chainId)
                      const chain = chains.find(c => c.chainId === token.chainId)
                      return (
                        <motion.button
                          key={`${token.address}-${token.chainId}`}
                          type="button"
                          onClick={() => handleSelect(token)}
                          whileTap={{ scale: 0.98 }}
                          className={`
                            w-full flex items-center gap-3 px-3 py-3 rounded-xl
                            transition-colors duration-150 cursor-pointer
                            ${isSelected
                              ? 'bg-[var(--accent-wash)]/60'
                              : 'hover:bg-[var(--surface-2)]'
                            }
                          `}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: `${color}15` }}
                          >
                            <TokenIcon token={token} size={28} />
                          </div>
                          <div className="flex flex-col items-start min-w-0">
                            <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
                              {token.symbol}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5 truncate max-w-[140px]">
                              {token.name}
                            </span>
                          </div>
                          <div className="ml-auto flex items-center gap-2 shrink-0">
                            <span
                              className="flex items-center gap-1 text-[10px] font-medium pl-1 pr-2 py-0.5 rounded-full"
                              style={{
                                color,
                                background: `${color}12`,
                              }}
                            >
                              {chain && <ChainIcon chain={chain} size={12} />}
                              {chainName}
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[var(--accent)]" strokeWidth={2.5} />
                            )}
                          </div>
                        </motion.button>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
