import { defineCommand } from 'citty'
import { $ } from 'zx'
import { fileURLToPath } from 'url'
import { accessSync } from 'fs'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
function findRoot(){
  let cur = __dirname
  for (let i=0;i<6;i++){
    try { accessSync(resolve(cur,'templates','codex-config.toml')); return cur } catch {}
    cur = resolve(cur,'..')
  }
  return resolve(__dirname,'..')
}
const repoRoot = findRoot()

export const uninstallCommand = defineCommand({
  meta: { name: 'uninstall', description: 'Clean up aliases and config created by this tool' },
  async run() {
    await $`bash ${resolve(repoRoot, 'scripts/uninstall.sh')}`
  }
})
