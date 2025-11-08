import { $ } from 'zx'
import type { InstallerContext, PackageManager } from './types.js'
import { needCmd, detectPackageManager, runCommand } from './utils.js'
import * as path from 'path'
import fs from 'fs-extra'

const PACKAGE_MAP: Record<PackageManager, string[]> = {
  brew: ['fd', 'ripgrep', 'fzf', 'jq', 'yq', 'difftastic'],
  apt: ['ripgrep', 'fzf', 'jq', 'yq', 'git-delta'],
  dnf: ['ripgrep', 'fd-find', 'fzf', 'jq', 'yq', 'git-delta'],
  pacman: ['ripgrep', 'fd', 'fzf', 'jq', 'yq', 'git-delta'],
  zypper: ['ripgrep', 'fd', 'fzf', 'jq', 'yq', 'git-delta'],
  none: []
}

export async function ensureTools(ctx: InstallerContext): Promise<void> {
  const pm = await detectPackageManager()
  ctx.logger.info(`Detected package manager: ${pm}`)

  if (pm === 'none') {
    ctx.logger.warn('Could not detect a supported package manager; please install tools manually')
    return
  }

  const packages = PACKAGE_MAP[pm] || []

  if (packages.length > 0) {
    switch (pm) {
      case 'brew':
        await runCommand('brew', ['update'], {
          dryRun: ctx.options.dryRun,
          logger: ctx.logger
        })
        await runCommand('brew', ['install', ...packages], {
          dryRun: ctx.options.dryRun,
          logger: ctx.logger
        })
        break
      case 'apt':
        await runCommand('sudo', ['apt-get', 'update', '-y'], {
          dryRun: ctx.options.dryRun,
          logger: ctx.logger
        })
        await runCommand('sudo', ['apt-get', 'install', '-y', ...packages], {
          dryRun: ctx.options.dryRun,
          logger: ctx.logger
        }).catch(() => {
          // Some packages might fail, continue
        })
        // Try to install fd-find separately if fd not found
        if (!(await needCmd('fd'))) {
          await runCommand('sudo', ['apt-get', 'install', '-y', 'fd-find'], {
            dryRun: ctx.options.dryRun,
            logger: ctx.logger
          }).catch(() => {})
        }
        break
      case 'dnf':
        await runCommand('sudo', ['dnf', 'install', '-y', ...packages], {
          dryRun: ctx.options.dryRun,
          logger: ctx.logger
        }).catch(() => {})
        break
      case 'pacman':
        await runCommand('sudo', ['pacman', '-Sy', '--noconfirm', ...packages], {
          dryRun: ctx.options.dryRun,
          logger: ctx.logger
        }).catch(() => {})
        break
      case 'zypper':
        await runCommand('sudo', ['zypper', 'refresh'], {
          dryRun: ctx.options.dryRun,
          logger: ctx.logger
        })
        await runCommand('sudo', ['zypper', 'install', '-y', ...packages], {
          dryRun: ctx.options.dryRun,
          logger: ctx.logger
        }).catch(() => {})
        break
    }
  }

  // Try to install difftastic via cargo if not present
  if (!(await needCmd('difft')) && !(await needCmd('difftastic'))) {
    if (await needCmd('cargo')) {
      ctx.logger.info('Installing difftastic via cargo')
      await runCommand('cargo', ['install', 'difftastic'], {
        dryRun: ctx.options.dryRun,
        logger: ctx.logger
      })
    } else {
      ctx.logger.warn('difftastic not found and Rust/cargo missing; falling back to git-delta')
    }
  }

  // Symlink fd on Debian/Ubuntu (fd-find)
  if (await needCmd('fdfind') && !(await needCmd('fd'))) {
    const localBin = path.join(ctx.homeDir, '.local', 'bin')
    await fs.ensureDir(localBin)
    const fdfindPath = (await $`command -v fdfind`).stdout.trim()
    const fdLink = path.join(localBin, 'fd')
    if (!(await fs.pathExists(fdLink))) {
      if (ctx.options.dryRun) {
        ctx.logger.log(`[dry-run] ln -s ${fdfindPath} ${fdLink}`)
      } else {
        await fs.symlink(fdfindPath, fdLink)
      }
      ctx.logger.ok('fd alias created at ~/.local/bin/fd')
    }
  }

  // Show summary
  const tools = ['fd', 'fdfind', 'rg', 'fzf', 'jq', 'yq', 'difft', 'difftastic', 'delta', 'ast-grep']
  for (const tool of tools) {
    if (await needCmd(tool)) {
      ctx.logger.ok(`${tool} ✓`)
    }
  }
}
