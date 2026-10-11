/**
 * Explicit confirmation gates for the project-initiation stage.
 * @module
 */

import type { AIPMInitiationGateId, AIPMInitiationGateRecord, AIPMProjectManifest } from './types.ts'
import { AIPM_INITIATION_GATE_TEMPLATES } from './stages.ts'
import { readAIPMManifest, writeAIPMManifest } from './manifest.ts'

/** Reviewer decision recorded when confirming one initiation gate. */
export type AIPMGateVerdict = 'pass' | 'supplement' | 'stop'

/**
 * Confirm one initiation gate. Earlier gates must already be `approved`.
 *
 * - `pass` marks the gate approved and, when it is the last gate, sets the
 *   project-initiation stage to `pending-review`.
 * - `supplement` marks the gate `insufficient-data` and the stage the same.
 * - `stop` marks the gate `skipped` and the stage `skipped`.
 *
 * @param rootDir - absolute project root.
 * @param gateId - gate to confirm.
 * @param verdict - reviewer decision.
 * @returns the written manifest.
 */
export async function confirmAIPMInitiationGate(
  rootDir: string,
  gateId: AIPMInitiationGateId,
  verdict: AIPMGateVerdict,
): Promise<AIPMProjectManifest> {
  const manifest = await readAIPMManifest(rootDir)
  const order = AIPM_INITIATION_GATE_TEMPLATES.map(gate => gate.id)
  const index = order.indexOf(gateId)
  for (let i = 0; i < index; i++) {
    const previousId = order[i]
    const previous = manifest.initiationGates.find(gate => gate.id === previousId)
    if (previous?.status !== 'approved') {
      throw new Error(`Gate "${gateId}" cannot be confirmed before "${String(previousId)}" is approved`)
    }
  }

  const now = new Date().toISOString()
  const nextStatus = verdict === 'pass' ? 'approved' : verdict === 'supplement' ? 'insufficient-data' : 'skipped'
  const initiationGates: AIPMInitiationGateRecord[] = manifest.initiationGates.map(gate => (
    gate.id === gateId
      ? { ...gate, status: nextStatus, confirmedAt: now, verdict }
      : gate
  ))

  let stageStatus: AIPMProjectManifest['stages'][number]['status'] = 'in-progress'
  if (verdict === 'stop') stageStatus = 'skipped'
  else if (verdict === 'supplement') stageStatus = 'insufficient-data'
  else if (gateId === 'decision') stageStatus = 'pending-review'

  const stages = manifest.stages.map(stage => (
    stage.id === 'project-initiation' ? { ...stage, status: stageStatus } : stage
  ))

  return writeAIPMManifest({ ...manifest, initiationGates, stages })
}
