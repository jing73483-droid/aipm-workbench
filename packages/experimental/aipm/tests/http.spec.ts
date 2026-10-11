import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../src/index.ts'
import { registerAIPMHttp, type AIPMHttpContext } from '../src/http.ts'
import { AIPM_COMMAND_PATH, AIPM_STATE_PATH } from '../src/protocol.ts'
import { initAIPMProject } from '../src/init.ts'
import { proposeAIPMFileChange } from '../src/review.ts'
import type { Context } from '@deepseek-ai/cordis'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function tempDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'aipm-http-'))
  roots.push(root)
  return root
}

function harness(workspaces: readonly { id: string; title: string; path: string }[]) {
  const routes = new Map<string, { fetch: (request: Request) => Promise<Response> }>()
  const ctx: AIPMHttpContext = {
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route)
          return () => { routes.delete(route.path) }
        },
      },
    },
    workspaceRegistry: { list: () => workspaces },
  }
  const dispose = registerAIPMHttp(ctx)
  return {
    ctx,
    dispose,
    get(url: string): Promise<Response> {
      return routes.get(AIPM_STATE_PATH)!.fetch(new Request(url))
    },
    post(body: unknown, raw?: string): Promise<Response> {
      return routes.get(AIPM_COMMAND_PATH)!.fetch(new Request(`http://host${AIPM_COMMAND_PATH}`, {
        method: 'POST',
        body: raw ?? JSON.stringify(body),
      }))
    },
  }
}

async function seeded() {
  const rootDir = join(tempDir(), 'proj')
  await initAIPMProject({ name: 'Demo', type: 'feature', objective: 'Ship', rootDir })
  const h = harness([{ id: 'ws-1', title: 'Demo', path: rootDir }])
  return { ...h, rootDir }
}

