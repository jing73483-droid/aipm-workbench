/**
 * Builtin catalog, local skill installation, and stage recommendation.
 *
 * Git URLs are rejected with an explicit not-implemented error.
 * @module
 */

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AIPMInstallSkillOptions,
  AIPMInstallSkillResult,
  AIPMSkillInstallation,
  AIPMSkillPermissions,
  AIPMStageId,
} from './types.ts'
import { AIPM_PROJECT_SKILLS_DIR } from './stages.ts'
import { readAIPMManifest, writeAIPMManifest } from './manifest.ts'
import { errorMessage, isNodeError } from './fs-util.ts'
import { listBundledAIPMSkills } from './skill-bundle.ts'

const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const GLOBAL_SKILLS_FILE = 'aipm-skills.json'

/** One builtin skill shipped with this package. */
export interface AIPMBuiltinSkill {
  readonly name: string
  readonly description: string
  readonly recommendedStage: AIPMStageId
}

/**
 * Return the builtin skill catalog. Git and third-party skills are not listed.
 * @returns the shipped skills.
 */
export function listBuiltinAIPMSkills(): readonly AIPMBuiltinSkill[] {
  return listBundledAIPMSkills().map(skill => ({
    name: skill.name,
    description: skill.description,
    recommendedStage: skill.recommendedStage,
  }))
}

/**
 * Recommend pipeline stages from a skill name and description.
 * The result stays unconfirmed until {@link confirmAIPMSkillStages} runs.
 *
 * @param name - skill name.
 * @param description - skill description or body excerpt.
 * @returns zero or more stage identifiers, most specific first.
 */
export function recommendAIPMSkillStages(name: string, description: string): readonly AIPMStageId[] {
  const haystack = `${name} ${description}`.toLowerCase()
  const hits: AIPMStageId[] = []
  for (const rule of STAGE_KEYWORD_RULES) {
    if (rule.keywords.some(keyword => haystack.includes(keyword)) && !hits.includes(rule.stage)) {
      hits.push(rule.stage)
    }
  }
  return hits
}

/**
 * Install a builtin or local skill. `sourceKind: 'git'` always throws.
 *
 * Project-scoped installs copy into `<rootDir>/.dsh/skills/<name>/` and append
 * the record to `aipm.json`. Global installs copy into `$DSH_HOME/skills` or
 * `~/.dsh/skills` and append `aipm-skills.json` beside that root.
 *
 * @param options - install request.
 * @returns the installation record and destination directory.
 */
export async function installAIPMSkill(options: AIPMInstallSkillOptions): Promise<AIPMInstallSkillResult> {
  if (options.sourceKind === 'git') {
    throw new Error('Git skill installation is not implemented in this version')
  }
  if (options.sourceKind === 'builtin') {
    return installBuiltin(options)
  }
  return installLocal(options)
}

/**
 * Persist the user-confirmed stage binding for an installed skill.
 *
 * @param rootDir - project root for project-scoped records; ignored for global.
 * @param installationId - installation id.
 * @param stages - confirmed stage identifiers.
 * @param scope - which catalog to update.
 * @param globalRoot - optional global skills root override.
 * @returns the updated installation record.
 */
export async function confirmAIPMSkillStages(
  rootDir: string,
  installationId: string,
  stages: readonly AIPMStageId[],
  scope: AIPMSkillInstallation['scope'] = 'project',
  globalRoot?: string,
): Promise<AIPMSkillInstallation> {
  if (scope === 'global') {
    const root = resolveGlobalRoot(globalRoot)
    const records = await readGlobalSkills(root)
    const updated = replaceInstallation(records, installationId, stages)
    await writeGlobalSkills(root, updated.list)
    return updated.record
  }
  const manifest = await readAIPMManifest(rootDir)
  const updated = replaceInstallation(manifest.skills, installationId, stages)
  await writeAIPMManifest({ ...manifest, skills: updated.list })
  return updated.record
}

/**
 * Parse `name` and `description` from a SKILL.md YAML frontmatter block.
 * @param raw - file contents.
 * @returns parsed identifiers; missing fields are empty strings.
 */
