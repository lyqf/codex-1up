import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import { listBundledSkills as listBundledSkillsImpl, type BundledSkill } from '../installers/skills.js'
import { maybeInstallSkills } from '../installers/maybeInstallSkills.js'
import { createActionContext } from './context.js'

export interface InstalledSkill {
  id: string
  path: string
}

export type { BundledSkill }

export async function listBundledSkills(rootDir: string): Promise<BundledSkill[]> {
  return listBundledSkillsImpl(rootDir)
}

export const listBundled = listBundledSkills

export async function listInstalled(): Promise<InstalledSkill[]> {
  const skillsDir = path.join(os.homedir(), '.codex', 'skills')
  const dirents = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => [])
  return dirents
    .filter(de => de.isDirectory())
    .map(de => ({ id: de.name, path: path.join(skillsDir, de.name) }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export async function installSkills(
  mode: 'all' | 'select',
  selected: string[] | undefined,
  opts: { dryRun?: boolean } = {}
): Promise<void> {
  const ctx = await createActionContext({
    skills: mode,
    skillsSelected: selected,
    dryRun: Boolean(opts.dryRun)
  })
  await maybeInstallSkills(ctx)
}
