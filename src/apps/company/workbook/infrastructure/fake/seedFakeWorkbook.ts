import { answerKunaStart, forgetKunaStart } from '../../../../../shared/app/kunaStart'
import { replaceBrowserDocument } from '../../../../../shared/storage/infrastructure/browserDocument'
import { decodeDocument, encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../../shared/storage/infrastructure/documentRecordStorage'
import type { WorkbookDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import { ID_FIELD } from '../../../../../shared/storage/domain/recordCodec'
import { COMPANY_APP } from '../../domain/companyApp'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { failNextUpload, fakeBooksFolder, fakeDriveSession, raceTheNextSave, seedFakeBackups, slowUploads } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { keepChosenCopy } from '../../../../../shared/storage/infrastructure/chosenCopy'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'
import { FAKE_MAIL_SETTINGS, bankStillMails } from '../../../mail/infrastructure/fake/fakeMailbox'
import {
  FAKE_WORKBOOK_ID,
  categoryMovePlanRecords,
  fakeWorkbookDocument,
  fakeWorkbookDocumentBeforeItems,
  itemOfLedgerRow,
  withOlderInterestCategory,
  withPaymentsMatched,
  withoutRegistrationDay,
} from './fakeWorkbook'
import { sampleCopiedLedgerRow, sampleOpenAdvanceRecords } from '../../../imports/infrastructure/fake/sampleImportFiles'
import type { FakeStaff } from './fakeWorkbook'

const DAY = 86_400_000

/** The books as they stood before imports gave every ledger row an id: no row has one, and no split part names one. */
function withoutRowIds(document: WorkbookDocument): WorkbookDocument {
  const ledger = (document.records['ledger-row'] ?? []).map(({ [ID_FIELD]: _id, ...fields }) => fields)
  const parts = (document.records['split-part'] ?? []).map(({ row_id: _rowId, ...fields }) => fields)
  return { ...document, records: { ...document.records, 'ledger-row': ledger, 'split-part': parts } }
}

/**
 * The books with two splits the guards refuse: the design invoice's workshop part no longer adds up to the row, and the business
 * lunch's own share holds an amount that cannot be read.
 */
function withRefusedSplits(document: WorkbookDocument): WorkbookDocument {
  const parts = (document.records['split-part'] ?? []).map((fields) => {
    if (fields.note === 'Workshop facilitation') return { ...fields, amount: '-300' }
    if (fields.note === 'The owner’s own lunch') return { ...fields, amount: 'twenty-five' }
    return fields
  })
  return { ...document, records: { ...document.records, 'split-part': parts } }
}

/** The books with a ledger row the AI copied, which the sample camt statement's client payment looks like, and its one item. */
function withCopiedRow(document: WorkbookDocument): WorkbookDocument {
  const { category: _category, ...copied } = sampleCopiedLedgerRow()
  const { records } = document
  return { ...document, records: { ...records, 'ledger-row': [copied, ...(records['ledger-row'] ?? [])], item: [itemOfLedgerRow(sampleCopiedLedgerRow()), ...(records.item ?? [])] } }
}

/** The books with the first client payment of one item the items tab places on an invoice placed on none, so it waits on Receivables to be placed. */
function withUnplacedPayment(document: WorkbookDocument): WorkbookDocument {
  const items = document.records.item ?? []
  const placed = items.find((item) => item.invoice_id !== undefined && items.filter((other) => other.row_id === item.row_id).length === 1)
  return { ...document, records: { ...document.records, item: items.map((item) => (item === placed ? Object.fromEntries(Object.entries(item).filter(([field]) => field !== 'invoice_id')) : item)) } }
}

function withOpenAdvance(document: WorkbookDocument): WorkbookDocument {
  const { advance, rule } = sampleOpenAdvanceRecords()
  const { records } = document
  return { ...document, records: { ...records, 'hr-doo.owner-advance': [...(records['hr-doo.owner-advance'] ?? []), advance], rule: [rule, ...(records.rule ?? [])] } }
}

/** The books as they were before Import kept recipes: an import profile of the sample bank export for main, and no bank on main, which the profile then gives it. */
function withImportProfile(document: WorkbookDocument): WorkbookDocument {
  const value =
    'account=main; date=Datum knjiženja; date_format=dd.mm.yyyy; decimal=comma; debit=Isplata; credit=Uplata; balance=Stanje; counterparty=Naziv primatelja / platitelja; counterparty_iban=IBAN; description=Opis plaćanja'
  const accounts = (document.records.account ?? []).map((account) => (account.account === 'main' ? Object.fromEntries(Object.entries(account).filter(([field]) => field !== 'bank')) : account))
  return { ...document, records: { ...document.records, account: accounts, setting: [...(document.records.setting ?? []), { key: 'import_profile_example-banka', value }] } }
}

/** The books with the main account's rows from the bank's statement mail on every day from its first, so a sync files the mailed sample statement. */
function withMailOnly(document: WorkbookDocument): WorkbookDocument {
  const accounts = (document.records.account ?? []).map((account) => (account.account === 'main' ? { ...account, sources: String(account.sources).split(',')[0]!.trim() } : account))
  return { ...document, records: { ...document.records, account: accounts } }
}

/** Each load of the fake build starts with the home welcome unanswered, unless the address says otherwise, so one check's answer does not reach the next. */
function seedFakeStart(home: string | null): void {
  forgetKunaStart()
  if (home === 'drive' || home === 'browser') answerKunaStart({ home, apps: ['company', 'loans', 'assets'] })
}

/** The variants that start without the records of a kind, by the end of their name. */
const LEFT_OUT: readonly (readonly [suffix: string, kind: string])[] = [
  ['no-billing-plan', 'billing-item'],
  ['no-scenarios', 'hr-doo.scenario-component'],
  ['no-plan', 'hr-doo.plan-line'],
  ['no-ledger', 'ledger-row'],
]

/**
 * Fills the browser from the synthetic workbook, as a successful sync would, and chooses it: a file
 * on the fake build's Drive, or with `?fake=browser` a workbook kept in this browser with changes nine
 * days past their last export, and `?fake=browser-beside-drive` that workbook with a file another
 * device made on the fake Drive too. `?fake=unregistered` is the file on Drive without the company's registration day, and a variant that ends in `older-interest` keeps bank interest on the other income class as older books do. `?fake=empty` keeps nothing, which is a first run. A variant that ends
 * in `no-billing-plan`, `no-scenarios`, `no-plan` or `no-ledger` starts without those records. `?fake=newer-file`
 * is a file a newer app saved, and with `?fake=race` another device saves at the same moment as the
 * first save, with `?fake=slow-writes` every save takes a few seconds to land, and with `?fake=save-fails` the first of them then fails. Books on the fake Drive name the bank's mail, which the
 * fake mailbox answers, but for `?fake=mail-off`. The main account takes the bank's camt file from the day after its newest row, but in a variant where the bank still mails statements the books lack, where the mail fills it on every day from its first. A variant a pack pays a made-up staff in, which `staffOf` gives, pays them in place of
 * the owner's flat salary. Only the company app's install imports this, behind an inline VITE_FAKE_WORKBOOK comparison,
 * so the module and its fixture never reach a production chunk. `?start=drive` or `?start=browser` is a person who already answered the home welcome, and `?backups` puts backups beside a file on the fake Drive.
 * A variant that ends in `copied` adds a ledger row the AI copied that the sample camt statement's client payment looks like, one that ends
 * in `open-advance` adds a cost the owner paid that the sample refund to the owner pays back, with the rule that files that refund, one that ends
 * in `unplaced` leaves a client payment on no invoice, so it waits to be placed, one that ends in `matching` holds books on the items
 * tab from before Kuna placed client payments, which match them to the invoices on every read, and one that
 * ends in `category-move` adds plan rows a category's move joins or cannot change. One that ends in `donations` adds a donation above its cap and a
 * sponsorship to a listed club, each in a category of its class. The books keep every row's money on the items tab, but for a variant
 * that ends in `no-row-ids`, which holds books from before items and from before every ledger row had an id, and one that ends in
 * `refused-splits`, which holds books from before items with two splits the guards refuse. `?fake=import-profiles` holds an import profile, as books did before Import kept recipes.
 */
export async function seedFakeWorkbook(variant: string | null, staffOf: (variant: string | null) => FakeStaff | null): Promise<void> {
  seedFakeStart(new URLSearchParams(window.location.search).get('start'))
  if (variant === 'empty') {
    saveWorkbookChoice(COMPANY_APP, null)
    return
  }
  const source = variant?.startsWith('browser') ? 'browser' : 'drive'
  const now = Date.now()
  const savedAt = new Date(now).toISOString()
  const beforeItems = variant?.endsWith('no-row-ids') === true || variant?.endsWith('refused-splits') === true
  const made = (beforeItems ? fakeWorkbookDocumentBeforeItems : fakeWorkbookDocument)(savedAt, source, staffOf(variant), variant?.endsWith('donations') ?? false)
  const seeded = variant === 'unregistered' ? withoutRegistrationDay(made) : variant?.endsWith('older-interest') === true ? withOlderInterestCategory(made) : made
  const full = variant?.endsWith('copied')
    ? withCopiedRow(seeded)
    : variant?.endsWith('open-advance')
      ? withOpenAdvance(seeded)
      : variant?.endsWith('unplaced')
        ? withUnplacedPayment(seeded)
        : variant?.endsWith('matching')
          ? withPaymentsMatched(seeded)
          : seeded
  const missing = LEFT_OUT.find(([suffix]) => variant?.endsWith(suffix))?.[1] ?? null
  const planned = variant?.endsWith('category-move') ? { ...full, records: { ...full.records, 'hr-doo.plan-line': [...(full.records['hr-doo.plan-line'] ?? []), ...categoryMovePlanRecords()] } } : full
  const unlinked = variant?.endsWith('no-row-ids') ? withoutRowIds(planned) : variant?.endsWith('refused-splits') ? withRefusedSplits(planned) : planned
  const kept = missing === null ? unlinked : { ...unlinked, records: { ...unlinked.records, [missing]: [] } }
  const mailOnly = bankStillMails(variant) ? withMailOnly(kept) : kept
  const mailed = source === 'drive' && variant !== 'mail-off' ? { ...mailOnly, records: { ...mailOnly.records, setting: [...(mailOnly.records.setting ?? []), ...FAKE_MAIL_SETTINGS] } } : mailOnly
  const profiled = variant === 'import-profiles' ? withImportProfile(mailed) : mailed
  const document = variant === 'newer-file' ? { ...profiled, schema: { ...profiled.schema, core: (profiled.schema.core ?? 0) + 1 } } : profiled
  if (variant === 'race') {
    raceTheNextSave(otherDeviceSave)
  }
  if (variant === 'slow-writes' || variant === 'save-fails') {
    slowUploads()
  }
  if (variant === 'save-fails') {
    failNextUpload()
  }
  const text = encodeDocument(document)
  if (variant === 'browser-beside-drive') {
    await onFakeDrive(text, savedAt, document)
  }
  const copy: DocumentCopy =
    source === 'browser'
      ? {
          meta: {
            id: FAKE_WORKBOOK_ID,
            source,
            title: 'Fake workbook',
            syncedAt: savedAt,
            lastExportedAt: new Date(now - 12 * DAY).toISOString(),
            unexportedSince: new Date(now - 9 * DAY).toISOString(),
          },
          revision: (await replaceBrowserDocument(FAKE_WORKBOOK_ID, text)).revision,
          document,
        }
      : await onFakeDrive(text, savedAt, document)
  if (source === 'drive' && new URLSearchParams(window.location.search).has('backups')) {
    await seedFakeBackups(copy.meta.id, COMPANY_APP)
  }
  await keepChosenCopy(COMPANY_APP, copy)
}

/** The save another device makes in a race: the snack kiosk's row confirmed on a phone, with its one item filed as travel. */
function otherDeviceSave(text: string): string {
  const document = decodeDocument(text)
  const kiosk = (document.records['ledger-row'] ?? []).find((row) => row.counterparty === 'SNACK KIOSK')
  const ledger = (document.records['ledger-row'] ?? []).map((row) => (row === kiosk ? { ...row, flagged_by: 'phone' } : row))
  const items = (document.records.item ?? []).map((item) => (kiosk !== undefined && item.row_id === kiosk[ID_FIELD] ? { ...item, category: 'travel' } : item))
  return encodeDocument({ ...document, records: { ...document.records, 'ledger-row': ledger, item: items } })
}

async function onFakeDrive(text: string, savedAt: string, document: DocumentCopy['document']): Promise<DocumentCopy> {
  const created = await createDriveDocument(fakeDriveSession(), await fakeBooksFolder(), COMPANY_APP, text)
  return {
    meta: { id: created.fileId, source: 'drive', title: documentName(COMPANY_APP), syncedAt: savedAt, lastExportedAt: null, unexportedSince: null },
    revision: created.document.revision,
    document,
  }
}
