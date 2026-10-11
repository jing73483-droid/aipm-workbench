import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initAIPMProject, readAIPMManifest } from '../src/init.ts'
import { AIPM_STAGE_TEMPLATES, AIPM_MANIFEST_FILE, AIPM_ASSETS_DIR } from '../src/stages.ts'
import type { AIPMProjectManifest } from '../src/types.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function makeTempDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'aipm-test-'))
  roots.push(root)
  return root
}

/** Write arbitrary content to a manifest path without validation. */
function writeRaw(dir: string, content: string): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, AIPM_MANIFEST_FILE), content, 'utf8')
}

describe('initAIPMProject — input validation', () => {
  it('throws for a relative rootDir', async () => {
    await expect(
      initAIPMProject({ name: 'X', type: 'feature', objective: 'o', rootDir: 'relative/path' }),
    ).rejects.toThrow(/rootDir must be an absolute path/)
  })

  it('throws for a bare filename rootDir', async () => {
    await expect(
      initAIPMProject({ name: 'X', type: 'feature', objective: 'o', rootDir: 'proj' }),
    ).rejects.toThrow(/rootDir must be an absolute path/)
  })

  it('throws for an empty name', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await expect(
      initAIPMProject({ name: '', type: 'feature', objective: 'o', rootDir }),
    ).rejects.toThrow(/name must not be empty/)
  })

  it('throws for a whitespace-only name', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await expect(
      initAIPMProject({ name: '   ', type: 'feature', objective: 'o', rootDir }),
    ).rejects.toThrow(/name must not be empty/)
  })

  it('throws for an empty objective', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await expect(
      initAIPMProject({ name: 'X', type: 'feature', objective: '', rootDir }),
    ).rejects.toThrow(/objective must not be empty/)
  })

  it('throws for a whitespace-only objective', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await expect(
      initAIPMProject({ name: 'X', type: 'feature', objective: '\t\n', rootDir }),
    ).rejects.toThrow(/objective must not be empty/)
  })

  it('throws for an unknown project type', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await expect(
      initAIPMProject({ name: 'X', type: 'not-a-type' as 'feature', objective: 'o', rootDir }),
    ).rejects.toThrow(/is not one of the accepted project types/)
  })

  it('trims name and objective in the written manifest', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: '  Trimmed  ', type: 'feature', objective: '  obj  ', rootDir })
    const manifest = await readAIPMManifest(rootDir)
    expect(manifest.name).toBe('Trimmed')
    expect(manifest.objective).toBe('obj')
  })
})

describe('initAIPMProject — manifest guard', () => {
  it('throws when the existing manifest path is unreadable', async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, AIPM_MANIFEST_FILE))
    await expect(
      initAIPMProject({ name: 'X', type: 'feature', objective: 'o', rootDir: dir }),
    ).rejects.toThrow(/Cannot read/)
  })

  it('throws for a corrupted (invalid JSON) existing manifest file', async () => {
    const dir = makeTempDir()
    writeRaw(dir, '{ invalid json }}}')
    await expect(
      initAIPMProject({ name: 'X', type: 'feature', objective: 'o', rootDir: dir }),
    ).rejects.toThrow(/not valid JSON/)
  })

  it('throws for an existing manifest with an unrecognized version', async () => {
    const dir = makeTempDir()
    writeRaw(dir, JSON.stringify({ version: 99, id: 'abc', name: 'Old' }))
    await expect(
      initAIPMProject({ name: 'X', type: 'feature', objective: 'o', rootDir: dir }),
    ).rejects.toThrow(/unrecognized version/)
  })

  it('throws for a JSON object missing version and id', async () => {
    const dir = makeTempDir()
    writeRaw(dir, JSON.stringify({ name: 'Old' }))
    await expect(
      initAIPMProject({ name: 'X', type: 'feature', objective: 'o', rootDir: dir }),
    ).rejects.toThrow(/unrecognized version/)
    writeRaw(dir, JSON.stringify({ version: 1, id: '' }))
    await expect(
      initAIPMProject({ name: 'X', type: 'feature', objective: 'o', rootDir: dir }),
    ).rejects.toThrow(/already exists/)
  })

  it('throws for a valid version-1 manifest (already initialized)', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Original', type: 'feature', objective: 'o', rootDir: dir })
    await expect(
      initAIPMProject({ name: 'Duplicate', type: 'feature', objective: 'o', rootDir: dir }),
    ).rejects.toThrow(/already exists/)
  })
})

