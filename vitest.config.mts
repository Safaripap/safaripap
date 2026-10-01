import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    // Fixed timezone so time formatting is deterministic on any machine.
    env: { TZ: 'Africa/Nairobi' },
    restoreMocks: true,
  },
})
