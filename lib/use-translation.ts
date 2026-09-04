"use client"

import { useCallback } from "react"
import { useLanguage } from "./language-context"
import { getTranslation, hasTranslation, type TranslationKey } from "./translations"

export type TranslationValues = Record<string, string | number>

const reportedMissing = new Set<string>()

function reportMissing(key: string) {
  if (process.env.NODE_ENV === "production") return
  if (reportedMissing.has(key)) return
  reportedMissing.add(key)
  console.warn(`[i18n] missing translation key: ${key}`)
}

/**
 * Fills `{name}` placeholders. Unresolved placeholders are left intact so a
 * missing value is visible in development instead of silently dropped.
 */
export function interpolate(template: string, values?: TranslationValues) {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

export function useTranslation() {
  const { language } = useLanguage()

  return useCallback(
    (key: TranslationKey, values?: TranslationValues, defaultValue?: string): string => {
      if (!hasTranslation(key)) reportMissing(key)
      const template = getTranslation(key, language) || defaultValue || key
      return interpolate(template, values)
    },
    [language],
  )
}

/**
 * Picks between `<key>.one` / `<key>.other` variants. English and the four
 * Indian languages supported here all use the one/other split.
 */
export function usePluralTranslation() {
  const t = useTranslation()
  return useCallback(
    (baseKey: string, count: number, values?: TranslationValues): string => {
      const variant = count === 1 ? "one" : "other"
      return t(`${baseKey}.${variant}` as TranslationKey, { count, ...values })
    },
    [t],
  )
}
