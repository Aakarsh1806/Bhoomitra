"use client"

import { useState } from "react"
import { useLanguage, type Language } from "@/lib/language-context"
import { Button } from "@/components/ui/button"
import { Globe, ChevronDown } from "lucide-react"

const languages: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिंदी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
]

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const currentLang = languages.find((l) => l.code === language) || languages[0]

  return (
    <div className="relative z-[100]">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        className="gap-2 bg-white border-slate-200 shadow-sm hover:bg-slate-50"
      >
        <Globe className="h-4 w-4" />
        <span className="text-xs font-medium">{currentLang.native}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Select Language
          </div>
          <div className="space-y-1">
            {languages.map((lang) => {
              const active = language === lang.code

              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active ? "bg-green-50 text-green-700" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{lang.native}</span>
                    <span className="text-xs text-slate-500">{lang.label}</span>
                  </div>
                  {active && <span className="text-xs font-semibold text-green-600">Active</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}