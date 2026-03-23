'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Palette,
  Layout,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Moon,
  Sun,
  Monitor,
  RotateCcw,
  Upload,
  X,
  Image as ImageIcon,
  Settings2,
  ChevronDown,
  Ruler,
  Droplets,
  MousePointerClick,
  ListOrdered,
  Type,
  Globe,
} from 'lucide-react'
import { SwapCard } from '@/components/SwapCard'
import { WidgetThemeProvider, useResolvedDark } from '@/components/WidgetThemeProvider'
import { DEFAULT_WIDGET_CONFIG, FONT_OPTIONS } from '@/types/widget'
import type {
  WidgetConfig,
  ColorMode,
  FontFamily,
  CardShadow,
  BorderStyle,
  ButtonStyle,
  ButtonRadius,
  InputStyle,
  StepStyle,
} from '@/types/widget'

const PRESET_COLORS = [
  '#7C6AEF', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4',
  '#F97316', '#14B8A6', '#6366F1', '#0EA5E9',
]

const SUCCESS_PRESETS = ['#5CC9B8', '#10B981', '#22C55E', '#34D399', '#059669', '#14B8A6']
const ERROR_PRESETS = ['#EF6461', '#EF4444', '#DC2626', '#F87171', '#E11D48', '#FB7185']
const WARNING_PRESETS = ['#F5B544', '#F59E0B', '#EAB308', '#FBBF24', '#D97706', '#FB923C']

