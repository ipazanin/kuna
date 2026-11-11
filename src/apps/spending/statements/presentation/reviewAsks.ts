import { words } from './words'
import { SPENDING_REVIEW_LINK } from '../../overview/presentation/spendingLinks'
import { SPENDING_APP } from '../../workbook/domain/spendingBooks'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'

/** To review as a whole, which the chat is asked about from its card's header. */
export const REVIEW_ASKED: AskedElement = { key: 'spending-review', label: words.review.title, about: { kind: 'place', app: SPENDING_APP, route: SPENDING_REVIEW_LINK } }
