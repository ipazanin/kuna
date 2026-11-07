import { words } from './words'
import { READ_RECEIPT } from '../application/readReceipt'
import type { AppAssist, AssistTaskSummary } from '../../../../../shared/app/appContribution'
import { SPENDING_ASSISTANT_LINK } from '../../../overview/presentation/spendingLinks'

/** What reading a receipt sends, for the Assistant tab and the dialog that asks first. */
export const READ_RECEIPT_SUMMARY: AssistTaskSummary = { id: READ_RECEIPT, title: words.title, sends: words.sends }

/** What Spending's assistant may do. */
export const SPENDING_ASSIST: AppAssist = { settings: SPENDING_ASSISTANT_LINK, tasks: () => [READ_RECEIPT_SUMMARY] }
