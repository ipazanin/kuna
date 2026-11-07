import * as loanKinds from '../workbook/domain/loanKinds'
import type { AppAssistant } from '../../../shared/app/appContribution'

/** What Loans tells the chat: what it keeps. It has no settings table of its own. */
export const LOANS_ASSISTANT: AppAssistant = { kinds: Object.values(loanKinds), places: [], settings: [], guides: [], automations: [] }
