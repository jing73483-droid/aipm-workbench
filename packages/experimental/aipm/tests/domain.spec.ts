import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../src/index.ts'
import { initAIPMProject, readAIPMManifest, updateAIPMStage } from '../src/init.ts'
import { importAIPMAsset } from '../src/assets.ts'
import {
  confirmAIPMSkillStages,
  installAIPMSkill,
  listBuiltinAIPMSkills,
  parseSkillFrontmatter,
  recommendAIPMSkillStages,
} from '../src/skills.ts'
import { confirmAIPMInitiationGate } from '../src/gates.ts'
import { applyAIPMFileChange, listAIPMPendingChanges, proposeAIPMFileChange, rejectAIPMFileChange } from '../src/review.ts'
import { createAIPMSnapshot } from '../src/snapshot.ts'
import { buildProjectInitiationReportRegistration } from '../src/skill-bundle.ts'
import { AIPM_MANIFEST_FILE, isInitiationGateId } from '../src/stages.ts'
import { errorMessage, isNodeError } from '../src/fs-util.ts'
import type { Context } from '@deepseek-ai/cordis'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function makeTempDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'aipm-domain-'))
  roots.push(root)
  return root
}

async function makeProject(): Promise<string> {
  const rootDir = join(makeTempDir(), 'proj')
  await initAIPMProject({ name: 'Demo', type: 'feature', objective: 'Ship an MVP', rootDir })
  return rootDir
}

describe('updateAIPMStage', () => {
  it('updates status and notes', async () => {
    const rootDir = await makeProject()
    const next = await updateAIPMStage(rootDir, 'prd', { status: 'in-progress', notes: 'drafting' })
    const stage = next.stages.find(item => item.id === 'prd')
    expect(stage?.status).toBe('in-progress')
    expect(stage?.notes).toBe('drafting')
    const statusOnly = await updateAIPMStage(rootDir, 'prd', { status: 'pending-review' })
    expect(statusOnly.stages.find(item => item.id === 'prd')?.notes).toBe('drafting')
    const notesOnly = await updateAIPMStage(rootDir, 'prd', { notes: 'review' })
    expect(notesOnly.stages.find(item => item.id === 'prd')?.status).toBe('pending-review')
    expect(notesOnly.stages.find(item => item.id === 'prd')?.notes).toBe('review')
    const fresh = await updateAIPMStage(rootDir, 'brd', { status: 'in-progress' })
    expect(fresh.stages.find(item => item.id === 'brd')?.status).toBe('in-progress')
    expect(fresh.stages.find(item => item.id === 'brd')?.notes).toBeUndefined()
  })

  it('throws for an unknown stage id', async () => {
    const rootDir = await makeProject()
    await expect(updateAIPMStage(rootDir, 'unknown' as 'prd', { status: 'approved' })).rejects.toThrow(/Unknown AIPM stage/)
  })
})

