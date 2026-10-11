/**
 * Local AIPM project initialization.
 *
 * Callers provide a name, type, objective, and an absolute root directory.
 * The operation creates the standard stage sub-directories, the asset library
 * directory, and the `aipm.json` manifest.  Existing directories are left
 * intact.  A pre-existing manifest — whether valid, corrupted, or an
 * unrecognized version — causes the call to throw rather than overwrite.
 * @module
 */

import { readFile } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AIPMCreateProjectOptions, AIPMInitResult, AIPMProjectManifest, AIPMStageRecord } from './types.ts'
import {
  AIPM_ASSETS_DIR,
  AIPM_INITIATION_GATE_TEMPLATES,
  AIPM_MANIFEST_FILE,
  AIPM_PENDING_DIR,
  AIPM_PROJECT_SKILLS_DIR,
  AIPM_PROJECT_TYPES,
  AIPM_STAGE_TEMPLATES,
} from './stages.ts'
import { writeAIPMManifest } from './manifest.ts'
import { ensureDir, errorMessage, isNodeError } from './fs-util.ts'

export { readAIPMManifest, updateAIPMStage, writeAIPMManifest } from './manifest.ts'

/**
 * Initialize a new AIPM project at the given root directory.
 *
 * The operation is idempotent at the directory level: existing directories are
 * recorded in `existingDirs` and not modified.  Any pre-existing `aipm.json`
 * — including a corrupted or unrecognized-version file — causes the call to
 * throw to protect the user from accidental overwrites.
 *
 * @param options - project name, type, objective, and absolute root path.
 * @returns the project ID, manifest path, and directory creation results.
 * @throws if `rootDir` is not an absolute path.
 * @throws if `name` or `objective` is empty or whitespace-only after trimming.
 * @throws if `type` is not an accepted project type.
 * @throws if `rootDir` already contains an `aipm.json` file (any state).
 * @throws if a required directory cannot be created due to a filesystem error.
 */
export async function initAIPMProject(options: AIPMCreateProjectOptions): Promise<AIPMInitResult> {
  validateCreateOptions(options)

  const { name, type, objective, rootDir } = options
  const manifestPath = join(rootDir, AIPM_MANIFEST_FILE)

  await guardExistingManifest(manifestPath)

  const createdDirs: string[] = []
  const existingDirs: string[] = []

  await ensureDir(rootDir, createdDirs, existingDirs)
  await ensureDir(join(rootDir, AIPM_ASSETS_DIR), createdDirs, existingDirs)
  await ensureDir(join(rootDir, AIPM_PENDING_DIR), createdDirs, existingDirs)
  await ensureDir(join(rootDir, AIPM_PROJECT_SKILLS_DIR), createdDirs, existingDirs)

  for (const template of AIPM_STAGE_TEMPLATES) {
    await ensureDir(join(rootDir, template.dirName), createdDirs, existingDirs)
  }

  const projectId = randomUUID()
  const now = new Date().toISOString()

  const stages: AIPMStageRecord[] = AIPM_STAGE_TEMPLATES.map(template => ({
    ...template,
    status: 'not-started' as const,
  }))

  const manifest: AIPMProjectManifest = {
    version: 1,
    id: projectId,
    name: name.trim(),
    type,
    objective: objective.trim(),
    rootDir,
    createdAt: now,
    updatedAt: now,
    stages,
    assets: [],
    skills: [],
    initiationGates: AIPM_INITIATION_GATE_TEMPLATES.map(gate => ({ ...gate })),
  }

  await writeAIPMManifest(manifest)

  return { projectId, manifestPath, createdDirs, existingDirs }
}

/**
 * Validate caller-supplied creation options before touching the filesystem.
 * @param options - options to validate.
 * @throws for an invalid rootDir, empty name, empty objective, or unknown type.
 */
function validateCreateOptions(options: AIPMCreateProjectOptions): void {
  if (!isAbsolute(options.rootDir)) {
    throw new Error(`rootDir must be an absolute path, got: "${options.rootDir}"`)
  }
  if (options.name.trim().length === 0) {
    throw new Error('name must not be empty or whitespace-only')
  }
  if (options.objective.trim().length === 0) {
    throw new Error('objective must not be empty or whitespace-only')
  }
  if (!AIPM_PROJECT_TYPES.has(options.type)) {
    throw new Error(`type "${options.type}" is not one of the accepted project types`)
  }
}

/**
 * Throw if any `aipm.json` file exists at `manifestPath`, regardless of
 * whether it is a valid manifest.  An absent file is the only safe case
 * for proceeding with initialization.
 *
 * @param manifestPath - absolute path to the manifest file.
 * @throws for any case other than ENOENT.
 */
async function guardExistingManifest(manifestPath: string): Promise<void> {
  let raw: string
  try {
    raw = await readFile(manifestPath, 'utf8')
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return
    throw new Error(
      `Cannot read "${manifestPath}" to check for an existing project: ${errorMessage(err)}`,
    )
  }

  let parsed: unknown
  let version: unknown = '(parse failed)'
  try {
    parsed = JSON.parse(raw)
    version = (parsed as Record<string, unknown>)['version'] ?? '(missing)'
  } catch {
    throw new Error(
      `"${manifestPath}" exists but is not valid JSON. ` +
      'Remove or repair the file before re-initializing.',
    )
  }

  const id: unknown = (parsed as Record<string, unknown>)['id']
  const idSuffix = typeof id === 'string' && id.length > 0 ? ` (id: ${id})` : ''
  const versionNote = version === 1
    ? `version ${String(version)} — use readAIPMManifest() to open it`
    : `unrecognized version "${String(version)}" — remove or repair the file`
  throw new Error(
    `"${manifestPath}" already exists${idSuffix}: ${versionNote}. ` +
    'Re-initialization is not permitted.',
  )
}
