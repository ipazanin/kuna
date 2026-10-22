import { currentAccessToken, currentGmailToken, requestGmailToken, requestToken } from '../../../shared/google/googleAuth'
import { gmailDrafts, googleInvoiceDrive } from '../infrastructure/googleInvoiceDrive'
import type { InvoiceDrive, MailDrafts } from './invoiceRun'

/**
 * Drive with the kept token, or with a new one, which opens Google's popup. Call it first in a
 * click handler, since Firefox opens the popup only while the click is recent.
 */
export async function invoiceDrive(): Promise<InvoiceDrive> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeInvoiceGoogleSession } = await import('../infrastructure/fake/fakeInvoiceGoogle')
    return fakeInvoiceGoogleSession().drive
  }
  return googleInvoiceDrive(currentAccessToken()?.value ?? (await requestToken('none')).value)
}

/** Gmail drafts with this page's Gmail token, or with a new grant, which opens Google's popup. Call it first in a click handler. */
export async function invoiceDrafts(): Promise<MailDrafts> {
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeInvoiceGoogleSession } = await import('../infrastructure/fake/fakeInvoiceGoogle')
    return fakeInvoiceGoogleSession().drafts
  }
  return gmailDrafts(currentGmailToken() ?? (await requestGmailToken()))
}