describe('importAIPMAsset', () => {
  it('copies a local file into assets/', async () => {
    const rootDir = await makeProject()
    const source = join(makeTempDir(), 'brief.md')
    writeFileSync(source, '# brief\n')
    const result = await importAIPMAsset({
      rootDir,
      name: 'Brief',
      sourceKind: 'local-file',
      sourcePath: source,
    })
    expect(existsSync(result.storedPath)).toBe(true)
    expect(readFileSync(result.storedPath, 'utf8')).toBe('# brief\n')
    const manifest = await readAIPMManifest(rootDir)
    expect(manifest.assets).toHaveLength(1)
    expect(manifest.assets[0]?.sourceKind).toBe('local-file')
  })

  it('writes a URL stub for webpage assets', async () => {
    const rootDir = await makeProject()
    const result = await importAIPMAsset({
      rootDir,
      name: 'Competitor',
      sourceKind: 'webpage',
      sourceUrl: 'https://example.com/x',
      stageId: 'market-user-research',
    })
    expect(readFileSync(result.storedPath, 'utf8')).toContain('https://example.com/x')
    expect(result.asset.stageId).toBe('market-user-research')
  })

  it('copies an optional local cache for image assets', async () => {
    const rootDir = await makeProject()
    const source = join(makeTempDir(), 'shot.png')
    writeFileSync(source, 'png-bytes')
    const result = await importAIPMAsset({
      rootDir,
      name: '截图',
      sourceKind: 'image',
      sourceUrl: 'https://example.com/shot.png',
      sourcePath: source,
    })
    expect(readFileSync(result.storedPath, 'utf8')).toBe('png-bytes')
  })

  it('writes supplied content for lark-doc assets', async () => {
    const rootDir = await makeProject()
    const result = await importAIPMAsset({
      rootDir,
      name: '???',
      sourceKind: 'lark-doc',
      sourceUrl: 'https://feishu.cn/doc/abc',
      content: 'lark body',
    })
    expect(readFileSync(result.storedPath, 'utf8')).toBe('lark body')
    expect(result.storedPath.endsWith('.md')).toBe(true)
  })

  it('falls back to file.bin for a local file whose name sanitizes empty', async () => {
    const rootDir = await makeProject()
    const source = join(makeTempDir(), '???')
    writeFileSync(source, 'x')
    const result = await importAIPMAsset({
      rootDir,
      name: '???',
      sourceKind: 'local-file',
      sourcePath: source,
    })
    expect(result.storedPath.endsWith('file.bin')).toBe(true)
  })

  it('rejects relative rootDir and missing local path or URL', async () => {
    await expect(importAIPMAsset({
      rootDir: 'rel',
      name: 'X',
      sourceKind: 'local-file',
      sourcePath: '/tmp/x',
    })).rejects.toThrow(/rootDir must be an absolute path/)
    const rootDir = await makeProject()
    await expect(importAIPMAsset({
      rootDir,
      name: '   ',
      sourceKind: 'webpage',
      sourceUrl: 'https://example.com',
    })).rejects.toThrow(/name must not be empty/)
    await expect(importAIPMAsset({
      rootDir,
      name: 'X',
      sourceKind: 'local-file',
    })).rejects.toThrow(/absolute sourcePath/)
    await expect(importAIPMAsset({
      rootDir,
      name: 'X',
      sourceKind: 'webpage',
    })).rejects.toThrow(/require a sourceUrl/)
  })
})

