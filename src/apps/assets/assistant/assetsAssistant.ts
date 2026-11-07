import * as assetKinds from '../workbook/domain/assetKinds'
import type { AppAssistant } from '../../../shared/app/appContribution'

/** What Assets tells the chat: what it keeps. It has no settings table of its own. */
export const ASSETS_ASSISTANT: AppAssistant = { kinds: Object.values(assetKinds), places: [], settings: [], guides: [], automations: [], reader: null }
