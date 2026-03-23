'use client'

import { useEffect } from 'react'
import { useSystemDarkMode } from './WidgetThemeProvider'

export function SystemThemeSync() {
  const dark = useSystemDarkMode()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return null
}
