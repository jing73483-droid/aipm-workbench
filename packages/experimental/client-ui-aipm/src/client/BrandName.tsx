/** Expanded sidebar brand name for the AIPM workbench. */

import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { NS } from './locales.ts'
import css from './WorkbenchPage.module.css'

/**
 * Render the workbench product name beside the sidebar mark.
 * @param props - locale binding from the brand slot.
 * @returns the brand label.
 */
export function BrandName({ t }: PropsLocale<typeof NS>) {
  return <span className={css.brand}>{t('brand')}</span>
}
