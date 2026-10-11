import { describe, expect, it } from 'vitest'
import { AIPM_STAGE_TEMPLATES, AIPM_MANIFEST_FILE, AIPM_ASSETS_DIR, stageTemplateById } from '../src/stages.ts'
import type { AIPMStageId, AIPMStatus, AIPMProjectType } from '../src/types.ts'

describe('AIPM_STAGE_TEMPLATES', () => {
  it('contains exactly eight stages', () => {
    expect(AIPM_STAGE_TEMPLATES).toHaveLength(8)
  })

  it('assigns unique sequential order values starting at 1', () => {
    const orders = AIPM_STAGE_TEMPLATES.map(s => s.order)
    expect(orders).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('assigns unique stage IDs', () => {
    const ids = AIPM_STAGE_TEMPLATES.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('assigns unique dirName values', () => {
    const names = AIPM_STAGE_TEMPLATES.map(s => s.dirName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('assigns Chinese display names', () => {
    expect(AIPM_STAGE_TEMPLATES.map(s => s.name)).toStrictEqual([
      '需求洞察',
      '市场/用户研究',
      'BRD',
      '立项',
      'PRD',
      '设计交接',
      '开发/测试交接',
      '上线复盘',
    ])
  })

  it('prefixes each dirName with the two-digit order', () => {
    for (const stage of AIPM_STAGE_TEMPLATES) {
      const prefix = String(stage.order).padStart(2, '0')
      expect(stage.dirName).toMatch(new RegExp(`^${prefix}-`))
    }
  })

  it('covers all declared AIPMStageId values', () => {
    const expectedIds: AIPMStageId[] = [
      'requirement-insight',
      'market-user-research',
      'brd',
      'project-initiation',
      'prd',
      'design-handoff',
      'dev-test-handoff',
      'launch-retrospective',
    ]
    const actualIds = AIPM_STAGE_TEMPLATES.map(s => s.id)
    expect(actualIds).toStrictEqual(expectedIds)
  })
})

describe('stageTemplateById', () => {
  it('returns the matching template for a known id', () => {
    const result = stageTemplateById('brd')
    expect(result).toBeDefined()
    expect(result?.id).toBe('brd')
    expect(result?.order).toBe(3)
  })

  it('returns undefined for an unknown id', () => {
    // Cast to bypass type safety — tests the runtime boundary.
    const result = stageTemplateById('unknown-stage' as AIPMStageId)
    expect(result).toBeUndefined()
  })
})

describe('AIPM constants', () => {
  it('AIPM_MANIFEST_FILE is aipm.json', () => {
    expect(AIPM_MANIFEST_FILE).toBe('aipm.json')
  })

  it('AIPM_ASSETS_DIR is assets', () => {
    expect(AIPM_ASSETS_DIR).toBe('assets')
  })
})

describe('AIPMStatus exhaustiveness', () => {
  it('can assign every declared status value', () => {
    const statuses: AIPMStatus[] = [
      'not-started',
      'insufficient-data',
      'in-progress',
      'pending-review',
      'approved',
      'needs-rework',
      'skipped',
    ]
    // Seven declared statuses.
    expect(statuses).toHaveLength(7)
  })
})

describe('AIPMProjectType exhaustiveness', () => {
  it('can assign every declared project type', () => {
    const types: AIPMProjectType[] = [
      'new-product',
      'feature',
      'enhancement',
      'research',
    ]
    expect(types).toHaveLength(4)
  })
})
