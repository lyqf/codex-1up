import { which, $ } from 'zx'
import { spawn } from 'node:child_process'
import type { PackageManager, Logger } from './types.js'

export type NodePmChoice =
  | { pm: 'pnpm'; binDir: string }
  | { pm: 'npm'; reason: 'npm-default' | 'pnpm-opt-out' }
  | { pm: 'none'; reason: 'pnpm-misconfigured' | 'pnpm-error' | 'not-found' }

// zx `$` is great for templated calls, but for dynamic
// cmd + args we use Node's spawn for reliability.

export async function needCmd(cmd: string): Promise<boolean> {
  try {
    await which(cmd)
    return true
  } catch {
    return false
  }
}

export function isMacOS(): boolean {
  return process.platform === 'darwin'
}

export async function cmdExists(cmd: string): Promise<boolean> {
  return needCmd(cmd)
}

export async function detectPackageManager(): Promise<PackageManager> {
  if (await needCmd('brew')) return 'brew'
  if (await needCmd('apt-get')) return 'apt'
  if (await needCmd('dnf')) return 'dnf'
  if (await needCmd('pacman')) return 'pacman'
  if (await needCmd('zypper')) return 'zypper'
  return 'none'
}

// Helper to construct a privileged package manager command.
// On macOS/Homebrew we never require sudo here; for Linux package managers
// we want to transparently support both root and non-root users:
//   - If running as root, call the pm binary directly (e.g. "apt-get").
//   - Otherwise, prefix with "sudo" (e.g. "sudo apt-get").
export function createPrivilegedPmCmd(pmCmd: string): { cmd: string; argsPrefix: string[] } {
  // Windows doesn't have sudo; treat as unprivileged/no-prefix.
  if (process.platform === 'win32') return { cmd: pmCmd, argsPrefix: [] }
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
  if (isRoot) return { cmd: pmCmd, argsPrefix: [] }
  return { cmd: 'sudo', argsPrefix: [pmCmd] }
}

// Detect the user's Node package manager preference for global installs.
// Preference: pnpm -> npm (we avoid yarn global to prevent surprises)

// Prefer pnpm if available and its global bin is configured; otherwise skip to avoid cross-manager installs.
export async function chooseNodePmForGlobal(logger?: Logger): Promise<NodePmChoice> {
  if (await needCmd('pnpm')) {
    try {
      const out = await $`pnpm bin -g`.quiet()
      const binDir = out.stdout.trim()
      if (binDir) return { pm: 'pnpm', binDir }
      // If empty, treat as misconfigured
      logger?.warn('Detected pnpm but global bin dir is not configured; skipping global Node installs to avoid duplicates. Run "pnpm setup" then re-run.')
      return { pm: 'none', reason: 'pnpm-misconfigured' }
    } catch {
      logger?.warn('Detected pnpm but global bin dir is not configured; skipping global Node installs to avoid duplicates. Run "pnpm setup" then re-run.')
      return { pm: 'none', reason: 'pnpm-error' }
    }
  }
  if (await needCmd('npm')) return { pm: 'npm', reason: 'npm-default' }
  return { pm: 'none', reason: 'not-found' }
}

export async function runCommand(
  cmd: string,
  args: string[],
  options: { dryRun: boolean; logger?: Logger; cwd?: string } = { dryRun: false }
): Promise<void> {
  if (options.dryRun) {
    const cmdStr = [cmd, ...args].map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')
    options.logger?.log(`[dry-run] ${cmdStr}`)
    return
  }
  const proc = spawn(cmd, args, {
    stdio: 'inherit',
    cwd: options.cwd || process.cwd(),
    shell: false
  })
  await new Promise<void>((resolve, reject) => {
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}`))
    })
  })
}

export interface ExecCaptureOptions {
  cwd?: string
  timeoutMs?: number
}

export interface ExecCaptureResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export async function execCapture(
  cmd: string,
  args: string[],
  options: ExecCaptureOptions = {}
): Promise<ExecCaptureResult> {
  const proc = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: options.cwd || process.cwd(),
    shell: false
  })

  let stdout = ''
  let stderr = ''
  let timedOut = false

  proc.stdout?.setEncoding('utf8')
  proc.stderr?.setEncoding('utf8')
  proc.stdout?.on('data', (chunk) => { stdout += String(chunk) })
  proc.stderr?.on('data', (chunk) => { stderr += String(chunk) })

  let timeout: NodeJS.Timeout | undefined
  if (options.timeoutMs && options.timeoutMs > 0) {
    timeout = setTimeout(() => {
      timedOut = true
      try {
        // Best-effort: terminate, then hard kill.
        proc.kill()
        setTimeout(() => {
          try { proc.kill('SIGKILL') } catch { /* ignore */ }
        }, 250).unref?.()
      } catch {
        // ignore
      }
    }, options.timeoutMs)
    timeout.unref?.()
  }

  return await new Promise<ExecCaptureResult>((resolve) => {
    proc.on('error', (err) => {
      if (timeout) clearTimeout(timeout)
      resolve({ code: null, stdout, stderr: `${stderr}${stderr ? '\n' : ''}${String(err)}`, timedOut })
    })
    proc.on('close', (code) => {
      if (timeout) clearTimeout(timeout)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

export function createBackupPath(originalPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  return `${originalPath}.backup.${timestamp}`
}

export async function ensureDir(path: string): Promise<void> {
  const { mkdir } = await import('fs/promises')
  await mkdir(path, { recursive: true })
}