describe('skills', () => {
  it('lists the builtin initiation skill', () => {
    expect(listBuiltinAIPMSkills().map(skill => skill.name)).toStrictEqual([
      'brd-writing',
      'competitive-analysis',
      'design-spec',
      'mrd-writing',
      'pm-doc-writer',
      'prd-writing',
      'project-initiation-report',
      'prompt-optimizer-ai-pm',
    ])
  })

  it('recommends stages from keywords', () => {
    expect(recommendAIPMSkillStages('prd-writer', '写产品需求文档')).toContain('prd')
    expect(recommendAIPMSkillStages('x', '立项是否值得投入')).toContain('project-initiation')
  })

  it('parses SKILL.md frontmatter and bodies without it', () => {
    expect(parseSkillFrontmatter('---\nname: foo-bar\ndescription: "Hello"\n---\n\n# Body\n')).toMatchObject({
      name: 'foo-bar',
      description: 'Hello',
      body: '# Body',
    })
    expect(parseSkillFrontmatter('# no yaml')).toMatchObject({ name: '', description: '', body: '# no yaml' })
  })

  it('installs a builtin skill on a project', async () => {
    const rootDir = await makeProject()
    const result = await installAIPMSkill({
      sourceKind: 'builtin',
      source: 'project-initiation-report',
      scope: 'project',
      rootDir,
    })
    expect(result.installation.recommendationsConfirmed).toBe(false)
    expect(result.installation.recommendedStages).toContain('project-initiation')
    const confirmed = await confirmAIPMSkillStages(rootDir, result.installation.id, ['project-initiation'])
    expect(confirmed.recommendationsConfirmed).toBe(true)
    expect((await readAIPMManifest(rootDir)).skills).toHaveLength(1)
  })

  it('installs a local skill directory and a SKILL.md path', async () => {
    const rootDir = await makeProject()
    const skillDir = join(makeTempDir(), 'my-prd')
    mkdirSync(skillDir)
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: my-prd\ndescription: 写 PRD 并保存\n---\n\nDo it.\n')
    const fromDir = await installAIPMSkill({
      sourceKind: 'local',
      source: skillDir,
      scope: 'project',
      rootDir,
    })
    expect(fromDir.installedDir).toBeDefined()
    expect(existsSync(join(fromDir.installedDir ?? '', 'SKILL.md'))).toBe(true)
    expect(fromDir.installation.permissions.writeFiles).toBe(true)

    const mdPath = join(skillDir, 'SKILL.md')
    const fromFile = await installAIPMSkill({
      sourceKind: 'local',
      source: mdPath,
      scope: 'project',
      rootDir,
    })
    expect(fromFile.installation.name).toBe('my-prd')
    const confirmed = await confirmAIPMSkillStages(rootDir, fromFile.installation.id, ['prd'])
    expect(confirmed.name).toBe('my-prd')
    expect((await readAIPMManifest(rootDir)).skills).toHaveLength(2)
  })

  it('installs globally into an override root', async () => {
    const globalRoot = join(makeTempDir(), 'skills')
    const skillDir = join(makeTempDir(), 'research')
    mkdirSync(skillDir)
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: user-research\ndescription: 用户研究调研\n---\n')
    const result = await installAIPMSkill({
      sourceKind: 'local',
      source: skillDir,
      scope: 'global',
      globalRoot,
    })
    expect(result.installedDir?.startsWith(globalRoot)).toBe(true)
    const confirmed = await confirmAIPMSkillStages('/unused', result.installation.id, ['market-user-research'], 'global', globalRoot)
    expect(confirmed.recommendedStages).toStrictEqual(['market-user-research'])
  })

  it('rejects git installs, unknown builtins, relative paths, and missing SKILL.md', async () => {
    await expect(installAIPMSkill({
      sourceKind: 'git',
      source: 'https://example.com/skill.git',
      scope: 'global',
    })).rejects.toThrow(/not implemented/)
    const rootDir = await makeProject()
    await expect(installAIPMSkill({
      sourceKind: 'builtin',
      source: 'missing',
      scope: 'project',
      rootDir,
    })).rejects.toThrow(/Unknown builtin skill/)
    await expect(installAIPMSkill({
      sourceKind: 'local',
      source: 'relative/path',
      scope: 'project',
      rootDir,
    })).rejects.toThrow(/absolute path/)
    await expect(installAIPMSkill({
      sourceKind: 'local',
      source: makeTempDir(),
      scope: 'project',
      rootDir,
    })).rejects.toThrow(/Cannot read SKILL.md/)
    await expect(installAIPMSkill({
      sourceKind: 'builtin',
      source: 'project-initiation-report',
      scope: 'project',
    })).rejects.toThrow(/requires an absolute rootDir/)
  })

  it('rejects a non-kebab skill name and unknown installation ids', async () => {
    const rootDir = await makeProject()
    const skillDir = join(makeTempDir(), 'Bad Name')
    mkdirSync(skillDir)
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: Not_Kebab\ndescription: x\n---\n')
    await expect(installAIPMSkill({
      sourceKind: 'local',
      source: skillDir,
      scope: 'project',
      rootDir,
    })).rejects.toThrow(/not kebab-case/)
    await expect(confirmAIPMSkillStages(rootDir, 'missing', ['prd'])).rejects.toThrow(/Unknown skill installation/)
  })

  it('rejects a corrupted global catalog', async () => {
    const parent = makeTempDir()
    const globalRoot = join(parent, 'skills')
    writeFileSync(join(parent, 'aipm-skills.json'), '{')
    const skillDir = join(makeTempDir(), 'ok')
    mkdirSync(skillDir)
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: ok-skill\ndescription: x\n---\n')
    await expect(installAIPMSkill({
      sourceKind: 'local',
      source: skillDir,
      scope: 'global',
      globalRoot,
    })).rejects.toThrow(/not valid JSON/)
    writeFileSync(join(parent, 'aipm-skills.json'), '{}')
    await expect(installAIPMSkill({
      sourceKind: 'local',
      source: skillDir,
      scope: 'global',
      globalRoot,
    })).rejects.toThrow(/must be a JSON array/)
  })
})

describe('initiation gates', () => {
  it('confirms gates in order and blocks skipped predecessors', async () => {
    const rootDir = await makeProject()
    await expect(confirmAIPMInitiationGate(rootDir, 'evidence', 'pass')).rejects.toThrow(/cannot be confirmed before/)
    const afterProblem = await confirmAIPMInitiationGate(rootDir, 'problem', 'pass')
    expect(afterProblem.initiationGates[0]?.status).toBe('approved')
    expect(afterProblem.stages.find(stage => stage.id === 'project-initiation')?.status).toBe('in-progress')
    await confirmAIPMInitiationGate(rootDir, 'evidence', 'pass')
    await confirmAIPMInitiationGate(rootDir, 'mvp', 'pass')
    const done = await confirmAIPMInitiationGate(rootDir, 'decision', 'pass')
    expect(done.stages.find(stage => stage.id === 'project-initiation')?.status).toBe('pending-review')
  })

  it('records supplement and stop verdicts', async () => {
    const rootDir = await makeProject()
    const supplement = await confirmAIPMInitiationGate(rootDir, 'problem', 'supplement')
    expect(supplement.initiationGates[0]?.status).toBe('insufficient-data')
    const other = await makeProject()
    const stopped = await confirmAIPMInitiationGate(other, 'problem', 'stop')
    expect(stopped.stages.find(stage => stage.id === 'project-initiation')?.status).toBe('skipped')
  })
})

