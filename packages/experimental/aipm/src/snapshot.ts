/**
 * Git snapshots for approved AIPM artifacts and gate passages.
 * @module
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isAbsolute } from 'node:path'
import type { AIPMSnapshotResult } from './types.ts'
import { errorMessage } from './fs-util.ts'

const execFileAsync = promisify(execFile)

const GIT_IDENTITY = ['-c', 'user.name=AIPM', '-c', 'user.email=aipm@local']

/**
 * Create a Git commit of the current project tree.
 *
 * Initializes a repository when none exists. Returns `kind: 'clean'` when
 * `git status` reports no changes after `git add`.
 *
 * @param rootDir - absolute project root.
 * @param message - commit message; trimmed, must be non-empty.
 * @returns whether a commit was created.
 */
export async function createAIPMSnapshot(rootDir: string, message: string): Promise<AIPMSnapshotResult> {
  if (!isAbsolute(rootDir)) {
    throw new Error(`rootDir must be an absolute path, got: "${rootDir}"`)
  }
  const commitMessage = message.trim()
  if (commitMessage.length === 0) {
    throw new Error('snapshot message must not be empty or whitespace-only')
  }

  await ensureRepo(rootDir)
  await git(rootDir, ['add', '-A'])
  const status = await git(rootDir, ['status', '--porcelain'])
  if (status.length === 0) {
    return { created: false, kind: 'clean', commitMessage, rootDir }
  }
  await git(rootDir, [...GIT_IDENTITY, 'commit', '-m', commitMessage])
  return { created: true, kind: 'commit', commitMessage, rootDir }
}

async function ensureRepo(rootDir: string): Promise<void> {
  try {
    await git(rootDir, ['rev-parse', '--is-inside-work-tree'])
  } catch (revParseError) {
    void revParseError
    await git(rootDir, ['init'])
  }
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  try {
    const result = await execFileAsync('git', args, { cwd, encoding: 'utf8' })
    return result.stdout.trim()
  } catch (err) {
    throw new Error(`git ${args.join(' ')} failed: ${errorMessage(err)}`)
  }
}
