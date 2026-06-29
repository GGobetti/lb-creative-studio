import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  test: {
    // Load .env.local so tests pick up Supabase credentials
    env: loadEnv(mode, process.cwd(), ''),
    // Longer timeout for remote DB round-trips
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
}))
