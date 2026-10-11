/**
 * AIPM workbench domain types.
 *
 * This file contains only type declarations — no runtime code.
 * @module
 */

/**
 * The eight fixed PM workflow stages. These identifiers are stable on disk
 * and must not be renamed once projects have been initialized with them.
 */
export type AIPMStageId =
  | 'requirement-insight'
  | 'market-user-research'
  | 'brd'
  | 'project-initiation'
  | 'prd'
  | 'design-handoff'
  | 'dev-test-handoff'
  | 'launch-retrospective'

/**
 * Lifecycle status for a stage or the project as a whole.
 *
 * - `not-started`: no work has begun.
 * - `insufficient-data`: work was attempted but blocked on missing inputs.
 * - `in-progress`: active work under way.
 * - `pending-review`: deliverable ready, awaiting stakeholder sign-off.
 * - `approved`: stakeholder sign-off received.
 * - `needs-rework`: sign-off was withheld; changes required.
 * - `skipped`: intentionally omitted; recorded for traceability.
 */
export type AIPMStatus =
  | 'not-started'
  | 'insufficient-data'
  | 'in-progress'
  | 'pending-review'
  | 'approved'
  | 'needs-rework'
  | 'skipped'

/**
 * Categorizes a project by the kind of PM work it represents.
 */
export type AIPMProjectType =
  | 'new-product'
  | 'feature'
  | 'enhancement'
  | 'research'

/**
 * Identifies the origin of an asset in the project asset library.
 * `local-file` copies the original file; the other kinds record a URL and
 * write a stub or optional captured body into `assets/`.
 */
export type AIPMAssetSourceKind =
  | 'local-file'
  | 'webpage'
  | 'lark-doc'
  | 'image'

/**
 * Metadata record for one asset in the project asset library.
 *
 * `sourcePath` holds the original local path for `local-file` assets.
 * `sourceUrl` holds the URL for `webpage`, `lark-doc`, and hosted `image` assets.
 * Exactly one of the two is required; runtime callers may have neither during
 * stub creation and must fill the appropriate field before persisting.
 */
export interface AIPMAssetMetadata {
  /** Stable within-project asset identifier. */
  readonly id: string
  /** Human-readable label for the asset. */
  readonly name: string
  readonly sourceKind: AIPMAssetSourceKind
  /** Original local filesystem path; present for `local-file` assets. */
  readonly sourcePath?: string
  /** Original remote URL; present for `webpage`, `lark-doc`, and remote `image` assets. */
  readonly sourceUrl?: string
  /** ISO-8601 timestamp of when the asset was imported. */
  readonly importedAt: string
  /** IDs of assets this asset cites or references. */
  readonly refs: readonly string[]
  /** Stage this asset belongs to, if stage-scoped. */
  readonly stageId?: AIPMStageId
}

/**
 * Stage record stored inside the project manifest.
 *
 * `dirName` is the canonical sub-directory name under the project root and
 * is derived from the stage order and id at creation time.
 */
export interface AIPMStageRecord {
  readonly id: AIPMStageId
  /** Numeric pipeline order, 1-indexed. */
  readonly order: number
  /** Sub-directory name, e.g. `"01-requirement-insight"`. */
  readonly dirName: string
  /** Display label in Simplified Chinese. */
  readonly name: string
  /** Display label in English. */
  readonly nameEn: string
  readonly status: AIPMStatus
  /** Free-form stage notes. */
  readonly notes?: string
}

/**
 * The four explicit confirmation gates of the project-initiation stage.
 * Callers must confirm each gate before the next one may pass.
 */
export type AIPMInitiationGateId = 'problem' | 'evidence' | 'mvp' | 'decision'

/** Persisted confirmation record for one initiation gate. */
export interface AIPMInitiationGateRecord {
  readonly id: AIPMInitiationGateId
  readonly status: AIPMStatus
  /** ISO-8601 timestamp of the last confirmation, if any. */
  readonly confirmedAt?: string
  /** Reviewer verdict recorded at confirmation. */
  readonly verdict?: 'pass' | 'supplement' | 'stop'
}

/**
 * On-disk format for the AIPM project manifest (`aipm.json`).
 *
 * `version` is bumped only when the structure changes in a way that existing
 * readers cannot interpret.  Readers must reject manifests with an unknown
 * version rather than silently defaulting.
 */
export interface AIPMProjectManifest {
  readonly version: 1
  /** Stable UUID-based project identifier. */
  readonly id: string
  readonly name: string
  readonly type: AIPMProjectType
  readonly objective: string
  /** Absolute path to the project root directory. */
  readonly rootDir: string
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string
  /** ISO-8601 last-updated timestamp. */
  readonly updatedAt: string
  readonly stages: readonly AIPMStageRecord[]
  readonly assets: readonly AIPMAssetMetadata[]
  /** Installed skills scoped to this project. Omitted on read is treated as `[]`. */
  readonly skills: readonly AIPMSkillInstallation[]
  /** Four initiation gates; omitted on read is treated as the default not-started set. */
  readonly initiationGates: readonly AIPMInitiationGateRecord[]
}

// ---------------------------------------------------------------------------
// Skill installation domain
// ---------------------------------------------------------------------------

