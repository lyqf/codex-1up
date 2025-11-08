import type { InstallerContext } from './types.js'
import fs from 'fs-extra'
import * as path from 'path'
import { createBackupPath } from './utils.js'

export async function maybeWriteAgents(ctx: InstallerContext): Promise<void> {
  const agentsTarget = ctx.options.agentsMd
  if (!agentsTarget) {
    return
  }

  let targetPath = agentsTarget
  if ((await fs.stat(targetPath).catch(() => null))?.isDirectory()) {
    targetPath = path.join(targetPath, 'AGENTS.md')
  }

  const templateSrc = path.join(ctx.rootDir, 'templates', 'agent-templates', 'AGENTS-default.md')

  if (await fs.pathExists(targetPath)) {
    ctx.logger.warn(`${targetPath} already exists`)
    // Confirmation should be handled by CLI layer
    // For now, if we reach here, create backup and overwrite
    const backup = createBackupPath(targetPath)
    if (ctx.options.dryRun) {
      ctx.logger.log(`[dry-run] cp ${targetPath} ${backup}`)
    } else {
      await fs.copy(targetPath, backup)
    }
    ctx.logger.info(`Backed up existing AGENTS.md to: ${backup}`)
  }

  ctx.logger.info(`Writing starter AGENTS.md to: ${targetPath}`)
  if (ctx.options.dryRun) {
    ctx.logger.log(`[dry-run] write AGENTS.md to ${targetPath}`)
  } else {
    await fs.ensureDir(path.dirname(targetPath))
    await fs.copy(templateSrc, targetPath)
    ctx.logger.ok('Wrote AGENTS.md')
  }
}
