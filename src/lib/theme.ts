import type { WidgetConfig } from '@/types/widget'

export function hexToHsl(hex: string): [number, number, number] {
  let r = 0, g = 0, b = 0
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  }

  r /= 255; g /= 255; b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100

  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }

  return `#${f(0)}${f(8)}${f(4)}`
}

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [124, 106, 239]
}

function deriveWash(hex: string, darkMode: boolean): string {
  const [wh, ws] = hexToHsl(hex)
  return darkMode
    ? hslToHex(wh, Math.max(ws - 30, 15), 18)
    : hslToHex(wh, Math.max(ws - 25, 30), 94)
}

export function deriveThemeVars(config: WidgetConfig, isDark: boolean): Record<string, string> {
  const [h, s, l] = hexToHsl(config.accentColor)
  const [r, g, b] = hexToRgb(config.accentColor)
  const dark = isDark

  const vars: Record<string, string> = {}

  vars['--accent'] = config.accentColor
  vars['--accent-light'] = hslToHex(h, Math.min(s + 5, 100), Math.min(l + 10, 85))
  vars['--accent-wash'] = hslToHex(h, Math.max(s - 20, 30), dark ? 20 : 94)
  vars['--shadow-accent'] = `0 4px 16px rgba(${r}, ${g}, ${b}, 0.2), 0 2px 4px rgba(${r}, ${g}, ${b}, 0.12)`
  vars['--shadow-accent-hover'] = `0 6px 20px rgba(${r}, ${g}, ${b}, 0.3), 0 2px 6px rgba(${r}, ${g}, ${b}, 0.15)`

  const radius = config.borderRadius
  vars['--radius-card'] = `${radius}px`
  vars['--radius-input'] = `${Math.round(radius * 0.667)}px`

  const btnRadius = config.buttonRadius ?? 'match'
  if (btnRadius === 'pill') {
    vars['--radius-btn'] = '999px'
  } else if (btnRadius === 'square') {
    vars['--radius-btn'] = '6px'
  } else {
    vars['--radius-btn'] = `${Math.round(radius * 0.583)}px`
  }

  if (dark) {
    vars['--bg-deep'] = '#0F1017'
    vars['--bg-base'] = '#161720'
    vars['--surface'] = '#1E1F2B'
    vars['--surface-2'] = '#262736'
    vars['--surface-3'] = '#2F3042'
    vars['--border'] = '#363850'
    vars['--border-light'] = '#2A2C40'
    vars['--text-primary'] = '#E8E9F0'
    vars['--text-secondary'] = '#9498B5'
    vars['--text-muted'] = '#5E6280'
    vars['--text-on-accent'] = '#FFFFFF'
    vars['--shadow-sm'] = '0 1px 2px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.15)'
    vars['--shadow-md'] = '0 2px 8px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.2)'
    vars['--shadow-lg'] = '0 4px 16px rgba(0, 0, 0, 0.3), 0 12px 40px rgba(0, 0, 0, 0.25)'
  }

  const sucColor = config.successColor ?? '#5CC9B8'
  vars['--success'] = sucColor
  vars['--success-wash'] = deriveWash(sucColor, dark)
  vars['--accent-tertiary'] = sucColor
  vars['--accent-tertiary-wash'] = vars['--success-wash']

  const errColor = config.errorColor ?? '#EF6461'
  vars['--error'] = errColor
  vars['--error-wash'] = deriveWash(errColor, dark)

  const warnColor = config.warningColor ?? '#F5B544'
  vars['--warning'] = warnColor
  vars['--warning-wash'] = deriveWash(warnColor, dark)

  const shadows = {
    sm: dark
      ? '0 1px 2px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.15)'
      : '0 1px 2px rgba(28,31,55,0.04), 0 1px 3px rgba(28,31,55,0.03)',
    md: dark
      ? '0 2px 8px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.2)'
      : '0 2px 8px rgba(28,31,55,0.06), 0 4px 16px rgba(28,31,55,0.04)',
    lg: dark
      ? '0 4px 16px rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.25)'
      : '0 4px 16px rgba(28,31,55,0.06), 0 12px 40px rgba(28,31,55,0.06)',
  }
  const cardShadow = config.cardShadow ?? 'heavy'
  const shadowMap: Record<string, string> = {
    none: 'none',
    subtle: shadows.sm,
    medium: shadows.md,
    heavy: shadows.lg,
  }
  vars['--shadow-card'] = shadowMap[cardShadow] ?? shadows.lg

  const borderStyle = config.borderStyle ?? 'solid'
  if (borderStyle === 'none') {
    vars['--card-border'] = 'none'
  } else if (borderStyle === 'subtle') {
    vars['--card-border'] = dark
      ? '1px solid rgba(42, 44, 64, 0.4)'
      : '1px solid rgba(236, 238, 245, 0.5)'
  }

  const buttonStyle = config.buttonStyle ?? 'filled'
  if (buttonStyle === 'soft') {
    vars['--btn-primary-bg'] = vars['--accent-wash']
    vars['--btn-primary-color'] = config.accentColor
    vars['--btn-primary-shadow'] = 'none'
    vars['--btn-primary-shadow-hover'] = 'none'
    vars['--btn-primary-border'] = 'none'
  } else if (buttonStyle === 'outline') {
    vars['--btn-primary-bg'] = 'transparent'
    vars['--btn-primary-color'] = config.accentColor
    vars['--btn-primary-shadow'] = 'none'
    vars['--btn-primary-shadow-hover'] = 'none'
    vars['--btn-primary-border'] = `2px solid ${config.accentColor}`
  }

  const inputStyle = config.inputStyle ?? 'filled'
  if (inputStyle === 'outline') {
    vars['--input-bg'] = 'transparent'
  }

  vars['--widget-width'] = `${config.widgetWidth ?? 440}px`

  const fontMap: Record<string, string> = {
    'sora': 'var(--font-sora), system-ui, sans-serif',
    'inter': 'var(--font-inter), system-ui, sans-serif',
    'dm-sans': 'var(--font-dm-sans), system-ui, sans-serif',
    'system': 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  }
  vars['--font-body'] = fontMap[config.fontFamily] || fontMap['sora']

  return vars
}
