import type { Metadata } from 'next'
import { Big_Shoulders_Display, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import { HIGH_CONTRAST_BOOT_SCRIPT } from '@/lib/preferences'

// Big Shoulders Display takes its cues from Chicago transit signage —
// a condensed, confident display face for fare amounts and headlines.
// IBM Plex Sans stays legible at small sizes for everything else.
const display = Big_Shoulders_Display({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-display',
})
const body = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'Safaripap',
  description: 'Pay your matatu fare with M-Pesa, settled instantly over Lightning.',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the boot script may set data-contrast before React hydrates.
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HIGH_CONTRAST_BOOT_SCRIPT }} />
      </head>
      <body className="bg-cream text-brand-dark antialiased font-body">{children}</body>
    </html>
  )
}
