import type { InstallerContext, Profile } from './types.js'
import fs from 'fs-extra'
import * as path from 'path'
import { createBackupPath } from './utils.js'

export async function writeCodexConfig(ctx: InstallerContext): Promise<void> {
  const cfgPath = path.join(ctx.homeDir, '.codex', 'config.toml')
  const templateFile = path.join(ctx.rootDir, 'templates', 'codex-config.toml')

  await fs.ensureDir(path.dirname(cfgPath))

  if (!(await fs.pathExists(templateFile))) {
    ctx.logger.err(`Unified config template missing at ${templateFile}`)
    throw new Error(`Template not found: ${templateFile}`)
  }

  if (!(await fs.pathExists(cfgPath))) {
    ctx.logger.info(`Creating unified Codex config with multiple profiles at ${cfgPath}`)
    if (ctx.options.dryRun) {
      ctx.logger.log(`[dry-run] cp ${templateFile} ${cfgPath}`)
    } else {
      await fs.copy(templateFile, cfgPath)
    }
    ctx.logger.ok('Created ~/.codex/config.toml')
    await setActiveProfile(cfgPath, ctx.options.profile, ctx)
    ctx.logger.info("Tip: use 'codex --profile <name>' to switch at runtime or 'codex-1up config set-profile <name>' to persist.")
    return
  }

  ctx.logger.warn('~/.codex/config.toml already exists')

  const overwrite = ctx.options.overwriteConfig

  if (overwrite === 'no') {
    ctx.logger.info('Keeping existing config unchanged')
    return
  }

  let confirmed = false
  if (overwrite === 'yes') {
    confirmed = true
  } else if (!ctx.options.assumeYes && !ctx.options.skipConfirmation) {
    // This should be handled by CLI layer, but fallback for safety
    confirmed = false
    ctx.logger.info('Keeping existing config; you can manage profiles via the new CLI later.')
    return
  }

  if (confirmed) {
    const backup = createBackupPath(cfgPath)
    if (ctx.options.dryRun) {
      ctx.logger.log(`[dry-run] cp ${cfgPath} ${backup}`)
    } else {
      await fs.copy(cfgPath, backup)
    }
    ctx.logger.info(`Backed up to ${backup}`)
    if (ctx.options.dryRun) {
      ctx.logger.log(`[dry-run] cp ${templateFile} ${cfgPath}`)
    } else {
      await fs.copy(templateFile, cfgPath)
    }
    ctx.logger.ok('Overwrote ~/.codex/config.toml with unified template')
    await setActiveProfile(cfgPath, ctx.options.profile, ctx)
  }
}

async function setActiveProfile(
  cfgPath: string,
  profile: Profile,
  ctx: InstallerContext
): Promise<void> {
  ctx.logger.info(`Setting active profile to: ${profile}`)

  if (ctx.options.dryRun) {
    ctx.logger.log(`[dry-run] set profile = "${profile}" in ${cfgPath}`)
    return
  }

  const content = await fs.readFile(cfgPath, 'utf8')
  const lines = content.split('\n')
  let found = false
  const updated = lines.map((line) => {
    if (/^\s*profile\s*=/.test(line)) {
      found = true
      return `profile = "${profile}"`
    }
    return line
  })

  if (!found) {
    updated.unshift(`profile = "${profile}"`)
  }

  await fs.writeFile(cfgPath, updated.join('\n'), 'utf8')
}
