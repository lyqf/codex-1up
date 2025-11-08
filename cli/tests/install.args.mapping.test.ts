import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { installCommand } from '../src/commands/install'

const td = join(tmpdir(), `codex-1up-test-${Date.now()}-args`)
const CH = resolve(td, '.codex')

const captured: any[] = []
vi.mock('../src/installers/main.js', () => ({
  runInstaller: vi.fn(async (opts: any) => { captured.push(opts) })
}))

beforeAll(async () => { process.env.HOME = td; await fs.mkdir(CH, { recursive: true }) })
afterAll(async () => { try { await fs.rm(td, { recursive: true, force: true }) } catch {} })

describe('install args mapping', () => {
  it('maps common flags to installer options', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    await installCommand.run!({ args: {
      yes: true,
      'skip-confirmation': true,
      'dry-run': true,
      'install-node': 'brew',
      shell: 'zsh',
      vscode: 'openai.codex',
      'agents-md': '/tmp/AGENTS.md'
    } as any })
    const opts = captured.pop()
    expect(opts.installNode).toBe('brew')
    expect(opts.shell).toBe('zsh')
    expect(opts.vscodeId).toBe('openai.codex')
    expect(opts.noVscode).toBe(false)
    expect(opts.agentsMd).toBe('/tmp/AGENTS.md')
    expect(opts.dryRun).toBe(true)
    expect(opts.assumeYes).toBe(true)
    expect(opts.skipConfirmation).toBe(true)
  })

  it('honors --no-vscode over --vscode id', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    await installCommand.run!({ args: {
      yes: true,
      'skip-confirmation': true,
      'no-vscode': true,
      vscode: 'openai.codex'
    } as any })
    const opts = captured.pop()
    expect(opts.noVscode).toBe(true)
    // vscodeId may be present in args but should not be used when noVscode true; we only assert flag
  })
})

