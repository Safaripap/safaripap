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
          ink: '#7a4f00', // text on wait-light — DEFAULT amber is only ~2.3:1 there
        },
        cream: '#faf6ee', // warm off-white background, easier to read in bright daylight than stark white
        'accent-warm': '#E88DA0', // muted dusty rose — delight moments only, never for status
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      fontSize: {
        // Sized for Montserrat, which is much wider than a condensed face.
        display: ['3.25rem', { lineHeight: '1.05', fontWeight: '800', letterSpacing: '-0.02em' }],
        'display-sm': ['2.125rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
      },
    },
  },
  plugins: [],
}
export default config
