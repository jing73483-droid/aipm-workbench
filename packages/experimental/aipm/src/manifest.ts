/**
 * Read, validate, and write AIPM project manifests.
 * @module
 */

import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import {
  AIPM_ASSET_SOURCE_KINDS,
  AIPM_INITIATION_GATE_TEMPLATES,
  AIPM_MANIFEST_FILE,
  AIPM_PROJECT_TYPES,
  AIPM_SKILL_SCOPES,
  AIPM_SKILL_SOURCE_KINDS,
  AIPM_STAGE_COUNT,
  AIPM_STAGE_TEMPLATES,
  AIPM_STATUSES,
  isInitiationGateId,
} from './stages.ts'
import type {
  AIPMInitiationGateRecord,
  AIPMProjectManifest,
  AIPMSkillInstallation,
  AIPMStageId,
  AIPMStatus,
} from './types.ts'
import { errorMessage } from './fs-util.ts'

/**
 * Read and fully validate an existing AIPM project manifest from disk.
 *
 * Missing `skills` and `initiationGates` arrays are normalized to empty and
 * the default gate set respectively so version-1 files written by older
 * callers remain readable.
 *
 * @param rootDir - absolute path to the project root directory.
 * @returns the parsed and validated manifest.
 * @throws if the manifest is absent, unreadable, not valid JSON, or fails validation.
 */
