/**
 * Authenticated Host HTTP routes that project AIPM projects into the Web workbench.
 * @module
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { existsSync } from 'node:fs'
import { initAIPMProject, readAIPMManifest, updateAIPMStage } from './init.ts'
import { importAIPMAsset } from './assets.ts'
import { confirmAIPMInitiationGate } from './gates.ts'
import {
  applyAIPMFileChange,
  listAIPMPendingChanges,
  proposeAIPMFileChange,
  rejectAIPMFileChange,
} from './review.ts'
import { createAIPMSnapshot } from './snapshot.ts'
import { installAIPMSkill, listBuiltinAIPMSkills } from './skills.ts'
import { AIPM_MANIFEST_FILE } from './stages.ts'
import type { AIPMProjectManifest } from './types.ts'
import { errorMessage, isNodeError } from './fs-util.ts'
import {
  AIPM_COMMAND_PATH,
  AIPM_STATE_PATH,
  type AIPMCommand,
  type AIPMCommandResult,
  type AIPMFileEntry,
  type AIPMWorkbenchState,
  type AIPMWorkspaceSummary,
} from './protocol.ts'

const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '.venv', 'venv', '__pycache__', '.dsh', 'dist'])
const MAX_FILES = 500
const NO_STORE = { headers: { 'cache-control': 'no-store' } } as const

/** Structural Host services the HTTP layer needs. */
export interface AIPMHttpContext {
  readonly connection: {
    readonly fetch: {
      register(route: {
        readonly path: string
        readonly methods: readonly string[]
        readonly requestBody: 'buffered'
        readonly fetch: (request: Request) => Promise<Response>
      }): (() => void) | (() => Promise<void>)
    }
  }
  readonly workspaceRegistry: {
    list(): readonly { readonly id: string; readonly title: string; readonly path: string }[]
  }
}

/**
 * Register GET `/api/aipm.state` and POST `/api/aipm.command`.
 *
 * @param ctx - Host connection and workspace registry.
 * @returns a disposer that withdraws both routes.
 */
export function registerAIPMHttp(ctx: AIPMHttpContext): () => Promise<void> {
  const state = ctx.connection.fetch.register({
    path: AIPM_STATE_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: request => handleState(ctx, request),
  })
  const command = ctx.connection.fetch.register({
    path: AIPM_COMMAND_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: request => handleCommand(ctx, request),
  })
  return async () => {
    await state()
    await command()
  }
}

async function handleState(ctx: AIPMHttpContext, request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams
  try {
    const state = await loadState(ctx, query.get('path'), query.get('file'))
    return Response.json(state, NO_STORE)
  } catch (err) {
    return jsonError(errorMessage(err), 400)
  }
}

async function handleCommand(ctx: AIPMHttpContext, request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch (err) {
    return jsonError(`Command body is not valid JSON: ${errorMessage(err)}`, 400)
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body) || typeof (body as { op?: unknown }).op !== 'string') {
    return jsonError('Command body must be an object with an op field', 400)
  }
  try {
    const result = await runCommand(ctx, body as AIPMCommand)
    return Response.json(result, { status: result.ok ? 200 : 400, ...NO_STORE })
  } catch (err) {
    return Response.json({ ok: false, error: errorMessage(err) } satisfies AIPMCommandResult, {
      status: 400,
      ...NO_STORE,
    })
  }
}

async function runCommand(ctx: AIPMHttpContext, command: AIPMCommand): Promise<AIPMCommandResult> {
  switch (command.op) {
    case 'init':
      await initAIPMProject({
        name: command.name,
        type: command.type,
        objective: command.objective,
        rootDir: assertWorkspacePath(ctx, command.rootDir),
      })
      return okState(ctx, command.rootDir, null)
    case 'updateStage':
      await updateAIPMStage(assertWorkspacePath(ctx, command.rootDir), command.stageId, {
        ...(command.status === undefined ? {} : { status: command.status }),
        ...(command.notes === undefined ? {} : { notes: command.notes }),
      })
      return okState(ctx, command.rootDir, null)
    case 'confirmGate':
      await confirmAIPMInitiationGate(
        assertWorkspacePath(ctx, command.rootDir),
        command.gateId,
        command.verdict,
      )
      return okState(ctx, command.rootDir, null)
    case 'propose':
      await proposeAIPMFileChange(
        assertWorkspacePath(ctx, command.rootDir),
        assertWorkspacePath(ctx, command.path),
        command.newText,
      )
      return okState(ctx, command.rootDir, null)
    case 'applyChange': {
      const applied = await applyAIPMFileChange(assertWorkspacePath(ctx, command.rootDir), command.changeId)
      return okState(ctx, command.rootDir, applied.path)
    }
    case 'rejectChange':
      await rejectAIPMFileChange(assertWorkspacePath(ctx, command.rootDir), command.changeId)
      return okState(ctx, command.rootDir, null)
    case 'writeFile': {
      const path = assertWorkspacePath(ctx, command.path)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, command.text, 'utf8')
      return okState(ctx, workspaceContaining(ctx, path), path)
    }
    case 'snapshot': {
      const rootDir = assertWorkspacePath(ctx, command.rootDir)
      const snapshot = await createAIPMSnapshot(rootDir, command.message)
      const result = await okState(ctx, rootDir, null)
      return { ...result, snapshot }
    }
    case 'importAsset':
      await importAIPMAsset({
        rootDir: assertWorkspacePath(ctx, command.rootDir),
        name: command.name,
        sourceKind: command.sourceKind,
        ...(command.sourcePath === undefined ? {} : { sourcePath: command.sourcePath }),
        ...(command.sourceUrl === undefined ? {} : { sourceUrl: command.sourceUrl }),
        ...(command.stageId === undefined ? {} : { stageId: command.stageId }),
      })
      return okState(ctx, command.rootDir, null)
    case 'installSkill':
      await installAIPMSkill({
        sourceKind: command.sourceKind,
        source: command.source,
        scope: command.scope,
        ...(command.rootDir === undefined ? {} : { rootDir: assertWorkspacePath(ctx, command.rootDir) }),
      })
      return okState(ctx, command.rootDir ?? null, null)
    default:
      return { ok: false, error: `Unknown AIPM command "${String((command as { op: string }).op)}"` }
  }
}

