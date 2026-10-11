/**
 * Shared filesystem helpers for AIPM domain operations.
 * @module
 */

import { mkdir } from 'node:fs/promises'

/**
 * Create `path` recursively. Push it onto `created` when the call actually
 * creates a directory, otherwise onto `existing`.
 * @param path - absolute directory path.
 * @param created - collector for newly created directories.
 * @param existing - collector for directories that already existed.
 */
export async function ensureDir(path: string, created: string[], existing: string[]): Promise<void> {
  const first = await mkdir(path, { recursive: true })
  if (first === undefined) {
    existing.push(path)
  } else {
    created.push(path)
  }
}

/**
 * Return whether `err` is a Node errno exception.
 * @param err - caught value.
 * @returns whether `err` exposes a `code` string.
 */
export function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}

/**
 * Render an unknown thrown value for an error message.
 * @param err - caught value.
 * @returns a string description.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
