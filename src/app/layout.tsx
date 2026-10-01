import type { Metadata } from 'next'
import { Montserrat, Figtree } from 'next/font/google'
import './globals.css'
import { HIGH_CONTRAST_BOOT_SCRIPT } from '@/lib/preferences'

// Montserrat: round, geometric and confident — for fare amounts, codes and
// headlines. Figtree: a friendly geometric sans in the same spirit that stays
// clear at small sizes for everything else.
const display = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
})
const body = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