async function okState(
  ctx: AIPMHttpContext,
  selectedPath: string | null,
  file: string | null,
): Promise<AIPMCommandResult> {
  return { ok: true, state: await loadState(ctx, selectedPath, file) }
}

async function loadState(
  ctx: AIPMHttpContext,
  selectedPath: string | null,
  file: string | null,
): Promise<AIPMWorkbenchState> {
  const workspaces = await listWorkspaces(ctx)
  const selected = resolveSelected(workspaces, selectedPath)
  const manifest = selected === null ? null : await tryReadManifest(selected)
  const files = selected === null || manifest === null ? [] : await listProjectFiles(selected)
  const pending = selected === null || manifest === null ? [] : await listAIPMPendingChanges(selected)
  const openFile = file === null || file.length === 0 ? null : await readOpenFile(ctx, file)
  return {
    workspaces,
    selectedPath: selected,
    manifest,
    files,
    pending,
    openFile,
    builtinSkills: listBuiltinAIPMSkills(),
  }
}

async function listWorkspaces(ctx: AIPMHttpContext): Promise<AIPMWorkspaceSummary[]> {
  return Promise.all(ctx.workspaceRegistry.list().map(async (workspace) => ({
    id: String(workspace.id),
    title: workspace.title,
    path: workspace.path,
    hasProject: existsSync(join(workspace.path, AIPM_MANIFEST_FILE)),
  })))
}

function resolveSelected(
  workspaces: readonly AIPMWorkspaceSummary[],
  selectedPath: string | null,
): string | null {
  if (selectedPath !== null && selectedPath.length > 0) {
    const match = workspaces.find(workspace => workspace.path === resolve(selectedPath))
    if (match !== undefined) return match.path
  }
  const withProject = workspaces.find(workspace => workspace.hasProject)
  return withProject?.path ?? workspaces[0]?.path ?? null
}

async function tryReadManifest(rootDir: string): Promise<AIPMProjectManifest | null> {
  try {
    return await readAIPMManifest(rootDir)
  } catch {
    return null
  }
}

async function listProjectFiles(rootDir: string): Promise<AIPMFileEntry[]> {
  const collected: AIPMFileEntry[] = []
  await walk(rootDir, rootDir, collected)
  return collected.toSorted((left, right) => left.relativePath.localeCompare(right.relativePath))
}

async function walk(rootDir: string, current: string, collected: AIPMFileEntry[]): Promise<void> {
  /* v8 ignore next -- a listing over MAX_FILES is a safety cap, not a product path */
  if (collected.length >= MAX_FILES) return
  const entries = await readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    /* v8 ignore next -- same listing cap inside a wide directory */
    if (collected.length >= MAX_FILES) return
    if (SKIP_DIR_NAMES.has(entry.name)) continue
    const path = join(current, entry.name)
    const relativePath = relative(rootDir, path).split(sep).join('/')
    if (entry.isDirectory()) {
      collected.push({ path, relativePath, kind: 'directory' })
      await walk(rootDir, path, collected)
    } else if (entry.isFile()) {
      collected.push({ path, relativePath, kind: 'file' })
    }
  }
}

async function readOpenFile(
  ctx: AIPMHttpContext,
  path: string,
): Promise<{ readonly path: string; readonly text: string } | null> {
  const resolved = assertWorkspacePath(ctx, path)
  try {
    return { path: resolved, text: await readFile(resolved, 'utf8') }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return null
    throw err
  }
}

function workspaceContaining(ctx: AIPMHttpContext, path: string): string {
  const resolved = resolve(path)
  for (const workspace of ctx.workspaceRegistry.list()) {
    const root = resolve(workspace.path)
    if (`${resolved}${sep}`.startsWith(`${root}${sep}`)) return workspace.path
  }
  /* v8 ignore next -- assertWorkspacePath already matched a workspace */
  return resolved
}

function assertWorkspacePath(ctx: AIPMHttpContext, path: string): string {
  if (!isAbsolute(path)) {
    throw new Error(`path must be an absolute path, got: "${path}"`)
  }
  const resolved = resolve(path)
  const allowed = ctx.workspaceRegistry.list().some((workspace) => {
    const root = resolve(workspace.path)
    return resolved === root || resolved.startsWith(`${root}${sep}`)
  })
  if (!allowed) {
    throw new Error(`Path is outside registered workspaces: "${path}"`)
  }
  return resolved
}

function jsonError(error: string, status: number): Response {
  return Response.json({ ok: false, error } satisfies AIPMCommandResult, { status, ...NO_STORE })
}
