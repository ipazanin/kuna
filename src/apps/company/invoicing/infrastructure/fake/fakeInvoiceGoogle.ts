import type { DriveEntry } from '../../../documents/application/driveFiling'
import { createFakeFilingDrive } from '../../../documents/infrastructure/fake/fakeFilingDrive'
import type { FakeFilingDrive } from '../../../documents/infrastructure/fake/fakeFilingDrive'
import type { MailDrafts } from '../../application/invoiceRun'
import type { InvoiceMail } from '../../domain/invoiceMail'

export interface FakeInvoiceGoogle extends FakeFilingDrive {
  readonly drafts: MailDrafts
  readonly savedDrafts: readonly { readonly mail: InvoiceMail; readonly fileName: string }[]
}

/** A Drive and a Gmail held in memory, the Drive as `createFakeFilingDrive` holds it. */
export function createFakeInvoiceGoogle(pick: (title: string, offered: readonly DriveEntry[]) => readonly DriveEntry[], thisYear: number): FakeInvoiceGoogle {
  return { ...createFakeFilingDrive(pick, thisYear), ...fakeGmail() }
}

function fakeGmail(): Pick<FakeInvoiceGoogle, 'drafts' | 'savedDrafts'> {
  const savedDrafts: { mail: InvoiceMail; fileName: string }[] = []
  return {
    drafts: {
      async create(mail, attachment) {
        savedDrafts.push({ mail, fileName: attachment.fileName })
      },
    },
    savedDrafts,
  }
}

let session: Pick<FakeInvoiceGoogle, 'drafts' | 'savedDrafts'> | null = null

/** The fake build's Gmail, the same until the page reloads. */
export function fakeGmailSession(): MailDrafts {
  session ??= fakeGmail()
  return session.drafts
}
