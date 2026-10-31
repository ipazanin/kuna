import type { MailSource } from '../../../mail/application/mailFiling'
import { sourceTerms } from '../../../mail/domain/mailSource'
import type { SourceTerms } from '../../../mail/domain/mailSource'
import type { Workbook } from '../../../workbook/domain/workbook'
import { invoiceNamings, payrollNamings, vatNamings } from '../domain/accountant/accountantMailFiling'
import type { CompanyFacts } from '../domain/companyFacts'
import { hrDooWorkbook } from '../domain/hrDooPart'
import { words } from '../domain/words'

/** A kind of the accountant's mail is on while its switch is, and then needs the accountant's sender, its subject and its folder. */
function accountantTerms(workbook: Workbook, kind: (facts: CompanyFacts) => { readonly on: boolean; readonly subject: string; readonly folder: readonly string[] }): SourceTerms {
  const facts = hrDooWorkbook(workbook).companyFacts
  const { on, subject, folder } = kind(facts)
  return sourceTerms(on, { senders: facts.accountantMailFrom, subject, folder })
}

/**
 * The accountant's three kinds of mail, each named as the accountant's filers name it, a resend with
 * other bytes being a correction, and each read only from mail whose subject starts with its words.
 * Nothing in the app reads the files they file.
 */
export const ACCOUNTANT_MAIL_SOURCES: readonly MailSource[] = [
  {
    id: 'hr-doo.payroll',
    label: words.accountantMail.payroll,
    duplicates: 'correction',
    terms: (workbook) => accountantTerms(workbook, (facts) => ({ on: facts.payrollMailSync, subject: facts.payrollMailSubject, folder: facts.payrollFolder })),
    name: async (message, terms, reading) => payrollNamings(message, terms.subject, terms.folder, hrDooWorkbook(reading.workbook).employees),
  },
  {
    id: 'hr-doo.vat-returns',
    label: words.accountantMail.vatReturns,
    duplicates: 'correction',
    terms: (workbook) => accountantTerms(workbook, (facts) => ({ on: facts.vatMailSync, subject: facts.vatMailSubject, folder: facts.vatReturnsFolder })),
    name: async (message, terms) => vatNamings(message, terms.subject, terms.folder),
  },
  {
    id: 'hr-doo.invoices',
    label: words.accountantMail.invoices,
    duplicates: 'correction',
    terms: (workbook) => accountantTerms(workbook, (facts) => ({ on: facts.invoicesMailSync, subject: facts.invoicesMailSubject, folder: facts.incomingInvoicesFolder })),
    name: async (message, terms) => invoiceNamings(message, terms.subject, terms.folder),
  },
]
