import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject, PANEL_ID } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import { WorkbenchPage } from '../src/client/WorkbenchPage.tsx'
import { WorkbenchIcon } from '../src/client/WorkbenchIcon.tsx'
import { BrandName } from '../src/client/BrandName.tsx'
import { HeroLiquidMark, LiquidMark } from '../src/client/LiquidMark.tsx'

async function bench() {
  const ctx = new Context()
  const navigation: unknown[] = []
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('layout', {
    selectPanel: (id: unknown) => { navigation.push(['panel', id]) },
  })
  ctx.provide('uiWorkspace', {
    startSession: (id: unknown) => { navigation.push(['session', id]) },
  })
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      main: { kind: 'keyed', scope: 'root' },
      'sidebar.panellist': { kind: 'list', scope: 'root' },
      'sidebar.brand.mark': { kind: 'single', scope: 'root' },
      'sidebar.brand.name': { kind: 'single', scope: 'root' },
      'conversation.hero.brand.mark': { kind: 'single', scope: 'root' },
    },
  } as never, () => null)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, navigation }
}

describe('ui-aipm browser plugin', () => {
  it('registers the brand, sidebar entry, and workbench page', async () => {
    const b = await bench()
    expect(inject).toEqual(['slots', 'locale', 'layout', 'uiWorkspace'])
    expect(b.ctx.slots.entries('main')[0]?.component).toBe(WorkbenchPage)
    expect(b.ctx.slots.entries('main')[0]?.options).toMatchObject({ key: PANEL_ID })
    expect(b.ctx.slots.entries('sidebar.panellist')[0]?.component).toBe(WorkbenchIcon)
    expect(resolveSlotLabel(b.ctx.slots.entries('sidebar.panellist')[0]?.options.label)).toBe('Workbench')
    expect(b.ctx.slots.entries('sidebar.brand.mark')[0]?.component).toBe(LiquidMark)
    expect(b.ctx.slots.entries('sidebar.brand.name')[0]?.component).toBe(BrandName)
    expect(b.ctx.slots.entries('conversation.hero.brand.mark')[0]?.component).toBe(HeroLiquidMark)
    const t = b.ctx.locale.bind('aipm.workbench')
    expect(t('panel')).toBe('Workbench')
    expect(t('brand')).toBe('HI，小璟')
    const injected = b.ctx.slots.entries('main')[0]!.inject!() as { continueInChat: (id?: string) => void }
    injected.continueInChat('ws-1')
    expect(b.navigation).toEqual([['panel', null], ['session', 'ws-1']])
    await b.fiber.dispose()
    expect(b.ctx.slots.entries('main')).toEqual([])
  })

  it('keeps the node half inert', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })
})
