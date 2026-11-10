import { currentToken, signsInByRedirect, tokenFor } from '../../../../shared/google/googleAuth'
import { gmailDrafts, googleInvoiceDrive } from '../infrastructure/googleInvoiceDrive'
import type { InvoiceDrive, MailDrafts } from './invoiceRun'

/**
 * Drive with the page's token, or with a new one, which opens Google's popup. Call it first in a
 * click handler, since Firefox opens the popup only while the click is recent. A phone never leaves
 * the page for it, so the invoice on screen stays.
 */
export async function invoiceDrive(): Promise<InvoiceDrive> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeInvoiceGoogleSession } = await import('../infrastructure/fake/fakeInvoiceGoogle')
    return fakeInvoiceGoogleSession().drive
  }
  return googleInvoiceDrive(await tokenFor('drive.file', null))
}

/** Gmail drafts with the page's token, which carries Gmail while drafts are on, or with a new grant, which opens Google's popup. Call it first in a click handler. A phone leaves the page for Google's consent and resumes nothing, so the person opens the invoice again once back. */
export async function invoiceDrafts(): Promise<MailDrafts> {
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeInvoiceGoogleSession } = await import('../infrastructure/fake/fakeInvoiceGoogle')
    return fakeInvoiceGoogleSession().drafts
  }
  return gmailDrafts(await tokenFor('gmail.compose', { resume: 'none' }))
}

/** How Gmail stands for turning invoice drafts on: held, a tap here can ask Google for it, or asking would leave the page. */
export type GmailForDrafts = 'held' | 'asks' | 'leaves'

/** How Gmail stands for turning drafts on for these books. Books in this browser save no draft, and a phone asks Google by leaving the page, which the fake build never does. */
export function gmailForDrafts(onDrive: boolean): GmailForDrafts {
  if (!onDrive || currentToken('gmail.compose') !== null) return 'held'
  return import.meta.env.VITE_FAKE_WORKBOOK === 'true' || !signsInByRedirect() ? 'asks' : 'leaves'
}
