import { describe, it, expect, vi } from 'vitest'

// Mock zx before importing modules under test
vi.mock('zx', () => {
  const mock$ = vi.fn(async () => ({}))
  const mockWhich = vi.fn(async () => {})
  return { $: mock$, which: mockWhich }
})

import { doctorCommand } from '../src/commands/doctor'
import { uninstallCommand } from '../src/commands/uninstall'
import { $ } from 'zx'

describe('doctor/uninstall spawn', () => {
  it('spawns doctor', async () => {
    await doctorCommand.run!({ args: {} as any })
    expect(($ as unknown as any).mock.calls.length).toBeGreaterThan(0)
  })
  it('spawns uninstall', async () => {
    await uninstallCommand.run!({ args: {} as any })
    expect(($ as unknown as any).mock.calls.length).toBeGreaterThan(1)
  })
})
