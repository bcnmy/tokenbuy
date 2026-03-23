'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Key, X, Loader2, Settings, ArrowRight, Check, AlertCircle } from 'lucide-react'
import { SwapCard } from '@/components/SwapCard'
import { WidgetThemeProvider, useSystemDarkMode } from '@/components/WidgetThemeProvider'
import type { WidgetConfig } from '@/types/widget'

export default function Home() {
  const [keyInput, setKeyInput] = useState('')
  const [activeConfig, setActiveConfig] = useState<WidgetConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configName, setConfigName] = useState<string | null>(null)
  const systemDark = useSystemDarkMode()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const keyFromUrl = params.get('key')
    if (keyFromUrl) {
      setKeyInput(keyFromUrl)
      loadConfig(keyFromUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadConfig = useCallback(async (key: string) => {
    if (!key.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/config/${encodeURIComponent(key.trim())}`)
      if (!res.ok) {
        setError(res.status === 404 ? 'Configuration not found' : 'Failed to load configuration')
        setActiveConfig(null)
        setConfigName(null)
        return
      }
      const data = await res.json()
      setActiveConfig(data.config)
      setConfigName(data.name || null)
    } catch {
      setError('Failed to load configuration')
      setActiveConfig(null)
      setConfigName(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearConfig = useCallback(() => {
    setKeyInput('')
    setActiveConfig(null)
    setConfigName(null)
    setError(null)
    window.history.replaceState({}, '', '/')
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (keyInput.trim()) {
      loadConfig(keyInput)
      window.history.replaceState({}, '', `/?key=${encodeURIComponent(keyInput.trim())}`)
    }
  }, [keyInput, loadConfig])

  const widget = <SwapCard />

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-4">
      {/* Integrator key bar */}
      <div className="w-full max-w-[440px] space-y-2">
        <form onSubmit={handleSubmit} className="relative">
          <div className="card-elevated flex items-center gap-2 px-3 py-2">
            <Key className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="Paste integrator key to preview…"
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none font-[family-name:var(--font-ibm-plex-mono)] min-w-0"
            />
            {loading && <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin shrink-0" />}
            {activeConfig && !loading && (
              <button
                type="button"
                onClick={clearConfig}
                className="p-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            )}
            {!activeConfig && !loading && keyInput && (
              <button
                type="submit"
                className="p-1 rounded-lg hover:bg-[var(--accent-wash)] transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 text-[var(--accent)]" />
              </button>
            )}
          </div>
        </form>

        <AnimatePresence>
          {activeConfig && configName && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-2 px-3 py-1.5"
            >
              <Check className="w-3 h-3 text-[var(--success)]" />
              <span className="text-[11px] text-[var(--text-muted)]">
                Previewing: <span className="text-[var(--text-secondary)] font-medium">{configName}</span>
              </span>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-2 px-3 py-1.5"
            >
              <AlertCircle className="w-3 h-3 text-[var(--error)]" />
              <span className="text-[11px] text-[var(--error)]">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Widget */}
      {activeConfig ? (
        <div
          className="rounded-2xl p-4 transition-colors duration-300"
          style={{ background: (activeConfig.colorMode === 'dark' || (activeConfig.colorMode === 'auto' && systemDark)) ? '#161720' : '#F0F1F7' }}
        >
          <WidgetThemeProvider config={activeConfig}>
            <div style={{ fontFamily: 'var(--font-body)' }}>
              {widget}
            </div>
          </WidgetThemeProvider>
        </div>
      ) : (
        widget
      )}

      {/* Setup link */}
      <a
        href="/setup"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors mt-2"
      >
        <Settings className="w-4 h-4" />
        Configure your widget
      </a>
    </div>
  )
}