/**
 * Installation origin for an AIPM-managed skill.
 *
 * - `builtin`: bundled with the plugin; always present and read-only.
 * - `local`: loaded from a local directory path.
 * - `git`: cloned from a remote git URL. Git-based installation is declared
 *   here for domain completeness but is not implemented in the first version.
 */
export type AIPMSkillSourceKind = 'builtin' | 'local' | 'git'

/** Whether a skill installation applies to the whole user profile or one project. */
export type AIPMSkillScope = 'global' | 'project'

/**
 * Permission declarations for a skill installation.
 * These are informational in the first version; enforcement is not wired.
 */
export interface AIPMSkillPermissions {
  readonly readFiles: boolean
  readonly writeFiles: boolean
  readonly runCommands: boolean
  readonly networkAccess: boolean
}

/**
 * Record tracking one installed skill and its provenance.
 *
 * `recommendedStages` carries AI-suggested stage associations that remain
 * unconfirmed until the user explicitly approves (`recommendationsConfirmed`).
 * Git-sourced records (`sourceKind: 'git'`) are fully typed but the actual
 * clone-and-load operation is deferred to a future version.
 */
export interface AIPMSkillInstallation {
  /** Stable identifier for this installation record. */
  readonly id: string
  /** Skill name used in the registry. */
  readonly name: string
  readonly sourceKind: AIPMSkillSourceKind
  /**
   * Source address:
   * - `builtin`: package name, e.g. `"@deepseek-ai/dsh-experimental-aipm"`.
   * - `local`: absolute directory path.
   * - `git`: remote clone URL.
   */
  readonly source: string
  readonly scope: AIPMSkillScope
  readonly permissions: AIPMSkillPermissions
  /** Stage IDs suggested by an AI recommender, pending user confirmation. */
  readonly recommendedStages: readonly AIPMStageId[]
  /** True once the user has confirmed the AI recommendations. */
  readonly recommendationsConfirmed: boolean
  /** ISO-8601 installation timestamp. */
  readonly installedAt: string
}

// ---------------------------------------------------------------------------
// Initialization options and results
// ---------------------------------------------------------------------------

/** Input to the local project initialization operation. */
export interface AIPMCreateProjectOptions {
  /** Display name for the project. */
  readonly name: string
  readonly type: AIPMProjectType
  /** One-sentence project objective. */
  readonly objective: string
  /** Absolute path to the directory that will hold the project. */
  readonly rootDir: string
}

/**
 * Outcome of a successful project initialization call.
 *
 * `existingDirs` lists directories that already existed and were left
 * unchanged, so callers can inform the user without treating them as errors.
 */
export interface AIPMInitResult {
  /** Stable project identifier (UUID). */
  readonly projectId: string
  /** Absolute path to the written `aipm.json` manifest. */
  readonly manifestPath: string
  /** Directories created during initialization. */
  readonly createdDirs: readonly string[]
  /** Directories that already existed and were not modified. */
  readonly existingDirs: readonly string[]
}

/** Input for copying or recording one asset in the project library. */
export interface AIPMImportAssetOptions {
  readonly rootDir: string
  readonly name: string
  readonly sourceKind: AIPMAssetSourceKind
  /** Required for `local-file`; optional local cache path for the other kinds. */
  readonly sourcePath?: string
  /** Required for `webpage`, `lark-doc`, and `image`. */
  readonly sourceUrl?: string
  readonly stageId?: AIPMStageId
  readonly refs?: readonly string[]
  /** Optional captured body written into the library when no local file is copied. */
  readonly content?: string
}

/** Outcome of a successful asset import. */
export interface AIPMImportAssetResult {
  readonly asset: AIPMAssetMetadata
  /** Absolute path of the copied or stub file inside `assets/`. */
  readonly storedPath: string
}

/** Input for installing one AIPM-managed skill. */
export interface AIPMInstallSkillOptions {
  readonly sourceKind: AIPMSkillSourceKind
  /**
   * Builtin skill name, absolute local path, or git URL.
   * Git URLs are rejected until that installer ships.
   */
  readonly source: string
  readonly scope: AIPMSkillScope
  /** Required when `scope` is `project`. */
  readonly rootDir?: string
  /** Override the global skills root; defaults to `$DSH_HOME/skills` or `~/.dsh/skills`. */
  readonly globalRoot?: string
}

/** Outcome of a local or builtin skill installation. */
export interface AIPMInstallSkillResult {
  readonly installation: AIPMSkillInstallation
  /** Absolute directory that holds the installed skill files, when copied. */
  readonly installedDir?: string
}

/** A proposed file replacement that is not written until apply. */
export interface AIPMPendingChange {
  readonly id: string
  /** Absolute file path to replace. */
  readonly path: string
  readonly oldText: string
  readonly newText: string
  readonly createdAt: string
}

/** Outcome of a Git snapshot attempt. */
export interface AIPMSnapshotResult {
  readonly created: boolean
  /** `commit` when a snapshot was recorded; otherwise the reason no commit ran. */
  readonly kind: 'commit' | 'clean' | 'empty'
  readonly commitMessage: string
  readonly rootDir: string
}
