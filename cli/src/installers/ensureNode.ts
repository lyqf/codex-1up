import { $ } from 'zx'
import type { InstallerContext } from './types.js'
import { needCmd, runCommand } from './utils.js'
import fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import * as p from '@clack/prompts'

export async function ensureNode(ctx: InstallerContext): Promise<void> {
  const hasNode = await needCmd('node')
  const hasNpm = await needCmd('npm')

  if (hasNode && hasNpm) {
    const version = (await $`node -v`).stdout.trim()
    ctx.logger.ok(`Node.js present (${version})`)
    return
  }

  const method = ctx.options.installNode

  switch (method) {
    case 'nvm':
      await installNodeViaNvm(ctx)
      break
    case 'brew':
      await installNodeViaBrew(ctx)
      break
    case 'skip':
      ctx.logger.warn('Skipping Node installation; please install Node 18+ manually')
      return
  }

  // Verify installation
  if (await needCmd('node')) {
    const version = (await $`node -v`).stdout.trim()
    ctx.logger.ok(`Node.js installed (${version})`)
  } else {
    ctx.logger.err('Node installation failed')
    throw new Error('Node.js installation failed')
  }
}

async function installNodeViaNvm(ctx: InstallerContext): Promise<void> {
  ctx.logger.info('Installing Node.js via nvm')

  if (ctx.options.dryRun) {
    ctx.logger.log('[dry-run] install nvm + Node LTS')
    return
  }

  const interactive =
    process.stdout.isTTY &&
    !ctx.options.dryRun &&
    !ctx.options.skipConfirmation &&
    !ctx.options.assumeYes

  const nvmDir = path.join(ctx.homeDir, '.nvm')
  if (!(await fs.pathExists(nvmDir))) {
    if (interactive) {
      const answer = await p.confirm({
        message: 'This will download and run the nvm installer script (from GitHub) and then install Node LTS. Continue?',
        initialValue: true
      })
      if (p.isCancel(answer) || !answer) {
        throw new Error('Node installation aborted by user')
      }
    }
    ctx.logger.info('Installing nvm...')
    await $`bash -c "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"`
  }

  // Source nvm and install Node LTS
  // We need to run this in a shell that sources nvm.sh
  const installScript = `export NVM_DIR="${nvmDir}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm install --lts`
  await $`bash -c ${installScript}`
}

async function installNodeViaBrew(ctx: InstallerContext): Promise<void> {
  ctx.logger.info('Installing Node.js via Homebrew')

  const interactive =
    process.stdout.isTTY &&
    !ctx.options.dryRun &&
    !ctx.options.skipConfirmation &&
    !ctx.options.assumeYes

  // Ensure brew is installed first
  if (!(await needCmd('brew'))) {
    if (os.platform() === 'darwin') {
      ctx.logger.info('Homebrew not found; installing Homebrew')
      if (ctx.options.dryRun) {
        ctx.logger.log('[dry-run] install Homebrew')
        return
      }
      if (interactive) {
        const answer = await p.confirm({
          message: 'This will download and run the official Homebrew installer script (from GitHub). Continue?',
          initialValue: true
        })
        if (p.isCancel(answer) || !answer) {
          throw new Error('Homebrew installation aborted by user')
        }
      }
      await $`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
      // Add brew to PATH for current session
      const brewPath = os.platform() === 'darwin' && os.arch() === 'arm64' 
        ? '/opt/homebrew/bin/brew'
        : '/usr/local/bin/brew'
      if (await fs.pathExists(brewPath)) {
        const brewDir = path.dirname(brewPath)
        process.env.PATH = `${brewDir}:${process.env.PATH || ''}`
        // Also try to source shellenv
        try {
          const shellenv = (await $`${brewPath} shellenv`).stdout.trim()
          // Extract PATH additions from shellenv output
          const pathMatch = shellenv.match(/export PATH="([^"]+)"/)
          if (pathMatch) {
            process.env.PATH = `${pathMatch[1]}:${process.env.PATH || ''}`
          }
        } catch (error) {
          void error
        }
      }
    } else {
      throw new Error('Homebrew is only available on macOS')
    }
  }

  await runCommand('brew', ['install', 'node'], {
    dryRun: ctx.options.dryRun,
    logger: ctx.logger
  })
}
