import { defineCommand } from 'citty'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installCommand } from './commands/install.js'
import { agentsCommand } from './commands/agents.js'
import { doctorCommand } from './commands/doctor.js'
import { uninstallCommand } from './commands/uninstall.js'
import { configCommand } from './commands/config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
)

export const root = defineCommand({
  meta: {
    name: 'codex-1up',
    version: packageJson.version,
    description: 'Power up Codex CLI with clean profiles config and helpers'
  },
  subCommands: {
    install: installCommand,
    agents: agentsCommand,
    doctor: doctorCommand,
    uninstall: uninstallCommand,
    config: configCommand
  }
})
