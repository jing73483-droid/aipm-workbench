/**
 * Canonical AIPM stage metadata.
 *
 * Stage order, directory names, and display labels are fixed; they must not
 * change after projects have been initialized, because the directory names
 * are written to disk and stored in manifests.
 * @module
 */

import type {
  AIPMInitiationGateId,
  AIPMInitiationGateRecord,
  AIPMStageId,
  AIPMStageRecord,
} from './types.ts'

/** Manifest filename written in every project root. */
export const AIPM_MANIFEST_FILE = 'aipm.json'

/** Asset library sub-directory relative to the project root. */
export const AIPM_ASSETS_DIR = 'assets'

/** Project-scoped skill install directory relative to the project root. */
export const AIPM_PROJECT_SKILLS_DIR = '.dsh/skills'

/** Pending file-change reviews relative to the project root. */
export const AIPM_PENDING_DIR = '.aipm/pending'

/** Runtime set of accepted project types. */
export const AIPM_PROJECT_TYPES = new Set(['new-product', 'feature', 'enhancement', 'research'])

/** Runtime set of accepted stage statuses. */
export const AIPM_STATUSES = new Set([
  'not-started',
  'insufficient-data',
  'in-progress',
  'pending-review',
  'approved',
  'needs-rework',
  'skipped',
])

/** Runtime set of accepted asset source kinds. */
export const AIPM_ASSET_SOURCE_KINDS = new Set(['local-file', 'webpage', 'lark-doc', 'image'])

/** Runtime set of accepted skill source kinds. */
export const AIPM_SKILL_SOURCE_KINDS = new Set(['builtin', 'local', 'git'])

/** Runtime set of accepted skill scopes. */
export const AIPM_SKILL_SCOPES = new Set(['global', 'project'])

/** Number of pipeline stages written into every new manifest. */
export const AIPM_STAGE_COUNT = 8

/**
 * All eight pipeline stages in declaration order.
 *
 * These are templates without a `status`; callers attach `not-started` when
 * building the initial manifest.
 */
export const AIPM_STAGE_TEMPLATES: readonly Omit<AIPMStageRecord, 'status' | 'notes'>[] = [
  { id: 'requirement-insight', order: 1, dirName: '01-requirement-insight', name: '需求洞察', nameEn: 'Requirement Insight' },
  { id: 'market-user-research', order: 2, dirName: '02-market-user-research', name: '市场/用户研究', nameEn: 'Market & User Research' },
  { id: 'brd', order: 3, dirName: '03-brd', name: 'BRD', nameEn: 'BRD' },
  { id: 'project-initiation', order: 4, dirName: '04-project-initiation', name: '立项', nameEn: 'Project Initiation' },
  { id: 'prd', order: 5, dirName: '05-prd', name: 'PRD', nameEn: 'PRD' },
  { id: 'design-handoff', order: 6, dirName: '06-design-handoff', name: '设计交接', nameEn: 'Design Handoff' },
  { id: 'dev-test-handoff', order: 7, dirName: '07-dev-test-handoff', name: '开发/测试交接', nameEn: 'Dev & Test Handoff' },
  { id: 'launch-retrospective', order: 8, dirName: '08-launch-retrospective', name: '上线复盘', nameEn: 'Launch Retrospective' },
]

/**
 * The four initiation gates in required confirmation order.
 */
export const AIPM_INITIATION_GATE_TEMPLATES: readonly Omit<AIPMInitiationGateRecord, 'confirmedAt' | 'verdict'>[] = [
  { id: 'problem', status: 'not-started' },
  { id: 'evidence', status: 'not-started' },
  { id: 'mvp', status: 'not-started' },
  { id: 'decision', status: 'not-started' },
]

/**
 * Return the stage template matching `id`, or `undefined` if not found.
 * @param id - stage identifier to look up.
 * @returns the matching template or `undefined`.
 */
export function stageTemplateById(id: AIPMStageId): Omit<AIPMStageRecord, 'status' | 'notes'> | undefined {
  return AIPM_STAGE_TEMPLATES.find(s => s.id === id)
}

/**
 * Return whether `id` is one of the four initiation gate identifiers.
 * @param id - candidate gate identifier.
 * @returns whether the identifier is known.
 */
export function isInitiationGateId(id: string): id is AIPMInitiationGateId {
  return AIPM_INITIATION_GATE_TEMPLATES.some(gate => gate.id === id)
}
