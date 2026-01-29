import type { Logger } from './types.js'
import { execCapture, needCmd } from './utils.js'

const CODEX_PKG = '@openai/codex'
const NPM_REGISTRY_TIMEOUT_MS = 2000
const CODEX_VERSION_TIMEOUT_MS = 1200
const NPM_LS_TIMEOUT_MS = 2000

export interface CodexStatus {
  found: boolean
  version?: string
  latest?: string
  updateAvailable: boolean
}

export async function getCodexStatus(logger?: Logger): Promise<CodexStatus> {
  const installed = await getInstalledCodexVersion()
  const latest = await getLatestCodexVersion(logger)
  const updateAvailable = Boolean(installed.found && installed.version && latest && installed.version !== latest)
  return {
    found: installed.found,
    version: installed.version,
    latest,
    updateAvailable
  }
}

export async function getLatestCodexVersion(logger?: Logger): Promise<string | undefined> {
  try {
    const data = await fetchJsonWithTimeout(
      `https://registry.npmjs.org/${encodeURIComponent(CODEX_PKG)}/latest`,
      NPM_REGISTRY_TIMEOUT_MS
    )
    const latest = String((data as { version?: string } | undefined)?.version || '').trim()
    if (!latest) {
      logger?.warn('Could not fetch latest Codex CLI version; skipping upgrade check')
      return undefined
    }
    return latest
  } catch (error) {
    logger?.warn(`Error checking latest Codex CLI version: ${error}`)
    return undefined
  }
}

export async function getInstalledCodexVersion(): Promise<{ found: boolean; version?: string }> {
  const hasCmd = await needCmd('codex')
  if (!hasCmd) return { found: false }

  let version = ''

  try {
    const res = await execCapture('codex', ['--version'], { timeoutMs: CODEX_VERSION_TIMEOUT_MS })
    if (!res.timedOut) {
      version = parseSemver(res.stdout || '')
    }
  } catch (error) {
    void error
  }

  if (!version) {
    try {
      // Fall back to npm ls -g for cases where codex --version isn't available.
      if (!(await needCmd('npm'))) return { found: true, version: undefined }
      const installedResult = await execCapture(
        'npm',
        ['ls', '-g', CODEX_PKG, '--depth=0', '--json'],
        { timeoutMs: NPM_LS_TIMEOUT_MS }
      )
      if (installedResult.timedOut) return { found: true, version: undefined }
      const installedJson = JSON.parse(installedResult.stdout || '{}')
      version = installedJson.dependencies?.[CODEX_PKG]?.version || ''
    } catch (error) {
      void error
    }
  }

  return { found: true, version: version || undefined }
}

function parseSemver(value: string): string {
  const match = value.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/)
  return match ? match[1] : ''
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown | undefined> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  timeout.unref?.()
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return undefined
    return await res.json()
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}