describe('file review', () => {
  it('proposes, applies, and rejects pending replacements', async () => {
    const rootDir = await makeProject()
    const path = join(rootDir, '04-project-initiation', '立项报告.md')
    const pending = await proposeAIPMFileChange(rootDir, path, '# draft\n')
    expect(pending.oldText).toBe('')
    expect(existsSync(path)).toBe(false)
    const applied = await applyAIPMFileChange(rootDir, pending.id)
    expect(readFileSync(applied.path, 'utf8')).toBe('# draft\n')
    const next = await proposeAIPMFileChange(rootDir, path, '# final\n')
    expect(next.oldText).toBe('# draft\n')
    await rejectAIPMFileChange(rootDir, next.id)
    expect(readFileSync(path, 'utf8')).toBe('# draft\n')
  })

  it('rejects relative paths and missing or malformed pending records', async () => {
    await expect(proposeAIPMFileChange('rel', '/tmp/x', 'a')).rejects.toThrow(/rootDir must be an absolute path/)
    const rootDir = await makeProject()
    await expect(proposeAIPMFileChange(rootDir, 'rel.md', 'a')).rejects.toThrow(/path must be an absolute path/)
    await expect(proposeAIPMFileChange(rootDir, join(rootDir, '04-project-initiation'), 'a')).rejects.toThrow(/Cannot read/)
    await expect(applyAIPMFileChange(rootDir, 'missing')).rejects.toThrow(/Unknown pending AIPM change/)
    await expect(rejectAIPMFileChange('rel', 'x')).rejects.toThrow(/rootDir must be an absolute path/)
    const bad = join(rootDir, '.aipm', 'pending', 'bad.json')
    mkdirSync(join(rootDir, '.aipm', 'pending'), { recursive: true })
    writeFileSync(bad, '{')
    await expect(applyAIPMFileChange(rootDir, 'bad')).rejects.toThrow(/not valid JSON/)
    writeFileSync(bad, '[]')
    await expect(applyAIPMFileChange(rootDir, 'bad')).rejects.toThrow(/is not an object/)
  })

  it('lists pending changes and ignores non-json files', async () => {
    const rootDir = await makeProject()
    rmSync(join(rootDir, '.aipm'), { recursive: true, force: true })
    expect(await listAIPMPendingChanges(rootDir)).toEqual([])
    const first = await proposeAIPMFileChange(rootDir, join(rootDir, 'a.md'), 'a')
    const second = await proposeAIPMFileChange(rootDir, join(rootDir, 'b.md'), 'b')
    writeFileSync(join(rootDir, '.aipm', 'pending', 'notes.txt'), 'skip')
    const listed = await listAIPMPendingChanges(rootDir)
    expect(listed.map(item => item.id).sort()).toEqual([first.id, second.id].sort())
    await expect(listAIPMPendingChanges('rel')).rejects.toThrow(/rootDir must be an absolute path/)
    mkdirSync(join(rootDir, '.aipm', 'pending-file'))
    rmSync(join(rootDir, '.aipm', 'pending'), { recursive: true, force: true })
    writeFileSync(join(rootDir, '.aipm', 'pending'), 'not-a-dir')
    await expect(listAIPMPendingChanges(rootDir)).rejects.toThrow(/Cannot list pending AIPM changes/)
  })
})

describe('git snapshot', () => {
  it('commits dirty trees and reports a clean tree', async () => {
    const rootDir = await makeProject()
    const first = await createAIPMSnapshot(rootDir, '  aipm: init  ')
    expect(first.created).toBe(true)
    expect(first.kind).toBe('commit')
    const second = await createAIPMSnapshot(rootDir, 'aipm: again')
    expect(second.created).toBe(false)
    expect(second.kind).toBe('clean')
  })

  it('rejects relative roots and empty messages', async () => {
    await expect(createAIPMSnapshot('rel', 'msg')).rejects.toThrow(/rootDir must be an absolute path/)
    const rootDir = await makeProject()
    await expect(createAIPMSnapshot(rootDir, '   ')).rejects.toThrow(/snapshot message must not be empty/)
  })
})

