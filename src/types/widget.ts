export type FontFamily = 'sora' | 'inter' | 'dm-sans' | 'system'
export type CardShadow = 'none' | 'subtle' | 'medium' | 'heavy'
export type BorderStyle = 'solid' | 'subtle' | 'none'
export type ButtonStyle = 'filled' | 'soft' | 'outline'
export type ButtonRadius = 'match' | 'pill' | 'square'
export type InputStyle = 'filled' | 'outline'
export type StepStyle = 'numbered' | 'dots' | 'minimal'
export type ColorMode = 'light' | 'dark' | 'auto'

export type WidgetConfig = {
  name: string
  accentColor: string
  borderRadius: number
  colorMode: ColorMode
  fontFamily: FontFamily
  title: string
  subtitle: string
  showFooter: boolean
  footerText: string
  footerLogoUrl: string
  widgetWidth: number
  compactMode: boolean
  cardShadow: CardShadow
  borderStyle: BorderStyle
  successColor: string
  errorColor: string
  warningColor: string
  buttonStyle: ButtonStyle
  buttonRadius: ButtonRadius
  inputStyle: InputStyle
  showStepIndicator: boolean
  stepStyle: StepStyle
  ctaText: string
  completeCta: string
  successTitle: string
  defaultFiat: 'EUR' | 'GBP'
}

export type SavedWidgetConfig = {
  integratorKey: string
  name: string
  config: WidgetConfig
  createdAt: string
}

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  name: '',
  accentColor: '#7C6AEF',
  borderRadius: 24,
  colorMode: 'auto',
  fontFamily: 'sora',
  title: 'Buy Crypto',
  subtitle: '0% onramp fee via Monerium · EU bank transfers',
  showFooter: true,
  footerText: 'Powered by Biconomy',
  footerLogoUrl: '',
  widgetWidth: 440,
  compactMode: false,
  cardShadow: 'heavy',
  borderStyle: 'solid',
  successColor: '#5CC9B8',
  errorColor: '#EF6461',
  warningColor: '#F5B544',
  buttonStyle: 'filled',
  buttonRadius: 'match',
  inputStyle: 'filled',
  showStepIndicator: true,
  stepStyle: 'numbered',
  ctaText: 'Get Quote',
  completeCta: 'Buy More Tokens',
  successTitle: 'Tokens Delivered',
  defaultFiat: 'EUR',
}

export const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'sora', label: 'Sora' },
  { value: 'inter', label: 'Inter' },
  { value: 'dm-sans', label: 'DM Sans' },
  { value: 'system', label: 'System Default' },
]

/** Migrate configs saved with the old `darkMode: boolean` field. */
export function normalizeConfig(raw: Record<string, unknown>): WidgetConfig {
  const config = { ...DEFAULT_WIDGET_CONFIG, ...raw }

  if (!('colorMode' in raw) && 'darkMode' in raw) {
    config.colorMode = raw.darkMode === true ? 'dark' : 'light'
  }
  delete (config as Record<string, unknown>).darkMode

  return config as unknown as WidgetConfig
}
