import type { InstallerContext } from './types.js'
import fs from 'fs-extra'
import * as path from 'path'

export async function setupNotificationSound(ctx: InstallerContext): Promise<void> {
  const srcDir = path.join(ctx.rootDir, 'sounds')
  const targetDir = path.join(ctx.homeDir, '.codex', 'sounds')
  await fs.ensureDir(targetDir)

  const selected = ctx.options.notificationSound
  if (selected === 'none') {
    const rcFile = await detectRcFile(ctx)
    const block = `# Notification sound (disabled)\nexport CODEX_DISABLE_SOUND=1\nexport CODEX_CUSTOM_SOUND=""\n`
    if (ctx.options.dryRun) ctx.logger.log(`[dry-run] update ${rcFile}`)
    else await upsertRcBlock(rcFile, block, ctx)
    // Also clear default in notify.sh for immediate effect
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

  const rcFile = await detectRcFile(ctx)
  const block = `# Notification sound\nexport CODEX_DISABLE_SOUND=0\nexport CODEX_CUSTOM_SOUND="${dest}"\n`
  if (ctx.options.dryRun) ctx.logger.log(`[dry-run] update ${rcFile}`)
  else await upsertRcBlock(rcFile, block, ctx)
  ctx.logger.ok('Notification sound configured. Open a new shell or source your rc to apply.')

  // Also patch ~/.codex/notify.sh default path so preview works even before sourcing rc
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
}

async function detectRcFile(ctx: InstallerContext): Promise<string> {
  const shell = ctx.options.shell || process.env.SHELL || ''
  let target = 'auto'

  if (target === 'auto') {
    if (shell.includes('zsh')) target = 'zsh'
    else if (shell.includes('fish')) target = 'fish'
    else target = 'bash'
  }

  switch (target) {
    case 'zsh':
      return path.join(ctx.homeDir, '.zshrc')
    case 'fish':
      return path.join(ctx.homeDir, '.config', 'fish', 'config.fish')
    default:
      return path.join(ctx.homeDir, '.bashrc')
  }
}

async function upsertRcBlock(rcFile: string, content: string, ctx: InstallerContext): Promise<void> {
  const PROJECT = 'codex-1up'
  await fs.ensureDir(path.dirname(rcFile))

  let existing = ''
  if (await fs.pathExists(rcFile)) {
    existing = await fs.readFile(rcFile, 'utf8')
    // Remove existing block
    const startMarker = `>>> ${PROJECT} >>>`
    const endMarker = `<<< ${PROJECT} <<<`
    const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\n?`, 'g')
    existing = existing.replace(regex, '')
  }

  const block = `>>> ${PROJECT} >>>\n${content}<<< ${PROJECT} <<<\n`
  await fs.writeFile(rcFile, existing + block, 'utf8')
}