describe('AIPM HTTP routes', () => {
  it('projects empty workspaces and withdraws both routes', async () => {
    const h = harness([])
    const response = await h.get(`http://host${AIPM_STATE_PATH}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      workspaces: [],
      selectedPath: null,
      manifest: null,
      files: [],
      pending: [],
      openFile: null,
    })
    await h.dispose()
  })

  it('selects a workspace with a project and reads a file', async () => {
    const { get, rootDir } = await seeded()
    const file = join(rootDir, 'notes.md')
    writeFileSync(file, '# hello\n')
    const listed = await (await get(`http://host${AIPM_STATE_PATH}`)).json() as {
      selectedPath: string
      manifest: { name: string }
      files: { relativePath: string; kind: string }[]
    }
    expect(listed.selectedPath).toBe(rootDir)
    expect(listed.manifest.name).toBe('Demo')
    expect(listed.files.some(entry => entry.relativePath === 'notes.md' && entry.kind === 'file')).toBe(true)
    expect(listed.files.some(entry => entry.kind === 'directory')).toBe(true)

    const opened = await (await get(`http://host${AIPM_STATE_PATH}?path=${encodeURIComponent(rootDir)}&file=${encodeURIComponent(file)}`)).json() as {
      openFile: { text: string }
    }
    expect(opened.openFile.text).toBe('# hello\n')

    const missing = await (await get(`http://host${AIPM_STATE_PATH}?file=${encodeURIComponent(join(rootDir, 'nope.md'))}`)).json() as {
      openFile: null
    }
    expect(missing.openFile).toBeNull()

    const emptyFile = await (await get(`http://host${AIPM_STATE_PATH}?file=`)).json() as { openFile: null }
    expect(emptyFile.openFile).toBeNull()
  })

  it('skips node_modules and .git while listing', async () => {
    const { get, rootDir } = await seeded()
    mkdirSync(join(rootDir, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(rootDir, 'node_modules', 'pkg', 'index.js'), '1')
    mkdirSync(join(rootDir, '.git'), { recursive: true })
    writeFileSync(join(rootDir, '.git', 'HEAD'), 'ref')
    const listed = await (await get(`http://host${AIPM_STATE_PATH}`)).json() as { files: { relativePath: string }[] }
    expect(listed.files.some(entry => entry.relativePath.includes('node_modules'))).toBe(false)
    expect(listed.files.some(entry => entry.relativePath.includes('.git'))).toBe(false)
  })

  it('ignores symbolic links while listing project files', async () => {
    const { get, rootDir } = await seeded()
    const target = join(rootDir, 'notes.md')
    writeFileSync(target, 'note')
    symlinkSync(target, join(rootDir, 'alias.md'))
    const listed = await (await get(`http://host${AIPM_STATE_PATH}`)).json() as { files: { relativePath: string }[] }
    expect(listed.files.some(entry => entry.relativePath === 'notes.md')).toBe(true)
    expect(listed.files.some(entry => entry.relativePath === 'alias.md')).toBe(false)
  })

  it('selects the first workspace when none have a project', async () => {
    const empty = join(tempDir(), 'empty')
    mkdirSync(empty)
    const h = harness([{ id: 'a', title: 'empty', path: empty }])
    const state = await (await h.get(`http://host${AIPM_STATE_PATH}`)).json() as { selectedPath: string; manifest: null }
    expect(state.selectedPath).toBe(empty)
    expect(state.manifest).toBeNull()
  })

  it('falls back when the requested path is not a registered workspace', async () => {
    const empty = join(tempDir(), 'empty')
    mkdirSync(empty)
    const rooted = join(tempDir(), 'proj')
    await initAIPMProject({ name: 'A', type: 'feature', objective: 'x', rootDir: rooted })
    const h = harness([
      { id: 'a', title: 'empty', path: empty },
      { id: 'b', title: 'proj', path: rooted },
    ])
    const state = await (await h.get(`http://host${AIPM_STATE_PATH}?path=${encodeURIComponent(join(tempDir(), 'missing'))}`)).json() as {
      selectedPath: string
    }
    expect(state.selectedPath).toBe(rooted)
  })

  it('treats a corrupt manifest as an empty project', async () => {
    const rootDir = join(tempDir(), 'broken')
    mkdirSync(rootDir)
    writeFileSync(join(rootDir, 'aipm.json'), '{')
    const h = harness([{ id: 'w', title: 'broken', path: rootDir }])
    const state = await (await h.get(`http://host${AIPM_STATE_PATH}`)).json() as { manifest: null; files: unknown[] }
    expect(state.manifest).toBeNull()
    expect(state.files).toEqual([])
  })

  it('creates a project, writes files, reviews, snapshots, and installs a skill', async () => {
    const rootDir = join(tempDir(), 'fresh')
    mkdirSync(rootDir)
    const h = harness([{ id: 'w', title: 'fresh', path: rootDir }])
    const created = await h.post({
      op: 'init', name: 'Fresh', type: 'new-product', objective: 'Learn', rootDir,
    })
    expect(created.status).toBe(200)
    const createdBody = await created.json() as { ok: boolean; state: { manifest: { name: string } } }
    expect(createdBody.ok).toBe(true)
    expect(createdBody.state.manifest.name).toBe('Fresh')

    const sibling = join(tempDir(), 'sibling')
    mkdirSync(sibling)
    const dual = harness([
      { id: 'w0', title: 'sibling', path: sibling },
      { id: 'w', title: 'fresh', path: rootDir },
    ])
    const note = join(rootDir, '01-requirement-insight', 'notes.md')
    const written = await dual.post({ op: 'writeFile', path: note, text: 'draft' })
    expect((await written.json() as { state: { openFile: { text: string } } }).state.openFile.text).toBe('draft')

    await h.post({ op: 'updateStage', rootDir, stageId: 'requirement-insight', status: 'in-progress', notes: 'go' })
    await h.post({ op: 'updateStage', rootDir, stageId: 'brd' })
    await h.post({ op: 'confirmGate', rootDir, gateId: 'problem', verdict: 'pass' })
    await h.post({ op: 'propose', rootDir, path: note, newText: 'reviewed' })
    const pending = await (await h.get(`http://host${AIPM_STATE_PATH}`)).json() as { pending: { id: string }[] }
    expect(pending.pending).toHaveLength(1)
    await h.post({ op: 'applyChange', rootDir, changeId: pending.pending[0]!.id })
    const afterApply = await (await h.get(`http://host${AIPM_STATE_PATH}?file=${encodeURIComponent(note)}`)).json() as {
      openFile: { text: string }
      pending: unknown[]
    }
    expect(afterApply.openFile.text).toBe('reviewed')
    expect(afterApply.pending).toEqual([])

    await h.post({ op: 'propose', rootDir, path: note, newText: 'nope' })
    const again = await (await h.get(`http://host${AIPM_STATE_PATH}`)).json() as { pending: { id: string }[] }
    await h.post({ op: 'rejectChange', rootDir, changeId: again.pending[0]!.id })

    const snapshot = await h.post({ op: 'snapshot', rootDir, message: 'checkpoint' })
    expect((await snapshot.json() as { snapshot: { created: boolean } }).snapshot.created).toBe(true)

    const assetSource = join(tempDir(), 'brief.md')
    writeFileSync(assetSource, 'brief')
    await h.post({
      op: 'importAsset', rootDir, name: 'Brief', sourceKind: 'local-file', sourcePath: assetSource,
    })
    await h.post({
      op: 'importAsset',
      rootDir,
      name: 'Page',
      sourceKind: 'webpage',
      sourceUrl: 'https://example.com/brief',
      stageId: 'requirement-insight',
    })
    await h.post({
      op: 'installSkill', sourceKind: 'builtin', source: 'project-initiation-report', scope: 'project', rootDir,
    })
    const home = tempDir()
    const previous = process.env.DSH_HOME
    process.env.DSH_HOME = home
    try {
      const globalInstall = await h.post({
        op: 'installSkill', sourceKind: 'builtin', source: 'project-initiation-report', scope: 'global',
      })
      expect(globalInstall.status).toBe(200)
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
    }
  })

  it('rejects invalid JSON, unknown ops, and paths outside workspaces', async () => {
    const { post, get, rootDir } = await seeded()
    const invalid = await post(undefined, 'not-json')
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({ ok: false })

    const missingOp = await post({ name: 'x' })
    expect(missingOp.status).toBe(400)

    const arrayBody = await post(undefined, '[]')
    expect(arrayBody.status).toBe(400)

    const unknown = await post({ op: 'nope' })
    expect((await unknown.json() as { error: string }).error).toMatch(/Unknown AIPM command/)

    const outside = await post({ op: 'writeFile', path: '/tmp/aipm-outside.md', text: 'x' })
    expect(outside.status).toBe(400)
    expect((await outside.json() as { error: string }).error).toMatch(/outside registered workspaces/)

    const relative = await post({ op: 'writeFile', path: 'relative.md', text: 'x' })
    expect((await relative.json() as { error: string }).error).toMatch(/absolute path/)

    const failedState = await get(`http://host${AIPM_STATE_PATH}?file=relative.md`)
    expect(failedState.status).toBe(400)

    const directory = await get(`http://host${AIPM_STATE_PATH}?file=${encodeURIComponent(rootDir)}`)
    expect(directory.status).toBe(400)
  })

  it('registers HTTP from apply when Host services are present', async () => {
    const registered: string[] = []
    const connection = {
      fetch: {
        register(route: { path: string }) {
          registered.push(route.path)
          return () => undefined
        },
      },
    }
    const workspaceRegistry = { list: () => [] }
    const ctx = {
      effect: (fn: () => unknown) => { fn() },
      skills: { register: () => () => undefined },
      plugin(def: { apply: (inner: unknown) => void }) {
        def.apply({
          effect: (fn: () => unknown) => { fn() },
          connection,
          workspaceRegistry,
        })
      },
    }
    apply(ctx as unknown as Context)
    expect(registered).toEqual([AIPM_STATE_PATH, AIPM_COMMAND_PATH])
  })
})

describe('listAIPMPendingChanges via HTTP empty dir', () => {
  it('returns an empty pending list when the review folder is absent', async () => {
    const rootDir = join(tempDir(), 'proj')
    await initAIPMProject({ name: 'P', type: 'research', objective: 'q', rootDir })
    rmSync(join(rootDir, '.aipm'), { recursive: true, force: true })
    const pending = await proposeAIPMFileChange(rootDir, join(rootDir, 'aipm.json'), '{}')
    expect(pending.path).toBe(join(rootDir, 'aipm.json'))
  })
})
