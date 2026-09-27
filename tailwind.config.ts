import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#f7931a', // Bitcoin orange
          dark: '#1a1a2e',
        },
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.05', fontWeight: '800' }],
      },
    },
  },
  plugins: [],
}
export default config
