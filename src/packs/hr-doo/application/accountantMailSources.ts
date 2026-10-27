import type { MailSource } from '../../../features/mail/application/mailFiling'
import type { MailTerms } from '../../../features/mail/domain/mailSource'
import type { Workbook } from '../../../features/workbook/domain/workbook'
import { invoiceNamings, payrollNamings, vatNamings } from '../domain/accountant/accountantMailFiling'
import type { CompanyFacts } from '../domain/companyFacts'
import { hrDooWorkbook } from '../domain/hrDooPart'

/** A source of the accountant's mail runs while the accountant's sender and its subject are set. */
function accountantTerms(workbook: Workbook, subject: (facts: CompanyFacts) => string, folder: (facts: CompanyFacts) => readonly string[]): MailTerms | null {
  const facts = hrDooWorkbook(workbook).companyFacts
  return facts.accountantMailFrom.length === 0 || subject(facts) === '' ? null : { senders: facts.accountantMailFrom, subject: subject(facts), folder: folder(facts) }
}

/** The accountant's three kinds of mail, each named as the accountant's filers name it, a resend with other bytes being a correction. The step only lists what they would file. */
export const ACCOUNTANT_MAIL_SOURCES: readonly MailSource[] = [
  {
    id: 'hr-doo.payroll',
    label: 'Payroll',
    duplicates: 'correction',
    dryRun: true,
    terms: (workbook) => accountantTerms(workbook, (facts) => facts.payrollMailSubject, (facts) => facts.payrollFolder),
    name: async (message, terms, reading) => payrollNamings(message, terms.subject, terms.folder, hrDooWorkbook(reading.workbook).employees),
  },
  {
    id: 'hr-doo.vat-returns',
    label: 'VAT returns',
    duplicates: 'correction',
    dryRun: true,
    terms: (workbook) => accountantTerms(workbook, (facts) => facts.vatMailSubject, (facts) => facts.vatReturnsFolder),
    name: async (message, terms) => vatNamings(message, terms.subject, terms.folder),
  },
  {
    id: 'hr-doo.invoices',
    label: "Accountant's invoices",
    duplicates: 'correction',
    dryRun: true,
    terms: (workbook) => accountantTerms(workbook, (facts) => facts.invoicesMailSubject, (facts) => facts.incomingInvoicesFolder),
    name: async (message, terms) => invoiceNamings(message, terms.folder),
  },
]
