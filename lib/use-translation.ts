"use client"

import { useLanguage } from "./language-context"
import { getTranslation, type TranslationKey } from "./translations"

export function useTranslation() {
  const { language } = useLanguage()
  
  return (key: TranslationKey, defaultValue?: string): string => {
    const translated = getTranslation(key, language)
    return translated || defaultValue || key
  }
}
