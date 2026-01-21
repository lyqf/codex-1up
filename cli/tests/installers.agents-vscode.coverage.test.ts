import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { EventEmitter } from 'node:events'

vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn()
  }
})

vi.mock('zx', () => {
  return {
    which: vi.fn(),
    $: vi.fn()
  }
})

describe('installers/maybe* helpers', () => {
  const logger = { log: vi.fn(), info: vi.fn(), ok: vi.fn(), warn: vi.fn(), err: vi.fn() }

  function makeCtx(overrides: Partial<any> = {}) {
    return {
      cwd: '/tmp',
      homeDir: '/tmp/home',
      rootDir: '/tmp/root',
      logDir: '/tmp/log',
      logFile: '/tmp/log/install.log',
      logger,
      options: {
        dryRun: false,
        noVscode: false,
        vscodeId: 'publisher.ext',
        globalAgents: 'skip',
        agentsMd: undefined,
        skipConfirmation: true,
        assumeYes: true
      },
      ...overrides
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maybeInstallVscodeExt exits early when disabled or missing args', async () => {
    const { maybeInstallVscodeExt } = await import('../src/installers/maybeInstallVscodeExt.js')

    await expect(maybeInstallVscodeExt(makeCtx({ options: { noVscode: true } }))).resolves.toBeUndefined()
    await expect(maybeInstallVscodeExt(makeCtx({ options: { noVscode: false, vscodeId: undefined } }))).resolves.toBeUndefined()
    expect(logger.info).toHaveBeenCalled()
  })

  it('maybeInstallVscodeExt skips when code not in PATH', async () => {
    const zx = await import('zx')
    const whichMock = zx.which as unknown as ReturnType<typeof vi.fn>
    whichMock.mockRejectedValue(new Error('missing'))

    const { maybeInstallVscodeExt } = await import('../src/installers/maybeInstallVscodeExt.js')
    await expect(maybeInstallVscodeExt(makeCtx())).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('maybeInstallVscodeExt dry-runs and installs extension', async () => {
    const zx = await import('zx')
    const whichMock = zx.which as unknown as ReturnType<typeof vi.fn>
    whichMock.mockResolvedValue('/usr/bin/code')

    const cp = await import('node:child_process')
    const spawnMock = cp.spawn as unknown as ReturnType<typeof vi.fn>
    spawnMock.mockImplementation(() => {
      const proc = new EventEmitter() as unknown as { on: (ev: string, cb: (...args: any[]) => void) => void }
      process.nextTick(() => (proc as unknown as EventEmitter).emit('exit', 0))
      return proc
    })

    const { maybeInstallVscodeExt } = await import('../src/installers/maybeInstallVscodeExt.js')

    await expect(maybeInstallVscodeExt(makeCtx({ options: { dryRun: true, noVscode: false, vscodeId: 'pub.ext' } }))).resolves.toBeUndefined()
    expect(logger.log).toHaveBeenCalledWith('[dry-run] code --install-extension pub.ext')

    await expect(maybeInstallVscodeExt(makeCtx({ options: { dryRun: false, noVscode: false, vscodeId: 'pub.ext' } }))).resolves.toBeUndefined()
    expect(logger.ok).toHaveBeenCalledWith("VS Code extension 'pub.ext' installed (or already present)")
  })

  it('maybePromptGlobalAgents respects modes (create/overwrite/append)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-21T00:00:00.000Z'))

    const rootDir = await fs.mkdtemp(join(tmpdir(), 'codex-1up-root-'))
    const homeDir = await fs.mkdtemp(join(tmpdir(), 'codex-1up-home-'))
    const templateDir = join(rootDir, 'templates', 'agent-templates')
    await fs.mkdir(templateDir, { recursive: true })
    const templateSrc = join(templateDir, 'AGENTS-default.md')
    await fs.writeFile(templateSrc, '# template\n', 'utf8')

    const { maybePromptGlobalAgents } = await import('../src/installers/maybePromptGlobalAgents.js')

    // create-default writes when missing
    const ctxCreate = makeCtx({ rootDir, homeDir, options: { globalAgents: 'create-default', dryRun: false } })
    await expect(maybePromptGlobalAgents(ctxCreate)).resolves.toBeUndefined()
    await expect(fs.readFile(join(homeDir, '.codex', 'AGENTS.md'), 'utf8')).resolves.toContain('# template')

    // overwrite-default backs up then overwrites
    await fs.writeFile(join(homeDir, '.codex', 'AGENTS.md'), '# old\n', 'utf8')
    const ctxOverwrite = makeCtx({ rootDir, homeDir, options: { globalAgents: 'overwrite-default', dryRun: false } })
    await expect(maybePromptGlobalAgents(ctxOverwrite)).resolves.toBeUndefined()
    const backupPath = join(homeDir, '.codex', 'AGENTS.md.backup.2026-01-21T00-00-00')
    await expect(fs.readFile(backupPath, 'utf8')).resolves.toContain('# old')

    // append-default backs up then appends template content
    await fs.writeFile(join(homeDir, '.codex', 'AGENTS.md'), '# base\n', 'utf8')
    const ctxAppend = makeCtx({ rootDir, homeDir, options: { globalAgents: 'append-default', dryRun: false } })
    await expect(maybePromptGlobalAgents(ctxAppend)).resolves.toBeUndefined()
    const updated = await fs.readFile(join(homeDir, '.codex', 'AGENTS.md'), 'utf8')
    expect(updated).toContain('# base')
    expect(updated).toContain('---')
    expect(updated).toContain('# template')

    await fs.rm(rootDir, { recursive: true, force: true })
    await fs.rm(homeDir, { recursive: true, force: true })
  })

  it('maybeWriteAgents writes to directory target and backs up existing file', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-21T00:00:00.000Z'))

    const rootDir = await fs.mkdtemp(join(tmpdir(), 'codex-1up-root-'))
    const homeDir = await fs.mkdtemp(join(tmpdir(), 'codex-1up-home-'))
    const targetDir = await fs.mkdtemp(join(tmpdir(), 'codex-1up-target-'))
    const templateDir = join(rootDir, 'templates', 'agent-templates')
    await fs.mkdir(templateDir, { recursive: true })
    await fs.writeFile(join(templateDir, 'AGENTS-default.md'), '# template\n', 'utf8')

    // existing file triggers backup
    const targetPath = join(targetDir, 'AGENTS.md')
    await fs.writeFile(targetPath, '# old\n', 'utf8')

    const { maybeWriteAgents } = await import('../src/installers/maybeWriteAgents.js')
    const ctx = makeCtx({ rootDir, homeDir, options: { agentsMd: targetDir, dryRun: false } })
    await expect(maybeWriteAgents(ctx)).resolves.toBeUndefined()
    const backupPath = `${targetPath}.backup.2026-01-21T00-00-00`
    await expect(fs.readFile(backupPath, 'utf8')).resolves.toContain('# old')
    await expect(fs.readFile(targetPath, 'utf8')).resolves.toContain('# template')

    // dry-run path
    const ctxDry = makeCtx({ rootDir, homeDir, options: { agentsMd: targetDir, dryRun: true } })
    await expect(maybeWriteAgents(ctxDry)).resolves.toBeUndefined()
    expect(logger.log).toHaveBeenCalled()

    await fs.rm(rootDir, { recursive: true, force: true })
    await fs.rm(homeDir, { recursive: true, force: true })
    await fs.rm(targetDir, { recursive: true, force: true })
  })
})

