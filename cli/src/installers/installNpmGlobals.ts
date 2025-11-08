import { $ } from 'zx'
import type { InstallerContext } from './types.js'
import { needCmd, runCommand } from './utils.js'

const REQUIRED_PACKAGES = ['@openai/codex', '@ast-grep/cli'] as const

export async function installNpmGlobals(ctx: InstallerContext): Promise<void> {
  ctx.logger.info('Checking global npm packages (@openai/codex, @ast-grep/cli)')

  const updates: string[] = []

  for (const pkg of REQUIRED_PACKAGES) {
    try {
      // Fetch latest version
      const latestResult = await $`npm view ${pkg} version`.quiet()
      const latest = latestResult.stdout.trim()

      if (!latest) {
        ctx.logger.warn(`Could not fetch latest version for ${pkg}; skipping upgrade check`)
        continue
      }

      // Check installed version
      const installedResult = await $`npm ls -g ${pkg} --depth=0 --json`.quiet().nothrow()
      let installed = ''
      try {
        const installedJson = JSON.parse(installedResult.stdout || '{}')
        installed = installedJson.dependencies?.[pkg]?.version || ''
      } catch {
        installed = ''
      }

      if (!installed) {
        ctx.logger.info(`${pkg} not installed; will install @${latest}`)
        updates.push(`${pkg}@${latest}`)
      } else if (installed !== latest) {
        ctx.logger.info(`${pkg} ${installed} -> ${latest}`)
        updates.push(`${pkg}@${latest}`)
      } else {
        ctx.logger.ok(`${pkg} up-to-date (${installed})`)
      }
    } catch (error) {
      ctx.logger.warn(`Error checking ${pkg}: ${error}`)
      // Still try to install if not present
      const installedResult = await $`npm ls -g ${pkg} --depth=0 --json`.quiet().nothrow()
      let installed = ''
      try {
        const installedJson = JSON.parse(installedResult.stdout || '{}')
        installed = installedJson.dependencies?.[pkg]?.version || ''
      } catch {
        installed = ''
      }
      if (!installed) {
        updates.push(pkg)
      }
    }
  }

  if (updates.length > 0) {
    ctx.logger.info('Installing/updating global npm packages')
    await runCommand('npm', ['install', '-g', ...updates], {
      dryRun: ctx.options.dryRun,
      logger: ctx.logger
    })
  } else {
    ctx.logger.ok('Global npm packages are up-to-date')
  }

  // Verify installations
  if (await needCmd('codex')) {
    ctx.logger.ok('Codex CLI installed')
  } else {
    ctx.logger.err('Codex CLI not found after install')
  }

  if (await needCmd('ast-grep')) {
    ctx.logger.ok('ast-grep installed')
  } else {
    ctx.logger.warn('ast-grep not found; check npm global path')
  }
}

