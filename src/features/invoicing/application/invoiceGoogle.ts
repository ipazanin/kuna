import { tokenFor } from '../../../shared/google/googleAuth'
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

/** Gmail drafts with the page's token, which carries Gmail while drafts are on, or with a new grant, which opens Google's popup. Call it first in a click handler. */
export async function invoiceDrafts(): Promise<MailDrafts> {
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeInvoiceGoogleSession } = await import('../infrastructure/fake/fakeInvoiceGoogle')
    return fakeInvoiceGoogleSession().drafts
  }
  return gmailDrafts(await tokenFor('gmail.compose', null))
}
