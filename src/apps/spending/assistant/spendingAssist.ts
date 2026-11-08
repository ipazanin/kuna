import type { AppAssist } from '../../../shared/app/appContribution'
import { SPENDING_ASSISTANT_LINK } from '../overview/presentation/spendingLinks'

/** Where Spending's assistant switch is. Spending asks the chat from its pages and runs no task of its own. */
export const SPENDING_ASSIST: AppAssist = { settings: SPENDING_ASSISTANT_LINK, tasks: () => [] }
