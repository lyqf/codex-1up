import type { InstallerContext } from './types.js'
import fs from 'fs-extra'
import * as path from 'path'

export async function setupNotificationSound(ctx: InstallerContext): Promise<void> {
  const srcDir = path.join(ctx.rootDir, 'sounds')
  const targetDir = path.join(ctx.homeDir, '.codex', 'sounds')
  await fs.ensureDir(targetDir)

  const selected = ctx.options.notificationSound
  if (selected === 'none') {
    // Disable sound by clearing DEFAULT_CODEX_SOUND in notify.sh
    const notifyFile = path.join(ctx.homeDir, '.codex', 'notify.sh')
    if (await fs.pathExists(notifyFile)) {
      const txt = await fs.readFile(notifyFile, 'utf8')
      const patched = txt.replace(/^DEFAULT_CODEX_SOUND=.*$/m, 'DEFAULT_CODEX_SOUND=""')
      if (ctx.options.dryRun) ctx.logger.log(`[dry-run] patch ${notifyFile} DEFAULT_CODEX_SOUND -> empty`)
      else if (patched !== txt) await fs.writeFile(notifyFile, patched, 'utf8')
    }
    ctx.logger.ok('Notification sound disabled')
    return
  }

  let src: string | undefined
  if (selected && !path.isAbsolute(selected)) src = path.join(srcDir, selected)
  else if (selected) src = selected
  else if (ctx.options.mode === 'recommended') src = path.join(srcDir, 'noti_1.wav')

  if (!src || !(await fs.pathExists(src))) {
    ctx.logger.warn('No notification sound selected or file missing; skipping sound setup')
    return
  }

  const isAbsolute = path.isAbsolute(src)
  const isRepoSound = src.startsWith(path.join(ctx.rootDir, 'sounds'))
  const dest = (!isAbsolute || isRepoSound) ? path.join(targetDir, path.basename(src)) : src
  if (!isAbsolute || isRepoSound) {
    if (ctx.options.dryRun) ctx.logger.log(`[dry-run] cp ${src} ${dest}`)
    else await fs.copy(src, dest)
  }

  // Patch ~/.codex/notify.sh with the selected sound path
  const notifyFile = path.join(ctx.homeDir, '.codex', 'notify.sh')
  if (await fs.pathExists(notifyFile)) {
    const txt = await fs.readFile(notifyFile, 'utf8')
    const line = `DEFAULT_CODEX_SOUND="${dest}"`
    const patched = txt.replace(/^DEFAULT_CODEX_SOUND=.*$/m, line)
    if (patched !== txt) {
      if (ctx.options.dryRun) ctx.logger.log(`[dry-run] patch ${notifyFile} DEFAULT_CODEX_SOUND -> ${dest}`)
      else await fs.writeFile(notifyFile, patched, 'utf8')
    }
  }
  ctx.logger.ok('Notification sound configured')
}