describe('plugin apply and helpers', () => {
  it('registers the bundled skill', () => {
    const registered: Array<{ name: string; source: string }> = []
    const ctx = {
      effect: (fn: () => unknown) => { fn() },
      skills: { register: (value: { name: string; source: string }) => { registered.push(value); return () => undefined } },
      plugin: () => undefined,
    }
    apply(ctx as Context)
    expect(registered.map(skill => skill.name)).toStrictEqual([
      'brd-writing',
      'competitive-analysis',
      'design-spec',
      'mrd-writing',
      'pm-doc-writer',
      'prd-writing',
      'project-initiation-report',
      'prompt-optimizer-ai-pm',
    ])
    expect(registered.every(skill => skill.source === 'bundled')).toBe(true)
  })

  it('builds a registration that points at the shipped skill files', () => {
    const registration = buildProjectInitiationReportRegistration()
    expect(registration.content).toContain('产品立项报告')
    expect(registration.resourceBase).toMatchObject({ kind: 'directory' })
  })

  it('identifies initiation gates and formats errors', () => {
    expect(isInitiationGateId('problem')).toBe(true)
    expect(isInitiationGateId('nope')).toBe(false)
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage(12)).toBe('12')
    expect(isNodeError(new Error('x'))).toBe(false)
    const nodeErr = Object.assign(new Error('e'), { code: 'ENOENT' })
    expect(isNodeError(nodeErr)).toBe(true)
  })
})

describe('more skill and snapshot edges', () => {
  it('uses the directory name when frontmatter has no name', async () => {
    const rootDir = await makeProject()
    const skillDir = join(makeTempDir(), 'user-insight')
    mkdirSync(skillDir)
    writeFileSync(join(skillDir, 'SKILL.md'), '---\ndescription: 需求洞察问题定义 bash 飞书\n---\n')
    const result = await installAIPMSkill({
      sourceKind: 'local',
      source: skillDir,
      scope: 'project',
      rootDir,
    })
    expect(result.installation.name).toBe('user-insight')
    expect(result.installation.permissions.runCommands).toBe(true)
    expect(result.installation.permissions.networkAccess).toBe(true)
    expect(result.installation.recommendedStages).toContain('requirement-insight')
  })

  it('covers remaining stage keyword rules', () => {
    expect(recommendAIPMSkillStages('x', 'brd 商业需求')).toContain('brd')
    expect(recommendAIPMSkillStages('x', 'design.md 设计交接')).toContain('design-handoff')
    expect(recommendAIPMSkillStages('x', '开发交接 测试验收')).toContain('dev-test-handoff')
    expect(recommendAIPMSkillStages('x', '上线复盘 retrospective')).toContain('launch-retrospective')
  })

  it('reads DSH_HOME for global builtin installs', async () => {
    const home = makeTempDir()
    const previous = process.env.DSH_HOME
    process.env.DSH_HOME = home
    try {
      const result = await installAIPMSkill({
        sourceKind: 'builtin',
        source: 'project-initiation-report',
        scope: 'global',
      })
      expect(result.installation.scope).toBe('global')
      expect(existsSync(join(home, 'aipm-skills.json'))).toBe(true)
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
    }
  })

  it('rejects global install without DSH_HOME or globalRoot', async () => {
    const previous = process.env.DSH_HOME
    delete process.env.DSH_HOME
    try {
      await expect(installAIPMSkill({
        sourceKind: 'builtin',
        source: 'project-initiation-report',
        scope: 'global',
      })).rejects.toThrow(/requires globalRoot or DSH_HOME/)
      process.env.DSH_HOME = ''
      await expect(installAIPMSkill({
        sourceKind: 'builtin',
        source: 'project-initiation-report',
        scope: 'global',
      })).rejects.toThrow(/requires globalRoot or DSH_HOME/)
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
    }
  })

  it('rejects an unreadable global catalog file', async () => {
    const parent = makeTempDir()
    const globalRoot = join(parent, 'skills')
    mkdirSync(join(parent, 'aipm-skills.json'))
    await expect(installAIPMSkill({
      sourceKind: 'builtin',
      source: 'project-initiation-report',
      scope: 'global',
      globalRoot,
    })).rejects.toThrow(/Cannot read global AIPM skill catalog/)
  })

  it('rejects a relative globalRoot', async () => {
    await expect(installAIPMSkill({
      sourceKind: 'builtin',
      source: 'project-initiation-report',
      scope: 'global',
      globalRoot: 'relative',
    })).rejects.toThrow(/globalRoot must be an absolute path/)
  })

  it('fails when git cannot run in the target path', async () => {
    const file = join(makeTempDir(), 'not-a-dir')
    writeFileSync(file, 'x')
    await expect(createAIPMSnapshot(file, 'msg')).rejects.toThrow(/git /)
  })
})

