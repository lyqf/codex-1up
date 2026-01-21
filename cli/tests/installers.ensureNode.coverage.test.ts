import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InstallerContext, InstallerOptions, Logger } from '../src/installers/types.js'

// The Homebrew-based Node install path is macOS-only. Force a deterministic platform
// for this test file so the brew-path tests behave consistently across CI runners.
vi.mock('os', async () => {
  const actual = await vi.importActual<any>('os')
  return {
    ...actual,
    platform: () => 'darwin',
    arch: () => 'arm64',
  }
})

vi.mock('zx', () => {
  return {
    which: vi.fn(),
    $: vi.fn()
  }
})

describe('installers/ensureNode', () => {
  const logger: Logger = { log: vi.fn(), info: vi.fn(), ok: vi.fn(), warn: vi.fn(), err: vi.fn() }

  function baseOptions(overrides: Partial<InstallerOptions> = {}): InstallerOptions {
    return {
      profile: 'skip',
      profileScope: 'single',
      profileMode: 'add',
      setDefaultProfile: false,
      profilesSelected: undefined,
      installTools: 'skip',
      toolsSelected: undefined,
      installCodexCli: 'no',
      notify: 'no',
      globalAgents: 'skip',
      notificationSound: undefined,
      skills: 'skip',
      skillsSelected: undefined,
      mode: 'manual',
      installNode: 'skip',
      shell: 'auto',
      vscodeId: undefined,
      noVscode: true,
      agentsMd: undefined,
      dryRun: true,
      assumeYes: true,
      skipConfirmation: true,
      ...overrides
    }
  }

  type CtxOverrides =
    Partial<Omit<InstallerContext, 'options' | 'logger'>> &
    { options?: Partial<InstallerOptions>; logger?: Partial<Logger> }

  function makeCtx(overrides: CtxOverrides = {}): InstallerContext {
    const { options: optionsOverrides, logger: loggerOverrides, ...rest } = overrides
    const mergedLogger: Logger = { ...logger, ...(loggerOverrides || {}) }
    const mergedOptions = baseOptions(optionsOverrides || {})
    return {
      cwd: '/tmp',
      homeDir: '/tmp/home',
      rootDir: '/tmp/root',
      logDir: '/tmp/log',
      logFile: '/tmp/log/install.log',
      logger: mergedLogger,
      options: mergedOptions,
      ...rest,
    }
  }

  beforeEach(() => {
    // Reset mock implementations and any mockResolvedValueOnce queues between tests.
    vi.resetAllMocks()
  })

  it('returns early when node and npm are present', async () => {
    const zx = await import('zx')
    const whichMock = zx.which as unknown as ReturnType<typeof vi.fn>
    whichMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'node') return '/usr/bin/node'
      if (cmd === 'npm') return '/usr/bin/npm'
      throw new Error('not found')
    })

    const dollarMock = zx.$ as unknown as ReturnType<typeof vi.fn>
    dollarMock.mockResolvedValueOnce({ stdout: 'v20.12.0\n' })

    const { ensureNode } = await import('../src/installers/ensureNode.js')
    await expect(ensureNode(makeCtx({ options: { installNode: 'skip', dryRun: false, assumeYes: true, skipConfirmation: true } }))).resolves.toBeUndefined()
    expect(logger.ok).toHaveBeenCalledWith('Node.js present (v20.12.0)')
  })

  it('warns and returns when installNode is skip and prerequisites missing', async () => {
    const zx = await import('zx')
    const whichMock = zx.which as unknown as ReturnType<typeof vi.fn>
    whichMock.mockRejectedValue(new Error('not found'))

    const { ensureNode } = await import('../src/installers/ensureNode.js')
    await expect(ensureNode(makeCtx({ options: { installNode: 'skip', dryRun: false, assumeYes: true, skipConfirmation: true } }))).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('attempts brew path and verifies node after install', async () => {
    const zx = await import('zx')
    const whichMock = zx.which as unknown as ReturnType<typeof vi.fn>

    // First check: node/npm missing. Later verification: node present.
    const nodeCalls: number[] = []
    whichMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'node') {
        nodeCalls.push(1)
        if (nodeCalls.length === 1) throw new Error('missing')
        return '/usr/bin/node'
      }
      if (cmd === 'npm') throw new Error('missing')
      if (cmd === 'brew') throw new Error('missing')
      throw new Error('missing')
    })

    const dollarMock = zx.$ as unknown as ReturnType<typeof vi.fn>
    dollarMock.mockResolvedValueOnce({ stdout: 'v20.12.0\n' })

    const { ensureNode } = await import('../src/installers/ensureNode.js')
    const ctx = makeCtx({
      options: { installNode: 'brew', dryRun: true, assumeYes: true, skipConfirmation: true }
    })
    await expect(ensureNode(ctx)).resolves.toBeUndefined()
    expect(logger.log).toHaveBeenCalledWith('[dry-run] install Homebrew')
    expect(logger.ok).toHaveBeenCalledWith('Node.js installed (v20.12.0)')
  })

  it('nvm dry-run path logs and then verifies node', async () => {
    const zx = await import('zx')
    const whichMock = zx.which as unknown as ReturnType<typeof vi.fn>
    const dollarMock = zx.$ as unknown as ReturnType<typeof vi.fn>

    // First check: node/npm missing. After "install": node present.
    let nodeChecks = 0
    whichMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'node') {
        nodeChecks++
        if (nodeChecks === 1) throw new Error('missing')
        return '/usr/bin/node'
      }
      if (cmd === 'npm') throw new Error('missing')
      return '/usr/bin/ok'
    })

    dollarMock.mockResolvedValueOnce({ stdout: 'v18.19.0\n' })

    const { ensureNode } = await import('../src/installers/ensureNode.js')
    const ctx = makeCtx({ options: { installNode: 'nvm', dryRun: true, assumeYes: true, skipConfirmation: true } })
    await expect(ensureNode(ctx)).resolves.toBeUndefined()
    expect(logger.log).toHaveBeenCalledWith('[dry-run] install nvm + Node LTS')
    expect(logger.ok).toHaveBeenCalledWith('Node.js installed (v18.19.0)')
  })

  it('brew path calls brew install node in dry-run', async () => {
    const zx = await import('zx')
    const whichMock = zx.which as unknown as ReturnType<typeof vi.fn>
    const dollarMock = zx.$ as unknown as ReturnType<typeof vi.fn>

    let nodeChecks = 0
    whichMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'node') {
        nodeChecks++
        if (nodeChecks === 1) throw new Error('missing')
        return '/usr/bin/node'
      }
      if (cmd === 'npm') throw new Error('missing')
      if (cmd === 'brew') return '/usr/local/bin/brew'
      return '/usr/bin/ok'
    })
    dollarMock.mockResolvedValueOnce({ stdout: 'v20.12.0\n' })

    const { ensureNode } = await import('../src/installers/ensureNode.js')
    const ctx = makeCtx({ options: { installNode: 'brew', dryRun: true, assumeYes: true, skipConfirmation: true } })
    await expect(ensureNode(ctx)).resolves.toBeUndefined()
    expect(logger.log).toHaveBeenCalledWith('[dry-run] brew install node')
    expect(logger.ok).toHaveBeenCalledWith('Node.js installed (v20.12.0)')
  })
})

