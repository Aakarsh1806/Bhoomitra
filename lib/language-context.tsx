"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

export type Language = "en" | "hi"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
}

export const SUPPORTED_LANGUAGES: Language[] = ["en", "hi"]

export const LANGUAGE_STORAGE_KEY = "bhoomitra_language"

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as string[]).includes(value)
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always start at "en" so server and first client render agree; the saved
  // preference is applied after hydration.
  const [language, setLanguageState] = useState<Language>("en")

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (isLanguage(saved)) setLanguageState(saved)
    } catch {
      // Private mode / disabled storage — keep the English default.
    }
  }, [])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = (lang: Language) => {
    if (!isLanguage(lang)) return
    setLanguageState(lang)
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    } catch {
      // Preference simply does not persist when storage is unavailable.
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }
  return context
}