describe('initAIPMProject — directory creation', () => {
  it('creates the manifest file at the project root', async () => {
    const rootDir = join(makeTempDir(), 'my-project')
    await initAIPMProject({ name: 'Test', type: 'feature', objective: 'Test objective', rootDir })
    expect(existsSync(join(rootDir, AIPM_MANIFEST_FILE))).toBe(true)
  })

  it('writes a manifest with version 1', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    const result = await initAIPMProject({ name: 'V1 Test', type: 'new-product', objective: 'obj', rootDir })
    const raw = readFileSync(result.manifestPath, 'utf8')
    const manifest: AIPMProjectManifest = JSON.parse(raw)
    expect(manifest.version).toBe(1)
  })

  it('writes the correct name, type, and objective', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Widget', type: 'enhancement', objective: 'Make it faster', rootDir })
    const manifest = await readAIPMManifest(rootDir)
    expect(manifest.name).toBe('Widget')
    expect(manifest.type).toBe('enhancement')
    expect(manifest.objective).toBe('Make it faster')
  })

  it('assigns a non-empty UUID project ID', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    const result = await initAIPMProject({ name: 'X', type: 'research', objective: 'o', rootDir })
    expect(result.projectId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('creates all eight stage sub-directories', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Stages', type: 'feature', objective: 'o', rootDir })
    for (const stage of AIPM_STAGE_TEMPLATES) {
      expect(existsSync(join(rootDir, stage.dirName))).toBe(true)
    }
  })

  it('creates the assets directory', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Assets', type: 'feature', objective: 'o', rootDir })
    expect(existsSync(join(rootDir, AIPM_ASSETS_DIR))).toBe(true)
  })

  it('initializes all stages with status not-started', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Statuses', type: 'feature', objective: 'o', rootDir })
    const manifest = await readAIPMManifest(rootDir)
    for (const stage of manifest.stages) {
      expect(stage.status).toBe('not-started')
    }
  })

  it('initializes with an empty assets array', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Empty', type: 'feature', objective: 'o', rootDir })
    const manifest = await readAIPMManifest(rootDir)
    expect(manifest.assets).toStrictEqual([])
  })

  it('returns the manifest path in the result', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    const result = await initAIPMProject({ name: 'Path', type: 'feature', objective: 'o', rootDir })
    expect(result.manifestPath).toBe(join(rootDir, AIPM_MANIFEST_FILE))
  })

  it('records created directories in the result', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    const result = await initAIPMProject({ name: 'Dirs', type: 'feature', objective: 'o', rootDir })
    expect(result.createdDirs.length).toBeGreaterThanOrEqual(10)
    expect(result.existingDirs).toStrictEqual([])
  })

  it('records pre-existing directories in existingDirs', async () => {
    const extraRoot = join(makeTempDir(), 'extra-project')
    mkdirSync(join(extraRoot, '01-requirement-insight'), { recursive: true })
    const result = await initAIPMProject({ name: 'Extra', type: 'feature', objective: 'o', rootDir: extraRoot })
    expect(result.existingDirs).toContain(join(extraRoot, '01-requirement-insight'))
  })
})

