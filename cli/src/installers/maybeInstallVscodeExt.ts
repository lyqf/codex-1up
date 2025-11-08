import type { InstallerContext } from './types.js'
import { needCmd, runCommand } from './utils.js'

export async function maybeInstallVscodeExt(ctx: InstallerContext): Promise<void> {
  if (ctx.options.noVscode) {
    return
  }

  const vscodeId = ctx.options.vscodeId
  if (!vscodeId) {
    ctx.logger.info('VS Code extension id not provided. Use: --vscode <publisher.extension>')
    return
  }

  if (!(await needCmd('code'))) {
    ctx.logger.warn("'code' (VS Code) not in PATH; skipping extension install")
    return
  }

  // Confirmation should be handled by CLI layer
  // For now, if we reach here and it's not dry-run, install
  if (ctx.options.dryRun) {
    ctx.logger.log(`[dry-run] code --install-extension ${vscodeId}`)
    return
  }

  ctx.logger.info(`Installing VS Code extension: ${vscodeId}`)
  await runCommand('code', ['--install-extension', vscodeId, '--force'], {
    dryRun: false,
    logger: ctx.logger
  })
  ctx.logger.ok(`VS Code extension '${vscodeId}' installed (or already present)`)
}

