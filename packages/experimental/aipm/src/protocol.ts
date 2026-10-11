/**
 * Host/browser JSON contract for the AIPM workbench HTTP routes.
 *
 * This module is types and path constants only — no Node APIs.
 * @module
 */

import type {
  AIPMAssetSourceKind,
  AIPMInitiationGateId,
  AIPMPendingChange,
  AIPMProjectManifest,
  AIPMProjectType,
  AIPMSkillScope,
  AIPMSkillSourceKind,
  AIPMSnapshotResult,
  AIPMStageId,
  AIPMStatus,
} from './types.ts'
import type { AIPMGateVerdict } from './gates.ts'

/** Authenticated GET that returns the current workbench projection. */
export const AIPM_STATE_PATH = '/api/aipm.state'

/** Authenticated POST that runs one workbench mutation. */
export const AIPM_COMMAND_PATH = '/api/aipm.command'

/** One registered workspace as shown in the project tree. */
export interface AIPMWorkspaceSummary {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly hasProject: boolean
}

/** One file or directory under a selected AIPM project. */
export interface AIPMFileEntry {
  readonly path: string
  readonly relativePath: string
  readonly kind: 'file' | 'directory'
}

/** Builtin skill row the create/install pane can offer. */
export interface AIPMBuiltinSkillView {
  readonly name: string
  readonly description: string
  readonly recommendedStage: AIPMStageId
}

/** Full GET payload for the workbench page. */
export interface AIPMWorkbenchState {
  readonly workspaces: readonly AIPMWorkspaceSummary[]
  readonly selectedPath: string | null
  readonly manifest: AIPMProjectManifest | null
  readonly files: readonly AIPMFileEntry[]
  readonly pending: readonly AIPMPendingChange[]
  readonly openFile: { readonly path: string; readonly text: string } | null
  readonly builtinSkills: readonly AIPMBuiltinSkillView[]
}

/** One POST body the workbench page may send. */
export type AIPMCommand =
  | {
    readonly op: 'init'
    readonly name: string
    readonly type: AIPMProjectType
    readonly objective: string
    readonly rootDir: string
  }
  | {
    readonly op: 'updateStage'
    readonly rootDir: string
    readonly stageId: AIPMStageId
    readonly status?: AIPMStatus
    readonly notes?: string
  }
  | {
    readonly op: 'confirmGate'
    readonly rootDir: string
    readonly gateId: AIPMInitiationGateId
    readonly verdict: AIPMGateVerdict
  }
  | {
    readonly op: 'propose'
    readonly rootDir: string
    readonly path: string
    readonly newText: string
  }
  | {
    readonly op: 'applyChange'
    readonly rootDir: string
    readonly changeId: string
  }
  | {
    readonly op: 'rejectChange'
    readonly rootDir: string
    readonly changeId: string
  }
  | {
    readonly op: 'writeFile'
    readonly path: string
    readonly text: string
  }
  | {
    readonly op: 'snapshot'
    readonly rootDir: string
    readonly message: string
  }
  | {
    readonly op: 'importAsset'
    readonly rootDir: string
    readonly name: string
    readonly sourceKind: AIPMAssetSourceKind
    readonly sourcePath?: string
    readonly sourceUrl?: string
    readonly stageId?: AIPMStageId
  }
  | {
    readonly op: 'installSkill'
    readonly sourceKind: AIPMSkillSourceKind
    readonly source: string
    readonly scope: AIPMSkillScope
    readonly rootDir?: string
  }

/** POST outcome: a refreshed projection, or an error string. */
export interface AIPMCommandResult {
  readonly ok: boolean
  readonly error?: string
  readonly snapshot?: AIPMSnapshotResult
  readonly state?: AIPMWorkbenchState
}
