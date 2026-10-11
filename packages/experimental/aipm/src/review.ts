/**
 * Pending file replacements that apply only after an explicit accept.
 * @module
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AIPMPendingChange } from './types.ts'
import { AIPM_PENDING_DIR } from './stages.ts'
import { errorMessage, isNodeError } from './fs-util.ts'

/**
 * Record a proposed file replacement without writing the destination.
 *
 * @param rootDir - absolute project root.
 * @param path - absolute file path to replace.
 * @param newText - proposed contents.
 * @returns the pending change, including the current file text or `''`.
 */
export async function proposeAIPMFileChange(
  rootDir: string,
  path: string,
  newText: string,
): Promise<AIPMPendingChange> {
  assertAbsolutePair(rootDir, path)
  let oldText = ''
  try {
    oldText = await readFile(path, 'utf8')
  } catch (err) {
    if (!(isNodeError(err) && err.code === 'ENOENT')) {
      throw new Error(`Cannot read "${path}" for review: ${errorMessage(err)}`)
    }
  }
  const change: AIPMPendingChange = {
    id: randomUUID(),
    path,
    oldText,
    newText,
    createdAt: new Date().toISOString(),
  }
  const dir = join(rootDir, AIPM_PENDING_DIR)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${change.id}.json`), `${JSON.stringify(change, null, 2)}\n`, 'utf8')
  return change
}

/**
 * Write a pending change to disk and delete the review record.
 *
 * @param rootDir - absolute project root.
 * @param changeId - pending change id.
 * @returns the applied change.
 */
export async function applyAIPMFileChange(rootDir: string, changeId: string): Promise<AIPMPendingChange> {
  const change = await readPending(rootDir, changeId)
  await writeFile(change.path, change.newText, 'utf8')
  await rm(join(rootDir, AIPM_PENDING_DIR, `${changeId}.json`))
  return change
}

/**
 * Discard a pending change without writing the destination.
 *
 * @param rootDir - absolute project root.
 * @param changeId - pending change id.
 * @returns the discarded change.
 */
export async function rejectAIPMFileChange(rootDir: string, changeId: string): Promise<AIPMPendingChange> {
  const change = await readPending(rootDir, changeId)
  await rm(join(rootDir, AIPM_PENDING_DIR, `${changeId}.json`))
  return change
}

/**
 * List pending file replacements for one project, oldest first.
 *
 * A missing pending directory is an empty list, not an error.
 *
 * @param rootDir - absolute project root.
 * @returns the pending change records.
 */
export async function listAIPMPendingChanges(rootDir: string): Promise<AIPMPendingChange[]> {
  if (!isAbsolute(rootDir)) {
    throw new Error(`rootDir must be an absolute path, got: "${rootDir}"`)
  }
  const dir = join(rootDir, AIPM_PENDING_DIR)
  let names: string[]
  try {
    names = await readdir(dir)
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return []
    throw new Error(`Cannot list pending AIPM changes in "${dir}": ${errorMessage(err)}`)
  }
  const changes: AIPMPendingChange[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    changes.push(await readPending(rootDir, name.slice(0, -'.json'.length)))
  }
  return changes.toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
}

async function readPending(rootDir: string, changeId: string): Promise<AIPMPendingChange> {
  if (!isAbsolute(rootDir)) {
    throw new Error(`rootDir must be an absolute path, got: "${rootDir}"`)
  }
  const file = join(rootDir, AIPM_PENDING_DIR, `${changeId}.json`)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch (err) {
    throw new Error(`Unknown pending AIPM change "${changeId}": ${errorMessage(err)}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`Pending AIPM change "${changeId}" is not valid JSON: ${errorMessage(err)}`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Pending AIPM change "${changeId}" is not an object`)
  }
  return parsed as AIPMPendingChange
}

function assertAbsolutePair(rootDir: string, path: string): void {
  if (!isAbsolute(rootDir)) {
    throw new Error(`rootDir must be an absolute path, got: "${rootDir}"`)
  }
  if (!isAbsolute(path)) {
    throw new Error(`path must be an absolute path, got: "${path}"`)
  }
}