describe('readAIPMManifest', () => {
  it('reads back the manifest written by initAIPMProject', async () => {
    const rootDir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'ReadBack', type: 'feature', objective: 'check roundtrip', rootDir })
    const manifest = await readAIPMManifest(rootDir)
    expect(manifest.name).toBe('ReadBack')
    expect(manifest.objective).toBe('check roundtrip')
    expect(manifest.stages).toHaveLength(8)
  })

  it('throws for empty id, name, or objective strings', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Base', type: 'feature', objective: 'o', rootDir: dir })
    const raw = JSON.parse(readFileSync(join(dir, AIPM_MANIFEST_FILE), 'utf8'))
    raw.id = ''
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/id must be a non-empty string/)
    raw.id = 'abc'
    raw.name = ''
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/name must be a non-empty string/)
    raw.name = 'Base'
    raw.objective = ''
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/objective must be a non-empty string/)
  })

  it('throws for a directory with no manifest', async () => {
    const emptyDir = makeTempDir()
    await expect(readAIPMManifest(emptyDir)).rejects.toThrow(/Cannot read AIPM manifest/)
  })

  it('throws for invalid JSON', async () => {
    const dir = makeTempDir()
    writeRaw(dir, '{{bad json')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/not valid JSON/)
  })

  it('throws for unsupported version', async () => {
    const dir = makeTempDir()
    writeRaw(dir, JSON.stringify({ version: 2, id: 'x', name: 'y' }))
    await expect(readAIPMManifest(dir)).rejects.toThrow(/unsupported version/)
  })

  it('throws for invalid type field', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Base', type: 'feature', objective: 'o', rootDir: dir })
    const raw = JSON.parse(readFileSync(join(dir, AIPM_MANIFEST_FILE), 'utf8'))
    raw.type = 'invalid-type'
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/type .* is not one of the accepted/)
  })

  it('throws when stages count is wrong', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Base', type: 'feature', objective: 'o', rootDir: dir })
    const raw = JSON.parse(readFileSync(join(dir, AIPM_MANIFEST_FILE), 'utf8'))
    raw.stages = raw.stages.slice(0, 5)
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/stages must contain exactly 8/)
  })

  it('throws when a stage is missing nameEn', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Base', type: 'feature', objective: 'o', rootDir: dir })
    const raw = JSON.parse(readFileSync(join(dir, AIPM_MANIFEST_FILE), 'utf8'))
    delete raw.stages[0].nameEn
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/nameEn must be a non-empty string/)
  })

  it('throws when a stage has an invalid status', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Base', type: 'feature', objective: 'o', rootDir: dir })
    const raw = JSON.parse(readFileSync(join(dir, AIPM_MANIFEST_FILE), 'utf8'))
    raw.stages[0].status = 'unknown-status'
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/status .* is not a valid status/)
  })

  it('throws when createdAt is missing', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Base', type: 'feature', objective: 'o', rootDir: dir })
    const raw = JSON.parse(readFileSync(join(dir, AIPM_MANIFEST_FILE), 'utf8'))
    delete raw.createdAt
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/createdAt must be a non-empty string/)
  })

  it('throws when updatedAt is missing', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Base', type: 'feature', objective: 'o', rootDir: dir })
    const raw = JSON.parse(readFileSync(join(dir, AIPM_MANIFEST_FILE), 'utf8'))
    delete raw.updatedAt
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/updatedAt must be a non-empty string/)
  })

  it('throws when rootDir in manifest is not absolute', async () => {
    const dir = makeTempDir()
    // Build a minimally valid manifest but with a relative rootDir.
    const stages = AIPM_STAGE_TEMPLATES.map(t => ({ ...t, status: 'not-started' }))
    const manifest = {
      version: 1, id: 'abc', name: 'X', type: 'feature', objective: 'o',
      rootDir: 'relative/path', createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z', stages, assets: [],
    }
    writeRaw(dir, JSON.stringify(manifest))
    await expect(readAIPMManifest(dir)).rejects.toThrow(/rootDir must be a non-empty absolute path/)
  })

  it('normalizes missing skills and initiationGates', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Base', type: 'feature', objective: 'o', rootDir: dir })
    const raw = JSON.parse(readFileSync(join(dir, AIPM_MANIFEST_FILE), 'utf8'))
    delete raw.skills
    delete raw.initiationGates
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    const manifest = await readAIPMManifest(dir)
    expect(manifest.skills).toStrictEqual([])
    expect(manifest.initiationGates).toHaveLength(4)
  })

  it('throws when the root JSON value is an array', async () => {
    const dir = makeTempDir()
    writeRaw(dir, '[]')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/must be a JSON object/)
  })

  it('throws for an asset with an invalid sourceKind', async () => {
    const dir = join(makeTempDir(), 'proj')
    await initAIPMProject({ name: 'Base', type: 'feature', objective: 'o', rootDir: dir })
    const raw = JSON.parse(readFileSync(join(dir, AIPM_MANIFEST_FILE), 'utf8'))
    raw.assets = [{ id: 'a1', name: 'doc', sourceKind: 'unknown-kind', importedAt: '2026-01-01T00:00:00.000Z', refs: [] }]
    writeFileSync(join(dir, AIPM_MANIFEST_FILE), JSON.stringify(raw), 'utf8')
    await expect(readAIPMManifest(dir)).rejects.toThrow(/sourceKind .* is not valid/)
  })
})
