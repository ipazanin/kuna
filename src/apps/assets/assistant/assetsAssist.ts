import { ASSETS_ASSISTANT_LINK } from '../overview/presentation/assetLinks'
import type { AppAssist } from '../../../shared/app/appContribution'

/** What Assets' assistant may do: no task of its own, only the chat, whose switch is on the Assistant tab. */
export const ASSETS_ASSIST: AppAssist = { settings: ASSETS_ASSISTANT_LINK, tasks: () => [] }
