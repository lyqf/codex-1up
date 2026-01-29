import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InstallerContext } from '../src/installers/types.js'
import { installNpmGlobals } from '../src/installers/installNpmGlobals.js'
import { runCommand, needCmd } from '../src/installers/utils.js'
import { resolveNodeGlobalPm } from '../src/installers/nodeGlobal.js'
import * as prompts from '@clack/prompts'

// Mock utils to control package manager detection and command execution
vi.mock('../src/installers/utils.js', async () => {
  const actual = await vi.importActual<typeof import('../src/installers/utils.js')>('../src/installers/utils.js')
  return {
    ...actual,
    execCapture: vi.fn(async (cmd: string, args: string[]) => {
      if (cmd === 'codex' && args[0] === '--version') {
        return { code: 0, stdout: 'codex 0.61.0\n', stderr: '', timedOut: false }
      }
      if (cmd === 'npm' && args[0] === 'ls') {
        const payload = {
          dependencies: {
            '@openai/codex': { version: '0.61.0' }
          }
        }
        return { code: 0, stdout: JSON.stringify(payload), stderr: '', timedOut: false }
      }
      return { code: 0, stdout: '', stderr: '', timedOut: false }
    }),
    runCommand: vi.fn(async () => {}),
    needCmd: vi.fn(async () => true)
  }
})

vi.mock('../src/installers/nodeGlobal.js', () => ({
  resolveNodeGlobalPm: vi.fn(async () => 'npm')
}))

// Mock prompts to drive interactive choices
vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(async () => true),
  select: vi.fn(async () => 'npm'),
  isCancel: (v: unknown) => v === Symbol.for('cancel')
}))

function createCtx(overrides: Partial<InstallerContext['options']> = {}): InstallerContext {
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    ok: vi.fn(),
    warn: vi.fn(),
    err: vi.fn()
  }

  return {
    cwd: '/tmp',
    homeDir: '/tmp',
    rootDir: '/tmp',
    logDir: '/tmp',
    logFile: '/tmp/log',
    logger,
    options: {
      profile: 'balanced',
      profileScope: 'single',
      profileMode: 'add',
      setDefaultProfile: true,
      installTools: 'all',
      toolsSelected: undefined,
      installCodexCli: 'yes',
      notify: undefined,
      globalAgents: undefined,
      notificationSound: undefined,
      skills: 'skip',
      skillsSelected: undefined,
      mode: 'manual',
      installNode: 'skip',
      shell: 'zsh',
      vscodeId: undefined,
      noVscode: false,
      agentsMd: undefined,
      dryRun: false,
      assumeYes: false,
      skipConfirmation: false,
      ...overrides
    }
  }
}

describe('installNpmGlobals pnpm fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: '0.63.0' })
    })))
  })

  it('prompts to update when Codex is installed and newer version is available', async () => {
    const ctx = createCtx({ installCodexCli: 'auto' as const })
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    await installNpmGlobals(ctx)

    expect(prompts.confirm).toHaveBeenCalled()
    expect(runCommand).toHaveBeenCalledWith('npm', ['install', '-g', '@openai/codex@0.63.0'], expect.any(Object))
  })

  it('prompts to install when Codex is not found', async () => {
    const ctx = createCtx({ installCodexCli: 'auto' as const })
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    const needCmdMock = vi.mocked(needCmd)
    needCmdMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    await installNpmGlobals(ctx)

    expect(prompts.confirm).toHaveBeenCalled()
    expect(runCommand).toHaveBeenCalledWith('npm', ['install', '-g', '@openai/codex@0.63.0'], expect.any(Object))
  })

  it('prompts and falls back to npm when pnpm is misconfigured', async () => {
    const ctx = createCtx()
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    await installNpmGlobals(ctx)

    expect(resolveNodeGlobalPm).toHaveBeenCalled()
    expect(runCommand).toHaveBeenCalledWith('npm', ['install', '-g', '@openai/codex@0.63.0'], expect.any(Object))
  })

  it('auto-falls back to npm without prompting in non-interactive mode', async () => {
    const ctx = createCtx({ assumeYes: true, skipConfirmation: true })
    await installNpmGlobals(ctx)

    expect(prompts.select).not.toHaveBeenCalled()
    expect(runCommand).toHaveBeenCalledWith('npm', ['install', '-g', '@openai/codex@0.63.0'], expect.any(Object))
  })
})
