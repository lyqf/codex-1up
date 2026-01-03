import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { listInstalled } from '../src/actions/skills'

let tempHome = ''
let skillsDir = ''

beforeAll(async () => {
  tempHome = await mkdtemp(join(tmpdir(), 'codex-1up-home-'))
  process.env.HOME = tempHome
  process.env.USERPROFILE = tempHome
  skillsDir = join(tempHome, '.codex', 'skills')
  await mkdir(skillsDir, { recursive: true })
})

afterAll(async () => {
  try { await rm(tempHome, { recursive: true, force: true }) } catch {}
})

describe('skills actions', () => {
  it('lists installed skills', async () => {
    const skillPath = join(skillsDir, 'sample-skill')
    await mkdir(skillPath, { recursive: true })
    await writeFile(join(skillPath, 'SKILL.md'), '# test\n', 'utf8')

    const installed = await listInstalled()
    expect(installed.find(s => s.id === 'sample-skill')).toBeTruthy()
  })
})
