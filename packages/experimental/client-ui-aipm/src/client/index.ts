/** Browser entry registering the AIPM workbench panel and sidebar brand. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { BrandName } from './BrandName.tsx'
import { HeroLiquidMark, LiquidMark } from './LiquidMark.tsx'
import { WorkbenchIcon } from './WorkbenchIcon.tsx'
import { WorkbenchPage, type WorkbenchInjected } from './WorkbenchPage.tsx'
import { en, NS, zh, type WorkbenchKey } from './locales.ts'
import glass from './glass.module.css'

void glass

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** AIPM workbench copy. */
    'aipm.workbench': WorkbenchKey
  }
}

/** The id shared by the sidebar entry and the main panel it opens. */
export const PANEL_ID = 'aipm' as MainPanelId

/** Services required by the sidebar registration, brand, and conversation handoff. */
export const inject = ['slots', 'locale', 'layout', 'uiWorkspace']

/**
 * Register the AIPM workbench dictionaries, brand, sidebar entry, and main panel.
 * @param ctx - browser services used by these contributions.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-aipm: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.register({
    name: 'sidebar.brand.mark',
  }, LiquidMark))
  ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({
    name: 'sidebar.brand.name',
    locale: NS,
  }, BrandName))
  ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({
    name: 'conversation.hero.brand.mark',
    locale: NS,
  }, HeroLiquidMark))
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: (): WorkbenchInjected => ({
      continueInChat: (workspaceId) => {
        ctx.layout.selectPanel(null)
        ctx.uiWorkspace.startSession(workspaceId as WorkspaceId | undefined)
      },
    }),
  }, WorkbenchPage))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: -10,
    locale: NS,
    label: () => t('panel'),
  }, WorkbenchIcon))
}

export { NS }
export type { WorkbenchInjected, WorkbenchPageProps } from './WorkbenchPage.tsx'
export type { WorkbenchKey } from './locales.ts'
