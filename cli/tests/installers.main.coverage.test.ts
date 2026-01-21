import { describe, it, expect, vi, beforeEach } from 'vitest'

const logger = { log: vi.fn(), info: vi.fn(), ok: vi.fn(), warn: vi.fn(), err: vi.fn() }

const ensureNode = vi.fn()
const installNpmGlobals = vi.fn()
const ensureTools = vi.fn()
const writeCodexConfig = vi.fn()
const ensureNotifyHook = vi.fn()
const setupNotificationSound = vi.fn()
const maybePromptGlobalAgents = vi.fn()
const maybeInstallVscodeExt = vi.fn()
const maybeWriteAgents = vi.fn()
const maybeInstallSkills = vi.fn()

const needCmd = vi.fn()

vi.mock('fs-extra', () => {
  return {
    __esModule: true,
    default: {
      ensureDir: vi.fn().mockResolvedValue(undefined),
      chmod: vi.fn().mockResolvedValue(undefined)
    }
  }
})

vi.mock('../src/installers/logger.js', () => {
  return { createLogger: vi.fn(() => logger) }
})
vi.mock('../src/installers/ensureNode.js', () => ({ ensureNode }))
vi.mock('../src/installers/installNpmGlobals.js', () => ({ installNpmGlobals }))
vi.mock('../src/installers/ensureTools.js', () => ({ ensureTools }))
vi.mock('../src/installers/writeCodexConfig.js', () => ({ writeCodexConfig }))
vi.mock('../src/installers/ensureNotifyHook.js', () => ({ ensureNotifyHook }))
vi.mock('../src/installers/setupNotificationSound.js', () => ({ setupNotificationSound }))
vi.mock('../src/installers/maybePromptGlobalAgents.js', () => ({ maybePromptGlobalAgents }))
vi.mock('../src/installers/maybeInstallVscodeExt.js', () => ({ maybeInstallVscodeExt }))
vi.mock('../src/installers/maybeWriteAgents.js', () => ({ maybeWriteAgents }))
vi.mock('../src/installers/maybeInstallSkills.js', () => ({ maybeInstallSkills }))
vi.mock('../src/installers/utils.js', async () => {
  const actual = await vi.importActual<any>('../src/installers/utils.js')
  return { ...actual, needCmd }
})

describe('installers/main runInstaller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureNode.mockResolvedValue(undefined)
    installNpmGlobals.mockResolvedValue(undefined)
    ensureTools.mockResolvedValue(undefined)
    writeCodexConfig.mockResolvedValue(undefined)
    ensureNotifyHook.mockResolvedValue(undefined)
    setupNotificationSound.mockResolvedValue(undefined)
    maybePromptGlobalAgents.mockResolvedValue(undefined)
    maybeInstallVscodeExt.mockResolvedValue(undefined)
    maybeWriteAgents.mockResolvedValue(undefined)
    maybeInstallSkills.mockResolvedValue(undefined)
  })

  function baseOptions(overrides: Partial<any> = {}) {
    return {
      installTools: 'skip',
      installCodexCli: 'no',
      profile: 'skip',
      profileScope: 'single',
      profileMode: 'add',
      setDefaultProfile: false,
      notify: 'no',
      globalAgents: 'skip',
      skills: 'skip',
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

  it('skips config/notify setup when codex missing and installCodexCli is not yes', async () => {
    needCmd.mockResolvedValue(false) // codex missing
    const { runInstaller } = await import('../src/installers/main.js')
    await expect(runInstaller(baseOptions({ installCodexCli: 'no' }), '/tmp/root')).resolves.toBeUndefined()
    expect(writeCodexConfig).not.toHaveBeenCalled()
    expect(ensureNotifyHook).not.toHaveBeenCalled()
    expect(setupNotificationSound).not.toHaveBeenCalled()
    expect(maybePromptGlobalAgents).not.toHaveBeenCalled()
    expect(maybeInstallSkills).toHaveBeenCalled()
    expect(maybeInstallVscodeExt).toHaveBeenCalled()
    expect(maybeWriteAgents).toHaveBeenCalled()
  })

  it('runs config/notify setup when codex is present', async () => {
    needCmd.mockImplementation(async (cmd: string) => cmd === 'codex')
    const { runInstaller } = await import('../src/installers/main.js')
    await expect(runInstaller(baseOptions({ installCodexCli: 'auto', noVscode: true }), '/tmp/root')).resolves.toBeUndefined()
    expect(writeCodexConfig).toHaveBeenCalled()
    expect(ensureNotifyHook).toHaveBeenCalled()
    expect(setupNotificationSound).toHaveBeenCalled()
    expect(maybePromptGlobalAgents).toHaveBeenCalled()
  })
})