export default function SetupPage() {
  const [config, setConfig] = useState<WidgetConfig>({ ...DEFAULT_WIDGET_CONFIG })
  const [saving, setSaving] = useState(false)
  const [integratorKey, setIntegratorKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const previewDark = useResolvedDark(config)

  const update = useCallback(<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetConfig = useCallback(() => {
    setConfig({ ...DEFAULT_WIDGET_CONFIG })
    setIntegratorKey(null)
  }, [])

  const saveConfig = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      if (data.integratorKey) {
        setIntegratorKey(data.integratorKey)
      }
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }, [config])

  const copyKey = useCallback(async () => {
    if (!integratorKey) return
    await navigator.clipboard.writeText(integratorKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [integratorKey])

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 512 * 1024) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        update('footerLogoUrl', reader.result)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [update])

  const copyEmbed = useCallback(async () => {
    if (!integratorKey) return
    const snippet = `<iframe\n  src="${window.location.origin}?key=${integratorKey}"\n  width="${config.widgetWidth}"\n  height="680"\n  frameBorder="0"\n  style="border: none; border-radius: ${config.borderRadius}px;"\n/>`
    await navigator.clipboard.writeText(snippet)
    setCopiedEmbed(true)
    setTimeout(() => setCopiedEmbed(false), 2000)
  }, [integratorKey, config.widgetWidth, config.borderRadius])

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      {/* Header */}
      <div className="border-b border-[var(--border-light)] bg-[var(--surface)]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] inline-flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                Widget Configurator
              </h1>
              <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                Customize your TokenBuy widget, then grab your integrator key.
              </p>
            </div>
            <a
              href="/"
              className="text-sm text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              Preview Page <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-col lg:flex-row max-w-[1440px] mx-auto min-h-[calc(100vh-81px)]">

        {/* LEFT — scrollable config panel */}
        <div className="w-full lg:w-[440px] xl:w-[480px] shrink-0 border-r border-[var(--border-light)] bg-[var(--surface)] overflow-y-auto lg:h-[calc(100vh-81px)]">
          <div className="p-6 lg:p-8 space-y-8">

            {/* ─── Branding ─── */}
            <Section icon={<Palette className="w-4 h-4" />} title="Branding">
              <FieldGroup label="Configuration Name" hint="For your reference only">
                <input
                  type="text"
                  value={config.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="e.g. My DApp Widget"
                  className="input-field w-full px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
              </FieldGroup>

              <FieldGroup label="Accent Color" hint="Primary brand color">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={config.accentColor}
                        onChange={e => update('accentColor', e.target.value)}
                        className="w-10 h-10 rounded-xl border-2 border-[var(--border-light)] cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={config.accentColor}
                      onChange={e => {
                        const v = e.target.value
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) update('accentColor', v)
                      }}
                      className="input-field flex-1 px-3 py-2 text-sm font-[family-name:var(--font-ibm-plex-mono)] text-[var(--text-primary)] uppercase outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => update('accentColor', color)}
                        className={`
                          w-full aspect-square rounded-xl transition-all duration-150 cursor-pointer
                          hover:scale-110 hover:shadow-md
                          ${config.accentColor === color
                            ? 'ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--surface)] scale-110'
                            : ''
                          }
                        `}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </FieldGroup>

              <FieldGroup label="Font Family">
                <div className="grid grid-cols-2 gap-2">
                  {FONT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update('fontFamily', opt.value as FontFamily)}
                      className={`
                        px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer
                        ${config.fontFamily === opt.value
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
                        }
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FieldGroup>
            </Section>

            {/* ─── Appearance ─── */}
            <Section icon={<Layout className="w-4 h-4" />} title="Appearance">
              <FieldGroup label="Border Radius" hint={`${config.borderRadius}px`}>
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 border-2 border-[var(--accent)] bg-[var(--accent-wash)] shrink-0 transition-all"
                    style={{ borderRadius: `${config.borderRadius}px` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={32}
                    value={config.borderRadius}
                    onChange={e => update('borderRadius', Number(e.target.value))}
                    className="flex-1 accent-[var(--accent)] cursor-pointer h-1.5"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1 px-14">
                  <span>Sharp</span>
                  <span>Round</span>
                </div>
              </FieldGroup>

              <FieldGroup label="Color Mode">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'light' as ColorMode, icon: Sun, label: 'Light' },
                    { value: 'auto' as ColorMode, icon: Monitor, label: 'Auto' },
                    { value: 'dark' as ColorMode, icon: Moon, label: 'Dark' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update('colorMode', opt.value)}
                      className={`
                        flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium
                        transition-all duration-150 cursor-pointer
                        ${config.colorMode === opt.value
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]'
                        }
                      `}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FieldGroup>
            </Section>

            {/* ─── Content ─── */}
            <Section icon={<FileText className="w-4 h-4" />} title="Content">
              <FieldGroup label="Widget Title">
                <input
                  type="text"
                  value={config.title}
                  onChange={e => update('title', e.target.value)}
                  placeholder="Buy Crypto"
                  className="input-field w-full px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
              </FieldGroup>

              <FieldGroup label="Subtitle">
                <input
                  type="text"
                  value={config.subtitle}
                  onChange={e => update('subtitle', e.target.value)}
                  placeholder="0% onramp fee via Monerium"
                  className="input-field w-full px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
              </FieldGroup>

              <FieldGroup label="Footer Bar">
                <ToggleSwitch
                  checked={config.showFooter}
                  onChange={v => update('showFooter', v)}
                  label="Show footer bar"
                />
              </FieldGroup>

              {config.showFooter && (
                <>
                  <FieldGroup label="Footer Text">
                    <input
                      type="text"
                      value={config.footerText}
                      onChange={e => update('footerText', e.target.value)}
                      placeholder="Powered by Biconomy"
                      className="input-field w-full px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                    />
                  </FieldGroup>

                  <FieldGroup label="Footer Logo" hint="Max 512 KB">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    {config.footerLogoUrl ? (
                      <div className="flex items-center gap-3 px-3.5 py-3 bg-[var(--surface-2)] rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border-light)] flex items-center justify-center overflow-hidden shrink-0">
                          <img
                            src={config.footerLogoUrl}
                            alt="Footer logo"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <span className="text-sm text-[var(--text-secondary)] flex-1 truncate">
                          Custom logo uploaded
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => logoInputRef.current?.click()}
                            className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => update('footerLogoUrl', '')}
                            className="p-1.5 rounded-lg hover:bg-[var(--error-wash)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 w-full px-3.5 py-3.5 bg-[var(--surface-2)] rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors cursor-pointer border border-dashed border-[var(--border)]"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Upload logo (uses Biconomy default)
                      </button>
                    )}
                  </FieldGroup>
                </>
              )}
            </Section>

            {/* ─── Advanced ─── */}
            <div className="border-t border-[var(--border-light)] pt-6">
              <button
                onClick={() => setAdvancedOpen(v => !v)}
                className="flex items-center justify-between w-full group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">
                    <Settings2 className="w-4 h-4" />
                  </span>
                  <h2 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    Advanced
                  </h2>
                  <div className="flex-1 h-px bg-[var(--border-light)]" />
                </div>
                <motion.div
                  animate={{ rotate: advancedOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-3 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </button>

              <AnimatePresence>
                {advancedOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-6 space-y-8">

                      {/* Layout & Sizing */}
                      <SubSection icon={<Ruler className="w-3.5 h-3.5" />} title="Layout & Sizing">
                        <FieldGroup label="Widget Width" hint={`${config.widgetWidth}px`}>
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border-light)] flex items-center justify-center shrink-0">
                              <div
                                className="bg-[var(--accent)] rounded-sm transition-all duration-150"
                                style={{
                                  width: `${16 + ((config.widgetWidth - 380) / 140) * 10}px`,
                                  height: '20px',
                                }}
                              />
                            </div>
                            <input
                              type="range"
                              min={380}
                              max={520}
                              step={10}
                              value={config.widgetWidth}
                              onChange={e => update('widgetWidth', Number(e.target.value))}
                              className="flex-1 accent-[var(--accent)] cursor-pointer h-1.5"
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1 px-14">
                            <span>380px</span>
                            <span>520px</span>
                          </div>
                        </FieldGroup>

                        <FieldGroup label="Compact Mode">
                          <ToggleSwitch
                            checked={config.compactMode}
                            onChange={v => update('compactMode', v)}
                            label="Reduce padding & spacing"
                          />
                        </FieldGroup>

                        <FieldGroup label="Card Shadow">
                          <div className="grid grid-cols-4 gap-2">
                            {([
                              { value: 'none' as CardShadow, label: 'None', shadow: 'none' },
                              { value: 'subtle' as CardShadow, label: 'Subtle', shadow: '0 1px 3px rgba(0,0,0,0.08)' },
                              { value: 'medium' as CardShadow, label: 'Medium', shadow: '0 4px 12px rgba(0,0,0,0.1)' },
                              { value: 'heavy' as CardShadow, label: 'Heavy', shadow: '0 8px 30px rgba(0,0,0,0.14)' },
                            ]).map(opt => (
                              <VisualOption
                                key={opt.value}
                                selected={config.cardShadow === opt.value}
                                onClick={() => update('cardShadow', opt.value)}
                                label={opt.label}
                              >
                                <div
                                  className="w-12 h-8 rounded-lg bg-white border border-gray-100 transition-shadow"
                                  style={{ boxShadow: opt.shadow }}
                                />
                              </VisualOption>
                            ))}
                          </div>
                        </FieldGroup>

                        <FieldGroup label="Card Border">
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { value: 'solid' as BorderStyle, label: 'Solid', border: '2px solid var(--border)' },
                              { value: 'subtle' as BorderStyle, label: 'Subtle', border: '1px solid rgba(200,200,220,0.3)' },
                              { value: 'none' as BorderStyle, label: 'None', border: '2px solid transparent' },
                            ]).map(opt => (
                              <VisualOption
                                key={opt.value}
                                selected={config.borderStyle === opt.value}
                                onClick={() => update('borderStyle', opt.value)}
                                label={opt.label}
                              >
                                <div
                                  className="w-12 h-8 rounded-lg bg-white transition-all"
                                  style={{ border: opt.border }}
                                />
                              </VisualOption>
                            ))}
                          </div>
                        </FieldGroup>
                      </SubSection>

                      {/* Colors */}
                      <SubSection icon={<Droplets className="w-3.5 h-3.5" />} title="Semantic Colors">
                        <FieldGroup label="Success Color" hint="Confirmations & valid states">
                          <SmallColorPicker
                            value={config.successColor}
                            onChange={v => update('successColor', v)}
                            presets={SUCCESS_PRESETS}
                          />
                        </FieldGroup>

                        <FieldGroup label="Error Color" hint="Errors & invalid states">
                          <SmallColorPicker
                            value={config.errorColor}
                            onChange={v => update('errorColor', v)}
                            presets={ERROR_PRESETS}
                          />
                        </FieldGroup>

                        <FieldGroup label="Warning Color" hint="Cautions & alerts">
                          <SmallColorPicker
                            value={config.warningColor}
                            onChange={v => update('warningColor', v)}
                            presets={WARNING_PRESETS}
                          />
                        </FieldGroup>
                      </SubSection>

                      {/* Buttons & Inputs */}
                      <SubSection icon={<MousePointerClick className="w-3.5 h-3.5" />} title="Buttons & Inputs">
                        <FieldGroup label="Button Style">
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { value: 'filled' as ButtonStyle, label: 'Filled' },
                              { value: 'soft' as ButtonStyle, label: 'Soft' },
                              { value: 'outline' as ButtonStyle, label: 'Outline' },
                            ]).map(opt => (
                              <VisualOption
                                key={opt.value}
                                selected={config.buttonStyle === opt.value}
                                onClick={() => update('buttonStyle', opt.value)}
                                label={opt.label}
                              >
                                <div
                                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                                  style={{
                                    background: opt.value === 'filled'
                                      ? config.accentColor
                                      : opt.value === 'soft'
                                        ? `${config.accentColor}18`
                                        : 'transparent',
                                    color: opt.value === 'filled' ? 'white' : config.accentColor,
                                    border: opt.value === 'outline'
                                      ? `2px solid ${config.accentColor}`
                                      : '2px solid transparent',
                                  }}
                                >
                                  Button
                                </div>
                              </VisualOption>
                            ))}
                          </div>
                        </FieldGroup>

                        <FieldGroup label="Button Shape">
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { value: 'match' as ButtonRadius, label: 'Match', radius: Math.round(config.borderRadius * 0.583) },
                              { value: 'pill' as ButtonRadius, label: 'Pill', radius: 999 },
                              { value: 'square' as ButtonRadius, label: 'Square', radius: 4 },
                            ]).map(opt => (
                              <VisualOption
                                key={opt.value}
                                selected={config.buttonRadius === opt.value}
                                onClick={() => update('buttonRadius', opt.value)}
                                label={opt.label}
                              >
                                <div
                                  className="w-14 h-6 transition-all"
                                  style={{
                                    background: config.accentColor,
                                    borderRadius: `${opt.radius}px`,
                                  }}
                                />
                              </VisualOption>
                            ))}
                          </div>
                        </FieldGroup>

                        <FieldGroup label="Input Style">
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { value: 'filled' as InputStyle, label: 'Filled' },
                              { value: 'outline' as InputStyle, label: 'Outline' },
                            ]).map(opt => (
                              <VisualOption
                                key={opt.value}
                                selected={config.inputStyle === opt.value}
                                onClick={() => update('inputStyle', opt.value)}
                                label={opt.label}
                              >
                                <div
                                  className="w-20 h-6 rounded-md flex items-center px-2 transition-all"
                                  style={{
                                    background: opt.value === 'filled' ? 'var(--surface-2)' : 'transparent',
                                    border: opt.value === 'outline'
                                      ? '1.5px solid var(--border)'
                                      : '1.5px solid var(--border-light)',
                                  }}
                                >
                                  <span className="text-[8px] text-[var(--text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                                    0x1a2b...
                                  </span>
                                </div>
                              </VisualOption>
                            ))}
                          </div>
                        </FieldGroup>
                      </SubSection>

                      {/* Step Indicator */}
                      <SubSection icon={<ListOrdered className="w-3.5 h-3.5" />} title="Step Indicator">
                        <FieldGroup label="Visibility">
                          <ToggleSwitch
                            checked={config.showStepIndicator}
                            onChange={v => update('showStepIndicator', v)}
                            label="Show step indicator"
                          />
                        </FieldGroup>

                        {config.showStepIndicator && (
                          <FieldGroup label="Indicator Style">
                            <div className="grid grid-cols-3 gap-2">
                              {([
                                { value: 'numbered' as StepStyle, label: 'Numbered' },
                                { value: 'dots' as StepStyle, label: 'Dots' },
                                { value: 'minimal' as StepStyle, label: 'Minimal' },
                              ]).map(opt => (
                                <VisualOption
                                  key={opt.value}
                                  selected={config.stepStyle === opt.value}
                                  onClick={() => update('stepStyle', opt.value)}
                                  label={opt.label}
                                >
                                  <StepStylePreview style={opt.value} accentColor={config.accentColor} />
                                </VisualOption>
                              ))}
                            </div>
                          </FieldGroup>
                        )}
                      </SubSection>

                      {/* Content & Labels */}
                      <SubSection icon={<Type className="w-3.5 h-3.5" />} title="Labels & Copy">
                        <FieldGroup label="Primary CTA" hint={`${config.ctaText.length}/24`}>
                          <div className="flex items-center gap-2">
                            <div
                              className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white"
                              style={{ background: config.accentColor }}
                            >
                              {config.ctaText || 'Get Quote'}
                            </div>
                            <input
                              type="text"
                              value={config.ctaText}
                              maxLength={24}
                              onChange={e => update('ctaText', e.target.value)}
                              placeholder="Get Quote"
                              className="input-field flex-1 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                            />
                          </div>
                        </FieldGroup>

                        <FieldGroup label="Success Title" hint={`${config.successTitle.length}/30`}>
                          <input
                            type="text"
                            value={config.successTitle}
                            maxLength={30}
                            onChange={e => update('successTitle', e.target.value)}
                            placeholder="Tokens Delivered"
                            className="input-field w-full px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                          />
                        </FieldGroup>

                        <FieldGroup label="Complete Button" hint={`${config.completeCta.length}/24`}>
                          <div className="flex items-center gap-2">
                            <div
                              className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white"
                              style={{ background: config.accentColor }}
                            >
                              {config.completeCta || 'Buy More Tokens'}
                            </div>
                            <input
                              type="text"
                              value={config.completeCta}
                              maxLength={24}
                              onChange={e => update('completeCta', e.target.value)}
                              placeholder="Buy More Tokens"
                              className="input-field flex-1 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                            />
                          </div>
                        </FieldGroup>
                      </SubSection>

                      {/* Defaults */}
                      <SubSection icon={<Globe className="w-3.5 h-3.5" />} title="Defaults">
                        <FieldGroup label="Default Currency">
                          <div className="grid grid-cols-2 gap-2">
                            {(['EUR', 'GBP'] as const).map(fiat => (
                              <button
                                key={fiat}
                                onClick={() => update('defaultFiat', fiat)}
                                className={`
                                  flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold
                                  transition-all duration-150 cursor-pointer
                                  ${config.defaultFiat === fiat
                                    ? 'bg-[var(--accent)] text-white'
                                    : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
                                  }
                                `}
                              >
                                <span className="text-base">{fiat === 'EUR' ? '€' : '£'}</span>
                                {fiat}
                              </button>
                            ))}
                          </div>
                        </FieldGroup>
                      </SubSection>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ─── Actions ─── */}
            <div className="pt-2 space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={resetConfig}
                  className="btn-secondary px-4 py-3 text-sm flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="btn-primary flex-1 py-3 text-sm cursor-pointer"
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Saving…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      Save Configuration
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {integratorKey && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 10, height: 0 }}
                    className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-2)] p-5 space-y-4 overflow-hidden"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <Check className="w-4 h-4 text-[var(--success)]" />
                        Configuration Saved
                      </h3>
                      <p className="text-[12px] text-[var(--text-muted)] mt-1">
                        Use this key to load your widget configuration.
                      </p>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        Integrator Key
                      </label>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="input-field flex-1 px-3 py-2.5 text-[13px] font-[family-name:var(--font-ibm-plex-mono)] text-[var(--text-primary)] truncate select-all bg-[var(--surface)]">
                          {integratorKey}
                        </div>
                        <button
                          onClick={copyKey}
                          className="btn-secondary p-2.5 cursor-pointer shrink-0"
                        >
                          {copied ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        Embed Snippet
                      </label>
                      <div className="mt-1.5 relative">
                        <pre className="bg-[var(--surface)] rounded-xl p-3 text-[11px] font-[family-name:var(--font-ibm-plex-mono)] text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap break-all">
{`<iframe
  src="…?key=${integratorKey}"
  width="${config.widgetWidth}" height="680"
  style="border:none; border-radius:${config.borderRadius}px;"
/>`}
                        </pre>
                        <button
                          onClick={copyEmbed}
                          className="absolute top-2 right-2 btn-secondary p-1.5 cursor-pointer"
                        >
                          {copiedEmbed ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <a
                      href={`/?key=${integratorKey}`}
                      className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] font-medium hover:underline"
                    >
                      Preview with this key <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* RIGHT — live preview */}
        <div className="flex-1 bg-[var(--bg-deep)] overflow-y-auto lg:h-[calc(100vh-81px)]">
          <div className="flex items-start justify-center p-6 lg:p-10">
            <div className="sticky top-10 w-full" style={{ maxWidth: `${config.widgetWidth + 60}px` }}>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Live Preview
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {config.colorMode === 'auto' ? `Auto (${previewDark ? 'Dark' : 'Light'})` : previewDark ? 'Dark' : 'Light'} · {FONT_OPTIONS.find(f => f.value === config.fontFamily)?.label} · {config.widgetWidth}px
                </span>
              </div>

              <div
                className="rounded-2xl p-6 transition-colors duration-300"
                style={{
                  background: previewDark ? '#161720' : '#F0F1F7',
                }}
              >
                <WidgetThemeProvider config={config}>
                  <div style={{ fontFamily: 'var(--font-body)' }}>
                    <SwapCard />
                  </div>
                </WidgetThemeProvider>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   Local helper components
   ────────────────────────────────────────────────────────────────────────────── */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--accent)]">{icon}</span>
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
          {title}
        </h2>
        <div className="flex-1 h-px bg-[var(--border-light)]" />
      </div>
      <div className="space-y-5">
        {children}
      </div>
    </div>
  )
}

function SubSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3.5">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </h3>
        <div className="flex-1 h-px bg-[var(--border-light)]/50" />
      </div>
      <div className="space-y-4 pl-0.5">
        {children}
      </div>
    </div>
  )
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-[13px] font-semibold text-[var(--text-primary)]">
          {label}
        </label>
        {hint && (
          <span className="text-[11px] text-[var(--text-muted)]">{hint}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full px-3.5 py-3 bg-[var(--surface-2)] rounded-xl cursor-pointer group"
    >
      <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
        {label}
      </span>
      <div
        className={`
          w-10 h-6 rounded-full transition-all duration-200 relative
          ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-3)]'}
        `}
      >
        <div
          className={`
            absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200
            ${checked ? 'left-5' : 'left-1'}
          `}
        />
      </div>
    </button>
  )
}

function VisualOption({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer
        ${selected
          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
          : 'border-transparent bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
        }
      `}
    >
      <div className="flex items-center justify-center h-8">
        {children}
      </div>
      <span className={`
        text-[10px] font-semibold capitalize
        ${selected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}
      `}>
        {label}
      </span>
    </button>
  )
}

