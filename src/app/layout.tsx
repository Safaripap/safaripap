import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Matatu Lightning Pay',
  description: 'Pay your matatu fare with M-Pesa, settled instantly over Lightning.',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-brand-dark antialiased">{children}</body>
    </html>
  )
}
