import { defineCommand } from 'citty'
import { promises as fs } from 'fs'
import { accessSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
function findRoot() {
  let cur = __dirname
  for (let i = 0; i < 6; i++) {
    try { accessSync(resolve(cur, 'templates', 'codex-config.toml')); return cur } catch {}
    cur = resolve(cur, '..')
  }
  return resolve(__dirname, '..')
}
const repoRoot = findRoot()

async function pathExists(p: string) {
  try { await fs.access(p); return true } catch { return false }
}

async function copyFileWithBackup(src: string, dest: string) {
  const exists = await pathExists(dest)
  if (exists) {
    const backup = `${dest}.backup.${new Date().toISOString().replace(/[:.]/g, '').replace('T','_').slice(0,15)}`
    await fs.copyFile(dest, backup)
  }
  await fs.mkdir(dirname(dest), { recursive: true })
  await fs.copyFile(src, dest)
}

export const agentsCommand = defineCommand({
  meta: { name: 'agents', description: 'Write an AGENTS.md template' },
  args: {
    path: { type: 'string', required: true, description: 'Target repo path or file' }
  },
  async run({ args }) {
    const target = String(args.path)
    const src = resolve(repoRoot, 'templates/agent-templates', 'AGENTS-default.md')
    const isDir = await pathExists(target).then(async ok => ok && (await fs.stat(target)).isDirectory()).catch(() => false)
    const dest = isDir ? resolve(target, 'AGENTS.md') : target

    if (!(await pathExists(src))) throw new Error(`Template not found: ${src}`)
    await copyFileWithBackup(src, dest)
    process.stdout.write(`Wrote ${dest}\n`)
  }
})
