import { googleRequest, noAnswer } from '../../../../shared/google/googleApi'
import type { MailDrafts } from '../application/invoiceRun'
import { rawInvoiceMessage } from './invoiceMessage'

const GMAIL_DRAFTS_API = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts'

/** How long saving a draft waits, since it carries the invoice's PDF, as long as a Drive upload of a file's content. */
const DRAFT_WAIT_MS = 120_000

/** Gmail drafts with a `gmail.compose` token. */
export function gmailDrafts(accessToken: string): MailDrafts {
  return {
    async create(mail, attachment) {
      await googleRequest(
        GMAIL_DRAFTS_API,
        accessToken,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { raw: rawInvoiceMessage(mail, attachment.fileName, attachment.pdf) } }) },
        noAnswer,
        DRAFT_WAIT_MS,
      )
    },
  }
}
