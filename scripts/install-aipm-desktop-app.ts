/**
 * Install a Finder-launchable AIPM workbench on the Mac Desktop.
 *
 * This is the product entry: an Electron .app, not `dsh web` and not a browser
 * `.command`. The unpackaged shell still loads the current workspace, so the
 * Desktop icon stays current after UI rebuilds. First run prepares the desktop
 * development project and the primary runtime; later runs reuse those trees.
 *
 * Usage: `pnpm run install:aipm-desktop [-- --no-open]`.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { resolveDshHome } from '../packages/util/home-paths/src/index.ts'
import { DESKTOP_HOST_PROTOCOL_VERSION } from '../apps/desktop/src/host-protocol.ts'
import { createPluginProfile } from '../apps/desktop/src/project-manager.ts'
import type { DesktopRelease } from '../apps/desktop/src/release.ts'
import { developmentRuntimeDirectory, resolveDesktopBuildTarget } from '../apps/desktop/scripts/desktop-build-paths.mjs'
import { prepareWorkbenchApp } from '../apps/desktop/scripts/development-app.ts'
import { prepareDevelopmentProject } from '../apps/desktop/scripts/development-project.ts'
import { preparePrimaryRuntime } from '../apps/desktop/scripts/prepare-primary-runtime.ts'

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..')
const APP_ROOT = join(REPOSITORY_ROOT, 'apps', 'desktop')
const DEVELOPMENT_ROOT = join(APP_ROOT, '.desktop-build', 'development')
const DESKTOP_APP = join(homedir(), 'Desktop', 'AIPM工作台.app')
const WEB_LAUNCHER = join(homedir(), 'Desktop', 'AIPM工作台.command')

interface PackageManifest {
  readonly version?: string
}

function packageVersion(path: string, subject: string): string {
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as PackageManifest
  if (typeof manifest.version !== 'string') throw new Error(`aipm desktop: ${subject} has no version`)
  return manifest.version
}

async function run(command: string, args: readonly string[], cwd: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`aipm desktop: ${args.join(' ')} exited with ${String(code ?? signal)}`))
    })
  })
}

async function rebuildDesktopShell(): Promise<void> {
  const pnpm = join(REPOSITORY_ROOT, 'node_modules', '.bin', 'pnpm')
  if (!existsSync(pnpm)) throw new Error('aipm desktop: workspace pnpm is missing; run pnpm install')
  await run(pnpm, ['run', 'build'], APP_ROOT)
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('aipm desktop: the Finder app is macOS-only')
  }
  const { values } = parseArgs({
    args: process.argv.slice(2).filter(argument => argument !== '--'),
    options: { 'no-open': { type: 'boolean', default: false } },
    strict: false,
  })
  for (const path of [
    join(APP_ROOT, 'lib', 'main.js'),
    join(REPOSITORY_ROOT, 'apps', 'desktop-host', 'lib', 'index.js'),
    join(REPOSITORY_ROOT, 'apps', 'web', 'dist', 'index.html'),
  ]) {
    if (!existsSync(path)) throw new Error(`aipm desktop: missing built artifact ${path}`)
  }
  await rebuildDesktopShell()
  const require = createRequire(join(APP_ROOT, 'package.json'))
  const electron: unknown = require('electron')
  if (typeof electron !== 'string') throw new Error('aipm desktop: electron executable is unavailable')
  const version = packageVersion(join(APP_ROOT, 'package.json'), 'desktop package')
  const pnpmVersion = packageVersion(join(APP_ROOT, 'node_modules', 'pnpm', 'package.json'), 'pnpm package')
  const release: DesktopRelease = {
    schemaVersion: 1,
    version,
    hostProtocolVersion: DESKTOP_HOST_PROTOCOL_VERSION,
    nodeVersion: execFileSync(electron, ['-p', 'process.versions.node'], {
      encoding: 'utf8',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    }).trim(),
    pnpmVersion,
  }
  prepareDevelopmentProject({
    projectDir: join(DEVELOPMENT_ROOT, 'project'),
    cliDir: join(REPOSITORY_ROOT, 'apps', 'cli'),
    hostDir: join(REPOSITORY_ROOT, 'apps', 'desktop-host'),
    dependencyDir: join(REPOSITORY_ROOT, 'node_modules', '.pnpm', 'node_modules'),
    release,
    target: resolveDesktopBuildTarget(),
  })
  await preparePrimaryRuntime()
  const home = resolveDshHome()
  createPluginProfile(join(home, 'profiles', 'desktop'))
  const primaryRuntime = developmentRuntimeDirectory()
  const executable = prepareWorkbenchApp({
    electron,
    appRoot: APP_ROOT,
    bundle: DESKTOP_APP,
    home,
    userData: join(home, 'desktop-electron'),
    primaryRuntime,
  })
  if (existsSync(WEB_LAUNCHER)) unlinkSync(WEB_LAUNCHER)
  console.log(`aipm desktop: installed ${DESKTOP_APP}`)
  console.log(`aipm desktop: executable ${executable}`)
  if (!values['no-open']) execFileSync('/usr/bin/open', [DESKTOP_APP])
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
