/** Sidebar glyph for the AIPM workbench panel. */

import { IconFolderCloseRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the folder glyph at the size the sidebar asks for.
 * @param props - requested edge and whether the panel is selected.
 * @returns the icon element.
 */
export function WorkbenchIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconFolderCloseRegular size={size} />
}
