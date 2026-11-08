import { companyAssistant } from '../../src/apps/company/assistant/companyAssistant'
import type { CompanyReading } from '../../src/apps/company/assistant/companyReader'
import { HR_DOO_ASSISTANT } from '../../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { fakeStaffOf } from '../../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { installedPack } from '../../src/apps/company/packs/packContribution'
import type { CompanyBooks } from '../../src/apps/company/workbook/domain/readWorkbook'
import type { SettingRow } from '../../src/apps/company/settings/domain/settings'
import { readDocument } from '../../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import type { ChatReads } from '../../src/shared/ai/application/chatReads'
import { chatRefs } from '../../src/shared/ai/domain/chatRefs'
import type { AppReader } from '../../src/shared/app/assistantReader'
import { newPseudonyms } from '../../src/shared/privacy/domain/pseudonyms'
import type { KnownPerson } from '../../src/shared/privacy/domain/pseudonyms'

const SAVED = '2026-01-01T00:00:00.000Z'

/** The fake company with five employees, read as the store reads it. */
export function fakeCompanyBooks(): CompanyBooks {
  return readDocument({ id: 'fake', source: 'drive', title: 'Fake workbook', syncedAt: SAVED }, fakeWorkbookDocument(SAVED, 'drive', fakeStaffOf('five-employees')))
}

/** The books with these settings rows added, as a file someone edited by hand could hold. */
export function withSettings(books: CompanyBooks, rows: readonly SettingRow[]): CompanyBooks {
  const added = rows.map((record) => ({ record, id: null, label: record.key, fields: {} }))
  return { ...books, records: { ...books.records, settings: { ...books.records.settings, records: [...books.records.settings.records, ...added] } } }
}

export function readingOf(books: CompanyBooks): CompanyReading {
  return { status: () => 'open', workbook: () => books.workbook, records: () => books.records }
}

/** The company's reader with the pack's, as `app.ts` builds it. */
export function companyReaderOf(books: CompanyBooks): AppReader {
  return companyAssistant(HR_DOO_ASSISTANT, readingOf(books), () => personsOf(books)).reader!
}

/** The people the app knows, as `app.ts` reads them: the employees through the pack, and the payees the owner flagged. */
export function personsOf(books: CompanyBooks): readonly KnownPerson[] {
  return [...installedPack().employees(books.records), ...books.workbook.settings.personPayees.map((name) => ({ name, employee: false, ibans: [] }))]
}

export function companyReadsOf(books: CompanyBooks, overrides: Partial<ChatReads> = {}): ChatReads {
  return {
    readers: new Map([['company', { name: 'Company', reader: companyReaderOf(books) }]]),
    pseudonyms: newPseudonyms(),
    refs: chatRefs(),
    anonymising: () => true,
    persons: () => personsOf(books),
    mayRead: async () => true,
    ...overrides,
  }
}
