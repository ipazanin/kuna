import { LOANS_ASSISTANT_LINK } from '../overview/presentation/loanLinks'
import type { AppAssist } from '../../../shared/app/appContribution'

/** What Loans' assistant may do: no task of its own, only the chat, whose switch is on the Assistant tab. */
export const LOANS_ASSIST: AppAssist = { settings: LOANS_ASSISTANT_LINK, tasks: () => [] }