describe('manifest validation extras', () => {
  it('rejects malformed stages, assets, skills, and gates', async () => {
    const dir = await makeProject()
    const path = join(dir, AIPM_MANIFEST_FILE)
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

    const write = (patch: Record<string, unknown>) => {
      writeFileSync(path, JSON.stringify({ ...raw, ...patch }))
    }

    write({ stages: 'nope' })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/stages must be an array/)
    write({ stages: [{}] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/exactly 8/)
    write({ stages: [1, 2, 3, 4, 5, 6, 7, 8] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/must be an object/)

    write({ assets: 'nope' })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/assets must be an array/)
    write({ assets: [1] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/assets\[0\] must be an object/)
    write({ assets: [{ id: '', name: 'n', sourceKind: 'image', importedAt: 't', refs: [] }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/id must be a non-empty string/)
    write({ assets: [{ id: 'a', name: '', sourceKind: 'image', importedAt: 't', refs: [] }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/name must be a non-empty string/)
    write({ assets: [{ id: 'a', name: 'n', sourceKind: 'image', importedAt: '', refs: [] }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/importedAt/)
    write({ assets: [{ id: 'a', name: 'n', sourceKind: 'image', importedAt: 't', refs: 'x' }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/refs must be an array/)

    write({ skills: 'x' })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/skills must be an array/)
    write({ skills: [1] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/skills\[0\] must be an object/)
    write({ initiationGates: 'x' })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/initiationGates must be an array/)
    write({ initiationGates: [] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/exactly 4/)
    write({ initiationGates: [1, 2, 3, 4] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/must be an object/)

    const stages = (raw['stages'] as Record<string, unknown>[]).map(stage => ({ ...stage }))
    stages[0] = { ...stages[0], id: 'nope' }
    write({ stages })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/known stage identifier/)
    stages[0] = { ...(raw['stages'] as Record<string, unknown>[])[0], order: 1.5 }
    write({ stages })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/order must be an integer/)
    stages[0] = { ...(raw['stages'] as Record<string, unknown>[])[0], dirName: '' }
    write({ stages })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/dirName/)
    stages[0] = { ...(raw['stages'] as Record<string, unknown>[])[0], name: '' }
    write({ stages })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/name must be a non-empty string/)

    write({ skills: [{ id: '', name: 'n', sourceKind: 'local', source: '/x', scope: 'project', installedAt: 't' }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/skills\[0\]\.id/)
    write({ skills: [{ id: 'i', name: '', sourceKind: 'local', source: '/x', scope: 'project', installedAt: 't' }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/skills\[0\]\.name/)
    write({ skills: [{ id: 'i', name: 'n', sourceKind: 'nope', source: '/x', scope: 'project', installedAt: 't' }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/sourceKind is not valid/)
    write({ skills: [{ id: 'i', name: 'n', sourceKind: 'local', source: '', scope: 'project', installedAt: 't' }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/source must be a non-empty string/)
    write({ skills: [{ id: 'i', name: 'n', sourceKind: 'local', source: '/x', scope: 'nope', installedAt: 't' }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/scope is not valid/)
    write({ skills: [{ id: 'i', name: 'n', sourceKind: 'local', source: '/x', scope: 'project', installedAt: '' }] })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/installedAt/)

    const gates = [
      { id: 'nope', status: 'not-started' },
      { id: 'evidence', status: 'not-started' },
      { id: 'mvp', status: 'not-started' },
      { id: 'decision', status: 'not-started' },
    ]
    write({ initiationGates: gates })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/known gate/)
    gates[0] = { id: 'problem', status: 'nope' }
    write({ initiationGates: gates })
    await expect(readAIPMManifest(dir)).rejects.toThrow(/status is not valid/)
  })
})
