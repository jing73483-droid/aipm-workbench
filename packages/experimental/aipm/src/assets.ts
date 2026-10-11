/**
 * Copy source materials into an AIPM project's asset library and record metadata.
 * @module
 */

import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AIPMAssetMetadata, AIPMImportAssetOptions, AIPMImportAssetResult } from './types.ts'
import { AIPM_ASSETS_DIR } from './stages.ts'
import { readAIPMManifest, writeAIPMManifest } from './manifest.ts'

/**
 * Import one asset into the project library.
 *
 * `local-file` copies the source file. Other kinds write a stub that records
 * the original URL, and copy `sourcePath` or `content` when supplied.
 *
 * @param options - import request.
 * @returns the stored metadata and library path.
 */
export async function importAIPMAsset(options: AIPMImportAssetOptions): Promise<AIPMImportAssetResult> {
  if (!isAbsolute(options.rootDir)) {
    throw new Error(`rootDir must be an absolute path, got: "${options.rootDir}"`)
  }
  const name = options.name.trim()
  if (name.length === 0) {
    throw new Error('name must not be empty or whitespace-only')
  }

  if (options.sourceKind === 'local-file') {
    if (options.sourcePath === undefined || !isAbsolute(options.sourcePath)) {
      throw new Error('local-file assets require an absolute sourcePath')
    }
  } else if (options.sourceUrl === undefined || options.sourceUrl.trim().length === 0) {
    throw new Error(`${options.sourceKind} assets require a sourceUrl`)
  }

  const manifest = await readAIPMManifest(options.rootDir)
  const id = randomUUID()
  const storedName = `${id.slice(0, 8)}-${safeFileName(name, options.sourceKind, options.sourcePath)}`
  const assetsDir = join(options.rootDir, AIPM_ASSETS_DIR)
  await mkdir(assetsDir, { recursive: true })
  const storedPath = join(assetsDir, storedName)

  if (options.sourceKind === 'local-file' && options.sourcePath !== undefined) {
    await copyFile(options.sourcePath, storedPath)
  } else if (options.sourcePath !== undefined) {
    await copyFile(options.sourcePath, storedPath)
  } else {
    const body = options.content ?? [
      `# ${name}`,
      '',
      `sourceKind: ${options.sourceKind}`,
      `sourceUrl: ${options.sourceUrl}`,
      `importedAt: ${new Date().toISOString()}`,
      '',
    ].join('\n')
    await writeFile(storedPath, body, 'utf8')
  }

  const asset: AIPMAssetMetadata = {
    id,
    name,
    sourceKind: options.sourceKind,
    importedAt: new Date().toISOString(),
    refs: options.refs ?? [],
    ...(options.sourcePath === undefined ? {} : { sourcePath: options.sourcePath }),
    ...(options.sourceUrl === undefined ? {} : { sourceUrl: options.sourceUrl }),
    ...(options.stageId === undefined ? {} : { stageId: options.stageId }),
  }

  await writeAIPMManifest({
    ...manifest,
    assets: [...manifest.assets, asset],
  })

  return { asset, storedPath }
}

/**
 * Build a library filename that keeps the original extension when present.
 * @param name - display name.
 * @param sourceKind - asset origin.
 * @param sourcePath - optional original path.
 * @returns a basename safe to write under `assets/`.
 */
function safeFileName(
  name: string,
  sourceKind: AIPMImportAssetOptions['sourceKind'],
  sourcePath: string | undefined,
): string {
  const fromPath = sourcePath === undefined ? '' : basename(sourcePath)
  const raw = fromPath.length > 0 ? fromPath : name
  const cleaned = raw.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '')
  if (cleaned.length === 0) {
    return sourceKind === 'local-file' ? 'file.bin' : `${sourceKind}.md`
  }
  if (extname(cleaned).length === 0 && sourceKind !== 'local-file') {
    return `${cleaned}.md`
  }
  return cleaned
}
