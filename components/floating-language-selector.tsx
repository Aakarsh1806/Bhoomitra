"use client"

import { usePathname } from "next/navigation"
import LanguageSelector from "@/components/language-selector"

/**
 * The app-wide floating selector. Dashboard routes render their own selector
 * inside the mobile header below 768px, so this one steps aside there to keep
 * it clear of page headings and dialogs.
 */
export default function FloatingLanguageSelector() {
  const pathname = usePathname()
  const insideDashboard = pathname?.startsWith("/dashboard") ?? false

  return (
    <div className={`fixed right-4 top-4 z-[200] ${insideDashboard ? "hidden md:block" : ""}`}>
      <LanguageSelector />
    </div>
  )
}
