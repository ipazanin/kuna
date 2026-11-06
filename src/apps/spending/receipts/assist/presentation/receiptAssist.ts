import { words } from './words'
import { READ_RECEIPT } from '../application/readReceipt'
import type { AssistTaskSummary } from '../../../../../shared/app/appContribution'

/** What reading a receipt sends, for the Assistant card and the first-use dialog. */
export const READ_RECEIPT_SUMMARY: AssistTaskSummary = { id: READ_RECEIPT, title: words.title, sends: words.sends, employees: null }
