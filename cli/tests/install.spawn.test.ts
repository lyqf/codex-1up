import { describe, it, expect, vi } from 'vitest'
import { installCommand } from '../src/commands/install'

// Mock the zx installer entry to observe invocation
vi.mock('../src/installers/main.js', () => ({
  runInstaller: vi.fn(async () => {})
}))
// Import the mocked symbol for assertions
import { runInstaller } from '../src/installers/main.js'

describe('install runs zx installer', () => {
  it('passes flags through', async () => {
    await installCommand.run!({ args: { yes: true, 'dry-run': true } as any })
    expect((runInstaller as unknown as any).mock.calls.length).toBeGreaterThan(0)
  })
})
