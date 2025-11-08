import { defineCommand } from 'citty'
import { $ } from 'zx'
import { fileURLToPath } from 'url'
import { accessSync } from 'fs'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
function findRoot(){
  const a = resolve(__dirname, '../../');
  const b = resolve(__dirname, '../../..');
  try { accessSync(resolve(a, 'templates')); return a } catch(e) {}
  try { accessSync(resolve(b, 'templates')); return b } catch(e) {}
  return b
}
const repoRoot = findRoot()

export const uninstallCommand = defineCommand({
  meta: { name: 'uninstall', description: 'Clean up aliases and config created by this tool' },
  async run() {
    await $`bash ${resolve(repoRoot, 'scripts/uninstall.sh')}`
  }
})