export function parseSkillFrontmatter(raw: string): { name: string; description: string; body: string } {
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

async function installBuiltin(options: AIPMInstallSkillOptions): Promise<AIPMInstallSkillResult> {
  const builtin = listBuiltinAIPMSkills().find(skill => skill.name === options.source)
  if (builtin === undefined) {
    throw new Error(`Unknown builtin skill "${options.source}"`)
  }
  const installation = buildInstallation({
    name: builtin.name,
    sourceKind: 'builtin',
    source: '@deepseek-ai/dsh-experimental-aipm',
    scope: options.scope,
    description: builtin.description,
  })
  await persistInstallation(options, installation)
  return { installation }
}

async function installLocal(options: AIPMInstallSkillOptions): Promise<AIPMInstallSkillResult> {
  if (!isAbsolute(options.source)) {
    throw new Error(`local skill source must be an absolute path, got: "${options.source}"`)
  }
  const skillDir = await resolveSkillDir(options.source)
  const raw = await readFile(join(skillDir, 'SKILL.md'), 'utf8')
  const parsed = parseSkillFrontmatter(raw)
  const name = parsed.name.length > 0 ? parsed.name : basename(skillDir)
  if (!SKILL_NAME_RE.test(name)) {
    throw new Error(`skill name "${name}" is not kebab-case`)
  }
  const destRoot = options.scope === 'global'
    ? resolveGlobalRoot(options.globalRoot)
    : join(requireProjectRoot(options), AIPM_PROJECT_SKILLS_DIR)
  const installedDir = join(destRoot, name)
  await mkdir(destRoot, { recursive: true })
  await cp(skillDir, installedDir, { recursive: true })
  const installation = buildInstallation({
    name,
    sourceKind: 'local',
    source: options.source,
    scope: options.scope,
    description: parsed.description,
  })
  await persistInstallation(options, installation)
  return { installation, installedDir }
}

async function resolveSkillDir(source: string): Promise<string> {
  if (basename(source) === 'SKILL.md') return dirname(source)
  try {
    await readFile(join(source, 'SKILL.md'), 'utf8')
    return source
  } catch (err) {
    throw new Error(`Cannot read SKILL.md under "${source}": ${errorMessage(err)}`)
  }
}

function buildInstallation(input: {
  name: string
  sourceKind: AIPMSkillInstallation['sourceKind']
  source: string
  scope: AIPMSkillInstallation['scope']
  description: string
}): AIPMSkillInstallation {
  return {
    id: randomUUID(),
    name: input.name,
    sourceKind: input.sourceKind,
    source: input.source,
    scope: input.scope,
    permissions: inferPermissions(input.description),
    recommendedStages: recommendAIPMSkillStages(input.name, input.description),
    recommendationsConfirmed: false,
    installedAt: new Date().toISOString(),
  }
}

async function persistInstallation(
  options: AIPMInstallSkillOptions,
  installation: AIPMSkillInstallation,
): Promise<void> {
  if (options.scope === 'global') {
    const root = resolveGlobalRoot(options.globalRoot)
    const records = await readGlobalSkills(root)
    await writeGlobalSkills(root, [...records, installation])
    return
  }
  const manifest = await readAIPMManifest(requireProjectRoot(options))
  await writeAIPMManifest({ ...manifest, skills: [...manifest.skills, installation] })
}

function requireProjectRoot(options: AIPMInstallSkillOptions): string {
  if (options.rootDir === undefined || !isAbsolute(options.rootDir)) {
    throw new Error('project-scoped skill installation requires an absolute rootDir')
  }
  return options.rootDir
}

function resolveGlobalRoot(override: string | undefined): string {
  if (override !== undefined) {
    if (!isAbsolute(override)) throw new Error('globalRoot must be an absolute path')
    return override
  }
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home.length > 0) return join(home, 'skills')
  throw new Error('global skill install requires globalRoot or DSH_HOME')
}

async function readGlobalSkills(globalRoot: string): Promise<AIPMSkillInstallation[]> {
  const path = join(dirname(globalRoot), GLOBAL_SKILLS_FILE)
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return []
    throw new Error(`Cannot read global AIPM skill catalog: ${errorMessage(err)}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`Global AIPM skill catalog is not valid JSON: ${errorMessage(err)}`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error('global AIPM skill catalog must be a JSON array')
  }
  return parsed as AIPMSkillInstallation[]
}

async function writeGlobalSkills(globalRoot: string, records: readonly AIPMSkillInstallation[]): Promise<void> {
  const dir = dirname(globalRoot)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, GLOBAL_SKILLS_FILE), `${JSON.stringify(records, null, 2)}\n`, 'utf8')
}

function replaceInstallation(
  list: readonly AIPMSkillInstallation[],
  installationId: string,
  stages: readonly AIPMStageId[],
): { list: AIPMSkillInstallation[]; record: AIPMSkillInstallation } {
  const current = list.find(item => item.id === installationId)
  if (current === undefined) {
    throw new Error(`Unknown skill installation "${installationId}"`)
  }
  const record: AIPMSkillInstallation = {
    ...current,
    recommendedStages: stages,
    recommendationsConfirmed: true,
  }
  return {
    list: list.map(item => item.id === installationId ? record : item),
    record,
  }
}

function inferPermissions(description: string): AIPMSkillPermissions {
  const text = description.toLowerCase()
  return {
    readFiles: true,
    writeFiles: /write|edit|保存|写入/.test(text),
    runCommands: /bash|shell|command|终端/.test(text),
    networkAccess: /http|web|fetch|network|飞书|lark/.test(text),
  }
}

function scalarField(yaml: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(yaml)
  if (match === null || match[1] === undefined) return ''
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

const STAGE_KEYWORD_RULES: readonly { stage: AIPMStageId; keywords: readonly string[] }[] = [
  { stage: 'requirement-insight', keywords: ['insight', '洞察', '问题定义'] },
  { stage: 'market-user-research', keywords: ['research', '调研', '用户研究', 'mrd'] },
  { stage: 'brd', keywords: ['brd', '商业需求'] },
  { stage: 'project-initiation', keywords: ['initiation', '立项', '是否值得'] },
  { stage: 'prd', keywords: ['prd', '产品需求'] },
  { stage: 'design-handoff', keywords: ['design', '设计交接', 'design.md'] },
  { stage: 'dev-test-handoff', keywords: ['handoff', '开发交接', '测试验收'] },
  { stage: 'launch-retrospective', keywords: ['retrospective', '复盘', '上线'] },
]
