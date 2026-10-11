/**
 * Bundled AIPM skill provider.
 *
 * Reads every `skills/<name>/SKILL.md` directory from the package installation
 * root (resolved relative to this module via `import.meta.url`) and returns
 * skill registrations ready for `ctx.skills.register()`. File reading uses
 * the synchronous `readFileSync` so registration can run from a synchronous
 * Cordis `apply()`.
 *
 * Each skill's resource base is the bundled directory so the model can
 * resolve relative files such as `methodology.md` or `references/`.
 * @module
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type { AIPMStageId } from './types.ts'

/** One shipped skill as catalog metadata plus its on-disk directory. */
export interface BundledAIPMSkillMeta {
  readonly name: string
  readonly description: string
  readonly recommendedStage: AIPMStageId
  readonly dir: string
  readonly content: string
}

const STAGE_BY_NAME: Readonly<Record<string, AIPMStageId>> = {
  'mrd-writing': 'market-user-research',
  'brd-writing': 'brd',
  'project-initiation-report': 'project-initiation',
  'prd-writing': 'prd',
  'design-spec': 'design-handoff',
  'prompt-optimizer-ai-pm': 'prd',
  'pm-doc-writer': 'prd',
  'competitive-analysis': 'market-user-research',
}

/**
 * Resolve the package-local `skills/` directory.
 * Compiled output lives in `lib/`, so this walks one level up.
 */
function resolveSkillsRoot(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url))
  return join(moduleDir, '..', 'skills')
}

function parseFrontmatter(raw: string): { name: string; description: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw)
  if (match === null || match[1] === undefined) {
    return { name: '', description: '', body: raw.trim() }
  }
  const yaml = match[1]
  return {
    name: scalarField(yaml, 'name'),
    description: scalarField(yaml, 'description'),
    body: raw.slice(match[0].length).trim(),
  }
}

function scalarField(yaml: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(yaml)
  if (match === null || match[1] === undefined) return ''
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

/**
 * Read every bundled skill directory that contains a `SKILL.md`.
 * @returns catalog rows sorted by skill name.
 */
export function listBundledAIPMSkills(): readonly BundledAIPMSkillMeta[] {
  const root = resolveSkillsRoot()
  const names = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right))
  const skills: BundledAIPMSkillMeta[] = []
  for (const name of names) {
    const dir = join(root, name)
    const skillFile = join(dir, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    const parsed = parseFrontmatter(readFileSync(skillFile, 'utf8'))
    const skillName = parsed.name.length > 0 ? parsed.name : name
    skills.push({
      name: skillName,
      description: parsed.description.length > 0 ? parsed.description : skillName,
      recommendedStage: STAGE_BY_NAME[skillName] ?? 'prd',
      dir,
      content: parsed.body,
    })
  }
  return skills
}

/**
 * Build one `SkillRegistration` from a bundled skill directory.
 * @param skill - catalog row produced by {@link listBundledAIPMSkills}.
 * @returns a registration ready for `ctx.skills.register()`.
 */
export function buildBundledSkillRegistration(skill: BundledAIPMSkillMeta): SkillRegistration {
  return {
    name: skill.name,
    description: skill.description,
    whenToUse: skill.description,
    content: skill.content,
    source: 'bundled',
    path: join(skill.dir, 'SKILL.md'),
    resourceBase: { kind: 'directory', path: skill.dir },
    invocation: { modelInvocable: true, userInvocable: true },
    provider: 'aipm-builtin',
  }
}

/**
 * Build registrations for every shipped AIPM skill.
 * @returns registrations in name order.
 */
export function buildAllBundledSkillRegistrations(): SkillRegistration[] {
  return listBundledAIPMSkills().map(buildBundledSkillRegistration)
}

/**
 * Build the `SkillRegistration` for the bundled `project-initiation-report`
 * skill. Kept for existing tests and named imports.
 * @returns a complete `SkillRegistration` ready for `ctx.skills.register()`.
 */
export function buildProjectInitiationReportRegistration(): SkillRegistration {
  const skill = listBundledAIPMSkills().find(item => item.name === 'project-initiation-report')
  if (skill === undefined) {
    throw new Error('bundled skill project-initiation-report is missing')
  }
  return buildBundledSkillRegistration(skill)
}
