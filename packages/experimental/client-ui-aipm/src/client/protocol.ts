/** Browser copy of the AIPM workbench HTTP contract. */

export const AIPM_STATE_PATH = '/api/aipm.state'
export const AIPM_COMMAND_PATH = '/api/aipm.command'

export type AIPMProjectType = 'new-product' | 'feature' | 'enhancement' | 'research'
export type AIPMStatus =
  | 'not-started'
  | 'insufficient-data'
  | 'in-progress'
  | 'pending-review'
  | 'approved'
  | 'needs-rework'
  | 'skipped'
export type AIPMStageId =
  | 'requirement-insight'
  | 'market-user-research'
  | 'brd'
  | 'project-initiation'
  | 'prd'
  | 'design-handoff'
  | 'dev-test-handoff'
  | 'launch-retrospective'
export type AIPMGateId = 'problem' | 'evidence' | 'mvp' | 'decision'
export type AIPMGateVerdict = 'pass' | 'supplement' | 'stop'

export interface AIPMWorkspaceSummary {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly hasProject: boolean
}

export interface AIPMFileEntry {
  readonly path: string
  readonly relativePath: string
  readonly kind: 'file' | 'directory'
}

export interface AIPMStageRecord {
  readonly id: AIPMStageId
  readonly order: number
  readonly dirName: string
  readonly name: string
  readonly status: AIPMStatus
  readonly notes?: string
}

export interface AIPMGateRecord {
  readonly id: AIPMGateId
  readonly status: AIPMStatus
  readonly verdict?: AIPMGateVerdict
}

export interface AIPMAssetRecord {
  readonly id: string
  readonly name: string
  readonly sourceKind: string
}

export interface AIPMSkillRecord {
  readonly id: string
  readonly name: string
}

export interface AIPMProjectManifest {
  readonly id: string
  readonly name: string
  readonly type: AIPMProjectType
  readonly objective: string
  readonly rootDir: string
  readonly stages: readonly AIPMStageRecord[]
  readonly assets: readonly AIPMAssetRecord[]
  readonly skills: readonly AIPMSkillRecord[]
  readonly initiationGates: readonly AIPMGateRecord[]
}

export interface AIPMPendingChange {
  readonly id: string
  readonly path: string
  readonly oldText: string
  readonly newText: string
}

export interface AIPMBuiltinSkillView {
  readonly name: string
  readonly description: string
}

export interface AIPMWorkbenchState {
  readonly workspaces: readonly AIPMWorkspaceSummary[]
  readonly selectedPath: string | null
  readonly manifest: AIPMProjectManifest | null
  readonly files: readonly AIPMFileEntry[]
  readonly pending: readonly AIPMPendingChange[]
  readonly openFile: { readonly path: string; readonly text: string } | null
  readonly builtinSkills: readonly AIPMBuiltinSkillView[]
}

export type AIPMCommand = Record<string, unknown> & { readonly op: string }

export interface AIPMCommandResult {
  readonly ok: boolean
  readonly error?: string
  readonly snapshot?: { readonly created: boolean; readonly kind: string; readonly commitMessage: string }
  readonly state?: AIPMWorkbenchState
}

export const PROJECT_TYPES: readonly AIPMProjectType[] = ['new-product', 'feature', 'enhancement', 'research']
export const STATUSES: readonly AIPMStatus[] = [
  'not-started', 'insufficient-data', 'in-progress', 'pending-review', 'approved', 'needs-rework', 'skipped',
]
export const GATES: readonly AIPMGateId[] = ['problem', 'evidence', 'mvp', 'decision']