function SmallColorPicker({
  value,
  onChange,
  presets,
}: {
  value: string
  onChange: (v: string) => void
  presets: string[]
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border-2 border-[var(--border-light)] cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
        />
        <input
          type="text"
          value={value}
          onChange={e => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
          }}
          className="input-field flex-1 px-2.5 py-1.5 text-[11px] font-[family-name:var(--font-ibm-plex-mono)] text-[var(--text-primary)] uppercase outline-none"
        />
      </div>
      <div className="flex gap-1.5">
        {presets.map(color => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`
              w-5 h-5 rounded-md transition-all duration-150 cursor-pointer hover:scale-125
              ${value === color
                ? 'ring-2 ring-[var(--text-primary)] ring-offset-1 ring-offset-[var(--surface)] scale-110'
                : ''
              }
            `}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}

function StepStylePreview({
  style,
  accentColor,
}: {
  style: StepStyle
  accentColor: string
}) {
  if (style === 'minimal') {
    return (
      <div className="w-16 space-y-0.5">
        <div className="h-[3px] rounded-full bg-[var(--surface-3)] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: '40%', background: accentColor }}
          />
        </div>
        <div className="flex justify-between">
          <div className="w-1 h-1 rounded-full" style={{ background: accentColor }} />
          <div className="w-1 h-1 rounded-full bg-[var(--surface-3)]" />
        </div>
      </div>
    )
  }

  if (style === 'dots') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: accentColor, boxShadow: `0 0 0 3px ${accentColor}30` }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--surface-3)]" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <div
        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-white"
        style={{ background: accentColor }}
      >
        1
      </div>
      <div className="w-3 h-[1.5px] rounded-full" style={{ background: accentColor }} />
      <div
        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-[var(--text-muted)] bg-[var(--surface-2)]"
      >
        2
      </div>
      <div className="w-3 h-[1.5px] rounded-full bg-[var(--surface-3)]" />
      <div
        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-[var(--text-muted)] bg-[var(--surface-2)]"
      >
        3
      </div>
    </div>
  )
}
