import { which } from 'zx'
import { spawn } from 'node:child_process'
import type { PackageManager, Logger } from './types.js'

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

export function createBackupPath(originalPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  return `${originalPath}.backup.${timestamp}`
}

export async function ensureDir(path: string): Promise<void> {
  const { mkdir } = await import('fs/promises')
  await mkdir(path, { recursive: true })
}
