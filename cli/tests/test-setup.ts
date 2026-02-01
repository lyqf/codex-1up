import { afterAll, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Ensure the test suite never touches the real ~/.codex on dev machines.
const testHome = mkdtempSync(join(tmpdir(), 'codex-1up-vitest-home-'))

// Some code paths call os.homedir(); on Node this does NOT necessarily respect process.env.HOME.
// For ESM built-ins we can't vi.spyOn() the module namespace; use vi.mock() instead.
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => testHome }
})
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>()
  return { ...actual, homedir: () => testHome }
})

process.env.HOME = testHome
process.env.USERPROFILE = testHome

afterAll(() => {
  try { rmSync(testHome, { recursive: true, force: true }) } catch {}
})

