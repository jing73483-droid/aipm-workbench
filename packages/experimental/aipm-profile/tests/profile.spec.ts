/** The AIPM profile bundle must insert one parseable domain plugin row. */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import * as yaml from 'js-yaml'

describe('AIPM profile bundle', () => {
  it('exports an empty runtime module', async () => {
    expect(Object.keys(await import('../src/index.ts'))).toEqual([])
  })

  it('publishes one layer inserting the AIPM domain plugin', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      publishConfig: { access: string }
      dsh: { bundle: { patch: string } }
      dependencies: Record<string, string>
    }
    expect(manifest.publishConfig.access).toBe('public')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dependencies).toEqual({
      '@deepseek-ai/dsh-experimental-aipm': 'workspace:*',
      '@deepseek-ai/dsh-experimental-client-ui-aipm': 'workspace:*',
    })
    expect(yaml.load(readFileSync(new URL(`../${manifest.dsh.bundle.patch}`, import.meta.url), 'utf8'), {
      schema: entryListSchema,
    })).toEqual([{ insert: [
      { id: 'aipm', name: '@deepseek-ai/dsh-experimental-aipm' },
      { id: 'ui-aipm', name: '@deepseek-ai/dsh-experimental-client-ui-aipm' },
    ] }])
  })
})
