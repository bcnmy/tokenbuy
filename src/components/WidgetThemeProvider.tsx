'use client'

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { deriveThemeVars } from '@/lib/theme'
import type { WidgetConfig } from '@/types/widget'

const ThemeContext = createContext<WidgetConfig | null>(null)

export function useWidgetTheme() {
  return useContext(ThemeContext)
}

const darkQuery = '(prefers-color-scheme: dark)'

function subscribeSystemTheme(cb: () => void) {
  const mql = window.matchMedia(darkQuery)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}

function getSystemDark() {
  return window.matchMedia(darkQuery).matches
}

const serverFallback = false

export function useSystemDarkMode(): boolean {
  return useSyncExternalStore(subscribeSystemTheme, getSystemDark, () => serverFallback)
}

export function useResolvedDark(config: WidgetConfig): boolean {
  const systemDark = useSystemDarkMode()
  if (config.colorMode === 'auto') return systemDark
  return config.colorMode === 'dark'
}

export function WidgetThemeProvider({
  config,
  children,
}: {
  config: WidgetConfig
  children: React.ReactNode
}) {
  const isDark = useResolvedDark(config)

  const resolvedConfig = useMemo<WidgetConfig>(
    () => ({ ...config, colorMode: isDark ? 'dark' : 'light' }),
    [config, isDark],
  )

  const style = useMemo(() => deriveThemeVars(resolvedConfig, isDark), [resolvedConfig, isDark])

  return (
    <ThemeContext.Provider value={resolvedConfig}>
      <div style={style as React.CSSProperties}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
