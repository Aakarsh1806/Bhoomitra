import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AutomationProvider } from '@/lib/automation-context'
import { LanguageProvider } from '@/lib/language-context'
import { NavigationProvider } from '@/lib/navigation-context'
import FloatingLanguageSelector from '@/components/floating-language-selector'
import NavigationLoadingIndicator from '@/components/navigation-loading-indicator'
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Bhoomitra - AI Powered Precision Farming System",
  description: "Advanced agricultural monitoring and disease detection system powered by AI.",
  generator: "Bhoomitra AI",
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon.ico",
        media: "(prefers-color-scheme: dark)",
      }
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${GeistSans.variable} ${GeistMono.variable}`}>
        <LanguageProvider>
          <NavigationProvider>
            <AutomationProvider>
              <NavigationLoadingIndicator />
              <FloatingLanguageSelector />
              {children}
              <Toaster position="top-right" richColors />
            </AutomationProvider>
          </NavigationProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