export async function readAIPMManifest(rootDir: string): Promise<AIPMProjectManifest> {
  const manifestPath = join(rootDir, AIPM_MANIFEST_FILE)
  let raw: string
  try {
    raw = await readFile(manifestPath, 'utf8')
  } catch (err) {
    throw new Error(`Cannot read AIPM manifest at "${manifestPath}": ${errorMessage(err)}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`AIPM manifest at "${manifestPath}" is not valid JSON: ${errorMessage(err)}`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`AIPM manifest at "${manifestPath}" must be a JSON object`)
  }
  return normalizeManifest(parsed as Record<string, unknown>, manifestPath)
}

/**
 * Write `manifest` to `aipm.json` under `manifest.rootDir`.
 * Updates `updatedAt` to the current time.
 *
 * @param manifest - validated manifest to persist.
 * @returns the written manifest including the new `updatedAt`.
 */
export async function writeAIPMManifest(manifest: AIPMProjectManifest): Promise<AIPMProjectManifest> {
  const next: AIPMProjectManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
  }
  const manifestPath = join(manifest.rootDir, AIPM_MANIFEST_FILE)
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

/**
 * Update one stage's status and optional notes.
 *
 * @param rootDir - absolute project root.
 * @param stageId - stage to update.
 * @param patch - fields to replace.
 * @returns the written manifest.
 * @throws if the stage id is not in the pipeline.
 */
export async function updateAIPMStage(
  rootDir: string,
  stageId: AIPMStageId,
  patch: { readonly status?: AIPMStatus; readonly notes?: string },
): Promise<AIPMProjectManifest> {
  const manifest = await readAIPMManifest(rootDir)
  const current = manifest.stages.find(stage => stage.id === stageId)
  if (current === undefined) {
    throw new Error(`Unknown AIPM stage "${stageId}"`)
  }
  const stages = manifest.stages.map(stage => {
    if (stage.id !== stageId) return stage
    const notes = patch.notes ?? stage.notes
    return {
      ...stage,
      status: patch.status ?? stage.status,
      ...(notes === undefined ? {} : { notes }),
    }
  })
  return writeAIPMManifest({ ...manifest, stages })
}

/**
 * Normalize a parsed JSON object into a validated {@link AIPMProjectManifest}.
 * @param obj - parsed JSON object.
 * @param manifestPath - used only in error messages.
 * @returns the validated manifest.
 */
export function normalizeManifest(obj: Record<string, unknown>, manifestPath: string): AIPMProjectManifest {
  function fail(msg: string): never {
    throw new Error(`AIPM manifest at "${manifestPath}" is invalid: ${msg}`)
  }

  if (obj['version'] !== 1) {
    fail(`unsupported version "${String(obj['version'])}"`)
  }
  if (typeof obj['id'] !== 'string' || obj['id'].length === 0) {
    fail('id must be a non-empty string')
  }
  if (typeof obj['name'] !== 'string' || obj['name'].length === 0) {
    fail('name must be a non-empty string')
  }
  if (typeof obj['type'] !== 'string' || !AIPM_PROJECT_TYPES.has(obj['type'])) {
    fail(`type "${String(obj['type'])}" is not one of the accepted project types`)
  }
  if (typeof obj['objective'] !== 'string' || obj['objective'].length === 0) {
    fail('objective must be a non-empty string')
  }
  if (typeof obj['rootDir'] !== 'string' || !isAbsolute(obj['rootDir'])) {
    fail('rootDir must be a non-empty absolute path')
  }
  if (typeof obj['createdAt'] !== 'string' || obj['createdAt'].length === 0) {
    fail('createdAt must be a non-empty string')
  }
  if (typeof obj['updatedAt'] !== 'string' || obj['updatedAt'].length === 0) {
    fail('updatedAt must be a non-empty string')
  }

  if (!Array.isArray(obj['stages'])) {
    fail('stages must be an array')
  }
  const stages = obj['stages'] as unknown[]
  if (stages.length !== AIPM_STAGE_COUNT) {
    fail(`stages must contain exactly ${AIPM_STAGE_COUNT} entries, found ${stages.length}`)
  }
  const knownStageIds = new Set(AIPM_STAGE_TEMPLATES.map(stage => stage.id))
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    if (typeof stage !== 'object' || stage === null || Array.isArray(stage)) {
      fail(`stages[${i}] must be an object`)
    }
    const s = stage as Record<string, unknown>
    if (typeof s['id'] !== 'string' || !knownStageIds.has(s['id'] as AIPMStageId)) {
      fail(`stages[${i}].id must be a known stage identifier`)
    }
    if (typeof s['order'] !== 'number' || !Number.isInteger(s['order'])) fail(`stages[${i}].order must be an integer`)
    if (typeof s['dirName'] !== 'string' || s['dirName'].length === 0) fail(`stages[${i}].dirName must be a non-empty string`)
    if (typeof s['name'] !== 'string' || s['name'].length === 0) fail(`stages[${i}].name must be a non-empty string`)
    if (typeof s['nameEn'] !== 'string' || s['nameEn'].length === 0) fail(`stages[${i}].nameEn must be a non-empty string`)
    if (typeof s['status'] !== 'string' || !AIPM_STATUSES.has(s['status'])) {
      fail(`stages[${i}].status "${String(s['status'])}" is not a valid status`)
    }
  }

  if (!Array.isArray(obj['assets'])) {
    fail('assets must be an array')
  }
  const assets = obj['assets'] as unknown[]
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    if (typeof asset !== 'object' || asset === null || Array.isArray(asset)) {
      fail(`assets[${i}] must be an object`)
    }
    const a = asset as Record<string, unknown>
    if (typeof a['id'] !== 'string' || a['id'].length === 0) fail(`assets[${i}].id must be a non-empty string`)
    if (typeof a['name'] !== 'string' || a['name'].length === 0) fail(`assets[${i}].name must be a non-empty string`)
    if (typeof a['sourceKind'] !== 'string' || !AIPM_ASSET_SOURCE_KINDS.has(a['sourceKind'])) {
      fail(`assets[${i}].sourceKind "${String(a['sourceKind'])}" is not valid`)
    }
    if (typeof a['importedAt'] !== 'string' || a['importedAt'].length === 0) {
      fail(`assets[${i}].importedAt must be a non-empty string`)
    }
    if (!Array.isArray(a['refs'])) {
      fail(`assets[${i}].refs must be an array`)
    }
  }

  const skills = normalizeSkills(obj['skills'], fail)
  const initiationGates = normalizeGates(obj['initiationGates'], fail)

  return {
    version: 1,
    id: obj['id'] as string,
    name: obj['name'] as string,
    type: obj['type'] as AIPMProjectManifest['type'],
    objective: obj['objective'] as string,
    rootDir: obj['rootDir'] as string,
    createdAt: obj['createdAt'] as string,
    updatedAt: obj['updatedAt'] as string,
    stages: stages as AIPMProjectManifest['stages'],
    assets: assets as AIPMProjectManifest['assets'],
    skills,
    initiationGates,
  }
}

function normalizeSkills(
  value: unknown,
  fail: (msg: string) => never,
): readonly AIPMSkillInstallation[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) fail('skills must be an array')
  for (let i = 0; i < value.length; i++) {
    const skill = value[i]
    if (typeof skill !== 'object' || skill === null || Array.isArray(skill)) {
      fail(`skills[${i}] must be an object`)
    }
    const s = skill as Record<string, unknown>
    if (typeof s['id'] !== 'string' || s['id'].length === 0) fail(`skills[${i}].id must be a non-empty string`)
    if (typeof s['name'] !== 'string' || s['name'].length === 0) fail(`skills[${i}].name must be a non-empty string`)
    if (typeof s['sourceKind'] !== 'string' || !AIPM_SKILL_SOURCE_KINDS.has(s['sourceKind'])) {
      fail(`skills[${i}].sourceKind is not valid`)
    }
    if (typeof s['source'] !== 'string' || s['source'].length === 0) fail(`skills[${i}].source must be a non-empty string`)
    if (typeof s['scope'] !== 'string' || !AIPM_SKILL_SCOPES.has(s['scope'])) fail(`skills[${i}].scope is not valid`)
    if (typeof s['installedAt'] !== 'string' || s['installedAt'].length === 0) {
      fail(`skills[${i}].installedAt must be a non-empty string`)
    }
  }
  return value as AIPMSkillInstallation[]
}

function normalizeGates(
  value: unknown,
  fail: (msg: string) => never,
): readonly AIPMInitiationGateRecord[] {
  if (value === undefined) {
    return AIPM_INITIATION_GATE_TEMPLATES.map(gate => ({ ...gate }))
  }
  if (!Array.isArray(value)) fail('initiationGates must be an array')
  if (value.length !== AIPM_INITIATION_GATE_TEMPLATES.length) {
    fail(`initiationGates must contain exactly ${AIPM_INITIATION_GATE_TEMPLATES.length} entries`)
  }
  for (let i = 0; i < value.length; i++) {
    const gate = value[i]
    if (typeof gate !== 'object' || gate === null || Array.isArray(gate)) {
      fail(`initiationGates[${i}] must be an object`)
    }
    const g = gate as Record<string, unknown>
    if (typeof g['id'] !== 'string' || !isInitiationGateId(g['id'])) {
      fail(`initiationGates[${i}].id is not a known gate`)
    }
    if (typeof g['status'] !== 'string' || !AIPM_STATUSES.has(g['status'])) {
      fail(`initiationGates[${i}].status is not valid`)
    }
  }
  return value as AIPMInitiationGateRecord[]
}
