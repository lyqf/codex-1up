import { defineConfig } from 'vitest/config'

// CI (especially Windows + coverage) can be slow; keep timeouts forgiving.
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
    setupFiles: ['./tests/test-setup.ts'],
    disableConsoleIntercept: true,
  },
})

