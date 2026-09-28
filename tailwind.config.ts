import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#f7931a', // Bitcoin/Lightning orange — primary action
          dark: '#1a1a2e', // ink — text and high-contrast surfaces
        },
        route: {
          DEFAULT: '#1e7a5f', // verified / confirmed — distinct from brand orange
          light: '#e6f2ee',
        },
        wait: {
          DEFAULT: '#d98e04', // in-progress / pending — distinct from brand + route
          light: '#fbf1dc',
        },
        cream: '#faf6ee', // warm off-white background, easier to read in bright daylight than stark white
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      fontSize: {
        display: ['4rem', { lineHeight: '0.95', fontWeight: '700' }],
        'display-sm': ['2.75rem', { lineHeight: '1', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
}
export default config
