/**
 * AIPM workbench plugin for the DeepSeek Harness.
 *
 * Mounts the AIPM domain into a Cordis composition.  On application, the
 * plugin reads every bundled skill from its package-local `skills/`
 * directory and registers them on `ctx.skills`.
 *
 * Domain utilities and all exported types are available as named exports from
 * this module; no class instantiation or Cordis context is required to use them.
 *
 * @module @deepseek-ai/dsh-experimental-aipm
 */

import type { Context } from '@deepseek-ai/cordis'
import { registerAIPMHttp, type AIPMHttpContext } from './http.ts'
import { buildAllBundledSkillRegistrations } from './skill-bundle.ts'

export type {
  AIPMStageId,
  AIPMStatus,
  AIPMProjectType,
  AIPMAssetSourceKind,
  AIPMAssetMetadata,
  AIPMStageRecord,
  AIPMInitiationGateId,
  AIPMInitiationGateRecord,
  AIPMProjectManifest,
  AIPMSkillSourceKind,
  AIPMSkillScope,
  AIPMSkillPermissions,
  AIPMSkillInstallation,
  AIPMCreateProjectOptions,
  AIPMInitResult,
  AIPMImportAssetOptions,
  AIPMImportAssetResult,
  AIPMInstallSkillOptions,
  AIPMInstallSkillResult,
  AIPMPendingChange,
  AIPMSnapshotResult,
} from './types.ts'

export {
  AIPM_STAGE_TEMPLATES,
  AIPM_INITIATION_GATE_TEMPLATES,
  AIPM_MANIFEST_FILE,
  AIPM_ASSETS_DIR,
  AIPM_PROJECT_SKILLS_DIR,
  AIPM_PENDING_DIR,
  AIPM_STAGE_COUNT,
  stageTemplateById,
  isInitiationGateId,
} from './stages.ts'

export { initAIPMProject, readAIPMManifest, updateAIPMStage, writeAIPMManifest } from './init.ts'
export { importAIPMAsset } from './assets.ts'
export {
  listBuiltinAIPMSkills,
  recommendAIPMSkillStages,
  installAIPMSkill,
  confirmAIPMSkillStages,
  parseSkillFrontmatter,
} from './skills.ts'
export type { AIPMBuiltinSkill } from './skills.ts'
export { confirmAIPMInitiationGate } from './gates.ts'
export type { AIPMGateVerdict } from './gates.ts'
export {
  proposeAIPMFileChange,
  applyAIPMFileChange,
  rejectAIPMFileChange,
  listAIPMPendingChanges,
} from './review.ts'
export { createAIPMSnapshot } from './snapshot.ts'
export {
  buildAllBundledSkillRegistrations,
  buildProjectInitiationReportRegistration,
  listBundledAIPMSkills,
} from './skill-bundle.ts'
export { registerAIPMHttp } from './http.ts'
export type { AIPMHttpContext } from './http.ts'
export {
  AIPM_STATE_PATH,
  AIPM_COMMAND_PATH,
} from './protocol.ts'
export type {
  AIPMWorkspaceSummary,
  AIPMFileEntry,
  AIPMBuiltinSkillView,
  AIPMWorkbenchState,
  AIPMCommand,
  AIPMCommandResult,
} from './protocol.ts'

/** Cordis plugin name. */
export const name = 'aipm'

/**
 * Declare `skills` as a required peer service.  Mount `@deepseek-ai/dsh-skill`
 * before this plugin, or include both in the same bundle patch.
 */
export const inject = ['skills']

/**
 * Register the bundled AIPM skills on `ctx.skills`.
 *
 * Reads every bundled skill synchronously from the package's `skills/`
 * directory and registers each as a runtime skill.
 * When `connection` and `workspaceRegistry` are present, also serves
 * `/api/aipm.state` and `/api/aipm.command` for the Web workbench.
 * Cordis disposes the registration when the plugin fiber is unloaded.
 *
 * @param ctx - Cordis context provided by the loader.
 */
export function apply(ctx: Context): void {
  for (const registration of buildAllBundledSkillRegistrations()) {
    ctx.effect(() => ctx.skills.register(registration), `aipm: ${registration.name}`)
  }
  ctx.plugin({
    inject: ['connection', 'workspaceRegistry'],
    apply(host: Context) {
      host.effect(() => registerAIPMHttp(host as unknown as AIPMHttpContext), 'aipm: http')
    },
  })
}
