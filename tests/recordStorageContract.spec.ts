import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { BILLING_WRITES } from '../src/apps/company/billingPlan/application/billingWrites'
import { LEDGER_WRITES } from '../src/apps/company/imports/application/ledgerWrites'
import { installedPack } from '../src/apps/company/packs/packContribution'
import { INVOICE_WRITES } from '../src/apps/company/receivables/application/invoiceWrites'
import { DISMISSAL_WRITES } from '../src/apps/company/review/application/dismissalWrites'
import { RULE_WRITES } from '../src/apps/company/rules/application/ruleWrites'
import { SETTING_WRITES } from '../src/apps/company/settings/application/settingWrites'
import { ACCOUNT_WRITES, CATEGORY_WRITES, CLIENT_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { SPLIT_WRITES } from '../src/apps/company/transactions/application/splitWrites'
import { BANK_LOAN_WRITES, EXTRA_PAYMENT_WRITES, LATE_INSTALMENT_WRITES, RATE_PERIOD_WRITES, removeBankLoan } from '../src/apps/loans/bankLoans/application/bankLoanWrites'
import { INFORMAL_LOAN_WRITES, MOVEMENT_WRITES } from '../src/apps/loans/informalLoans/application/informalLoanWrites'
import { canUndo } from '../src/shared/storage/application/createWorkbookStore'
import type { BooksRead, WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { CATEGORY_RECORDS, CLIENT_RECORDS, INVOICE_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { filledFields } from '../src/shared/storage/domain/recordFields'
import type { FieldValue, RecordFields } from '../src/shared/storage/domain/recordFields'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { refusalOr, storedFieldOfValue, storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import type { StoredField } from '../src/shared/storage/domain/storedFields'
import type { WriteRules } from '../src/shared/storage/domain/writeRules'
import { browserDocumentHome, replaceBrowserDocument } from '../src/shared/storage/infrastructure/browserDocument'
import { decodeDocument, encodeDocument, storedFieldsOfDocument } from '../src/shared/storage/infrastructure/documentFormat'
import type { DocumentRecord, WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { recordOnScreen, recordsOnScreen } from './fixtures/records'
import { COMPANY, LOANS, browserHarness, driveHarness, forgetCaches } from './fixtures/writeBack'
import type { AppUnderTest } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** Records of some kinds, by the kind's name. */
type Seed = Readonly<Record<string, readonly RecordFields[]>>

/** A storage under test, opened with the seed's records, and the edits another device or a person makes outside the app. */
interface StorageUnderTest<Books extends BooksRead> {
  readonly store: WorkbookStore<Books, DocumentCopy>
  /** Another device adds a record, ahead of every record the app wrote. */
  addOutside(kind: RecordKind<unknown>, fields: RecordFields): Promise<void>
  /** Another device sets one field of the one record with this identity. */
  changeOutside(kind: RecordKind<unknown>, id: RecordId, field: string, value: FieldValue): Promise<void>
  removeOutside(kind: RecordKind<unknown>, id: RecordId): Promise<void>
  /** Everything the storage holds, to show that a refused write left it alone. */
  held(): Promise<string>
}

/** The identity these fields hold. */
function idOf(app: AppUnderTest<BooksRead>, kind: RecordKind<unknown>, fields: RecordFields): RecordId {
  const key = app.document.codecOf(kind).key(storedFieldsOfValues(filledFields(fields)))
  if (key === null) {
    throw new Error(`The fixture's ${kind.noun.one} has no key or id.`)
  }
  return recordIdOf(kind, key)
}

/** The record these fields make, a blank field left out, which fails the test when the kind's factory refuses them. */
function recordOf<R>(app: AppUnderTest<BooksRead>, kind: RecordKind<R>, fields: RecordFields): R {
  const made = refusalOr(() => app.document.codecOf(kind).make(storedFieldsOfValues(filledFields(fields)), idOf(app, kind, fields)))
  if ('refused' in made) {
    throw new Error(`The fixture's ${kind.noun.one} is refused: ${made.refused}`)
  }
  return made.made
}

/** Whether a stored field holds the value written: its text, or the day or the number the text names. */
function holdsValue(field: StoredField | undefined, value: FieldValue): boolean {
  if (field === undefined) return false
  if (typeof value === 'boolean') return field.flag === value
  const written = storedFieldOfValue(value)
  return field.text === written.text || (written.date !== null && field.date === written.date) || (written.number !== null && field.number === written.number)
}

function holdsId(app: AppUnderTest<BooksRead>, kind: RecordKind<unknown>, id: RecordId): (record: DocumentRecord) => boolean {
  return (record) => {
    const key = app.document.codecOf(kind).key(storedFieldsOfDocument(record))
    return key !== null && recordIdOf(kind, key) === id
  }
}

/** A document with the seed's records. */
function documentOf(app: AppUnderTest<BooksRead>, seed: Seed): WorkbookDocument {
  return newDocument(
    app.app,
    app.document.schema(),
    Object.fromEntries(Object.entries(seed).map(([name, records]) => [name, records.map((fields) => filledFields(fields))])),
    '2026-10-16T09:00:00.000Z',
  )
}

/** The document with one kind's records as `edit` leaves them. */
function withRecords(document: WorkbookDocument, kind: RecordKind<unknown>, edit: (records: readonly DocumentRecord[]) => DocumentRecord[]): WorkbookDocument {
  return { ...document, records: { ...document.records, [kind.name]: edit(document.records[kind.name] ?? []) } }
}

/** The outside edits on a document, which `save` stores in place of the one its home holds. */
function outsideEdits(app: AppUnderTest<BooksRead>, load: () => Promise<WorkbookDocument>, save: (document: WorkbookDocument) => Promise<void>): Omit<StorageUnderTest<BooksRead>, 'store' | 'held'> {
  const edit = async (kind: RecordKind<unknown>, change: (records: readonly DocumentRecord[]) => DocumentRecord[]): Promise<void> => {
    await save(withRecords(await load(), kind, change))
  }
  return {
    addOutside: (kind, fields) => edit(kind, (records) => [filledFields(fields), ...records]),
    changeOutside: (kind, id, field, value) =>
      edit(kind, (records) => {
        const holds = holdsId(app, kind, id)
        expect(records.filter(holds)).toHaveLength(1)
        return records.map((record) => (holds(record) ? { ...record, [field]: value } : record))
      }),
    removeOutside: (kind, id) => edit(kind, (records) => records.filter((record) => !holdsId(app, kind, id)(record))),
  }
}

async function driveStorage<Books extends BooksRead>(app: AppUnderTest<Books>, seed: Seed): Promise<StorageUnderTest<Books>> {
  const harness = await driveHarness(used, documentOf(app, seed), app)
  const { store } = harness
  const fileId = store.state.choice!.id
  const drive = harness.drive!
  const edits = outsideEdits(
    app,
    async () => decodeDocument(await drive.download(fileId)),
    async (document) => {
      await drive.upload(fileId, encodeDocument(document))
      await store.sync()
    },
  )
  return { store, ...edits, held: () => drive.download(fileId) }
}

async function browserStorage<Books extends BooksRead>(app: AppUnderTest<Books>, seed: Seed): Promise<StorageUnderTest<Books>> {
  const harness = await browserHarness(used, documentOf(app, seed), app)
  const { store } = harness
  const id = store.state.choice!.id
  const edits = outsideEdits(app, harness.held, async (document) => {
    // Another tab of the app saved, then this tab reads the browser's document again, as an import does.
    await replaceBrowserDocument(id, encodeDocument(document))
    await store.replaceLocalWorkbook(document, 'Books')
  })
  return { store, ...edits, held: async () => (await browserDocumentHome(id).read(null)).text }
}

/**
 * One kind's records for the suite, as typed fields: two valid records the app adds, one added
 * from outside, a change to the first, an optional field of the first that a change clears, null for
 * a kind with no optional field, and a record the domain refuses with what fixes it. Rules and
 * settings are never refused by their factory.
 */
interface KindFixture {
  readonly records: readonly [RecordFields, RecordFields]
  readonly outside: RecordFields
  readonly change: { readonly field: string; readonly value: FieldValue }
  readonly cleared: string | null
  readonly refused: { readonly fields: RecordFields; readonly reason: string; readonly fixed: RecordFields; readonly beside?: readonly RecordFields[] } | null
  /** Records the checks need. Those of the kind itself are left out of what the checks expect on screen. */
  readonly seed?: Seed
  /** How the app removes a record whose kind's own remove is refused while other records name it. */
  remove?(unit: UnitOfWork, records: unknown, record: unknown): void
}

const CATEGORIES = [
  { category: 'groceries', family: 'operating', bucket: 'operating' },
  { category: 'telecom', family: 'operating', bucket: 'operating' },
  { category: 'office-supplies', family: 'operating', bucket: 'operating' },
  { category: 'ai-services', family: 'operating', bucket: 'operating' },
]
const CLIENTS = [{ client: 'northwind', iban: 'GB82WEST12345698765432' }]
const ids = (prefix: string, count: number): string[] => Array.from({ length: count }, (_, index) => `00000000-0000-4000-8000-0000${prefix}${String(index + 1).padStart(6, '0')}`)
const [BILLING_A, BILLING_B, BILLING_C, BILLING_R] = ids('01', 4)
const [SPLIT_A, SPLIT_B, SPLIT_C, SPLIT_R] = ids('02', 4)
const [DISMISSAL_A, DISMISSAL_B, DISMISSAL_C, DISMISSAL_R] = ids('03', 4)
const [ADVANCE_A, ADVANCE_B, ADVANCE_C, ADVANCE_R] = ids('04', 4)
const [ASSET_A, ASSET_B, ASSET_C, ASSET_R] = ids('05', 4)
const [YEAR_END_A, YEAR_END_B, YEAR_END_C, YEAR_END_R] = ids('06', 4)
const [PLAN_A, PLAN_B, PLAN_C, PLAN_R] = ids('07', 4)
const SPLIT_ROW = { date: '2026-10-05', account: 'main', row_amount: '-10.00', row_balance: '90.00' }

const COMPANY_FIXTURES: Readonly<Record<string, KindFixture>> = {
  'ledger-row': {
    seed: { category: CATEGORIES },
    records: [
      {
        date: '2026-10-05',
        account: 'main',
        statement: 's-1',
        counterparty: 'Corner Shop',
        description: 'Card purchase',
        amount: '-12.50',
        balance: '987.50',
        category: 'groceries',
        flagged_by: 'ai',
        reference: '00123',
        owner_share: '40',
      },
      {
        date: '2026-10-05',
        account: 'spare',
        statement: 's-2',
        counterparty: 'Bank',
        description: 'Fee',
        amount: '-1.00',
        balance: '99.00',
        category: 'telecom',
        flagged_by: 'rule',
        reference: 'R-B',
      },
    ],
    outside: { date: '2026-10-06', account: 'other', description: 'Deposit', amount: '5.00', balance: '5.00', reference: 'R-C' },
    change: { field: 'owner_share', value: '0' },
    cleared: 'owner_share',
    refused: {
      fields: { date: 'yesterday', account: 'third', amount: '-3.00', balance: '7.00', category: 'groceries', reference: 'R-X' },
      reason: 'is not a date cell',
      fixed: { date: '2026-10-07', account: 'third', amount: '-3.00', balance: '7.00', category: 'groceries', reference: 'R-X' },
    },
  },
  category: {
    records: [
      { category: 'groceries', family: 'operating', bucket: 'operating', colour: '#2a78d6', roles: 'watched', label: 'Groceries', vat: 'deductible-25', owner_share: '30' },
      { category: 'owner-benefits', family: 'owner', bucket: 'owner-pay', roles: 'owner-benefit' },
    ],
    outside: { category: 'travel', family: 'operating', bucket: 'operating' },
    change: { field: 'family', value: 'office' },
    cleared: 'colour',
    refused: { fields: { category: 'misc', family: 'operating', bucket: 'operatng' }, reason: '"operatng" is not a bucket', fixed: { category: 'misc', family: 'operating', bucket: 'operating' } },
  },
  account: {
    records: [
      { account: 'main', iban: 'GB82WEST12345698765432', currency: 'EUR', label: 'Main' },
      { account: 'spare', iban: 'DE89370400440532013000' },
    ],
    outside: { account: 'other', iban: 'GB33BUKB20201555555555' },
    change: { field: 'label', value: 'Main account' },
    cleared: 'label',
    refused: { fields: { iban: 'FR1420041010050500013M02606' }, reason: 'no account name', fixed: { account: 'third', iban: 'FR1420041010050500013M02606' } },
  },
  client: {
    records: [
      { client: 'northwind', name: 'Northwind', iban: 'GB82WEST12345698765432, IE29AIBK93115212345678', address: '1 Example Road', mail_language: 'en', reverse_charge: true },
      { client: 'lumen', iban: 'DE89370400440532013000' },
    ],
    outside: { client: 'acme', iban: 'GB33BUKB20201555555555' },
    change: { field: 'iban', value: 'GB82WEST12345698765432, IE29AIBK93115212345678, NL91ABNA0417164300' },
    cleared: 'address',
    refused: { fields: { client: 'nobank' }, reason: 'no IBAN', fixed: { client: 'nobank', iban: 'FR1420041010050500013M02606' } },
  },
  invoice: {
    seed: { client: CLIENTS },
    records: [
      { number: '0042', client: 'northwind', item: 'Work', amount: '1200.50', issued: '2026-10-05', due: '2026-11-04', period_from: '2026-09-05', period_to: '2026-10-04' },
      { number: '2-1-26', client: 'northwind', amount: '300.00', issued: '2026-10-06' },
    ],
    outside: { number: '3-1-26', client: 'northwind', amount: '10.00', issued: '2026-10-07' },
    change: { field: 'item', value: 'Work, revised' },
    cleared: 'due',
    refused: {
      fields: { number: '4-1-26', client: 'northwind', amount: 'lots', issued: '2026-10-08' },
      reason: 'is not a number',
      fixed: { number: '4-1-26', client: 'northwind', amount: '50.00', issued: '2026-10-08' },
    },
  },
  'billing-item': {
    seed: { client: CLIENTS },
    records: [
      { item: 'Monthly Fee', date: '2026-10-05', amount: '100.00', client: 'northwind', description: 'Fee', id: BILLING_A! },
      { item: 'Bonus', date: '2026-10-06', amount: '50.00', client: 'northwind', id: BILLING_B! },
    ],
    outside: { item: 'Hotel', date: '2026-10-07', amount: '80.00', client: 'northwind', id: BILLING_C! },
    change: { field: 'description', value: 'October fee' },
    cleared: 'description',
    refused: {
      fields: { item: 'Extra', date: '2026-10-08', amount: '-5.00', client: 'northwind', id: BILLING_R! },
      reason: 'must be more than zero',
      fixed: { item: 'Extra', date: '2026-10-08', amount: '5.00', client: 'northwind', id: BILLING_R! },
    },
  },
  'split-part': {
    seed: { category: CATEGORIES, 'ledger-row': [{ date: '2026-10-05', account: 'main', description: 'Card purchase', amount: '-10.00', balance: '90.00', category: 'groceries', reference: 'R-S' }] },
    records: [
      { ...SPLIT_ROW, amount: '-6.00', category: 'groceries', note: 'Food', owner_share: '25', id: SPLIT_A! },
      { ...SPLIT_ROW, amount: '-4.00', category: 'telecom', id: SPLIT_B! },
    ],
    outside: { date: '2026-06-27', account: 'main', row_amount: '-3.00', row_balance: '50.00', amount: '-3.00', category: 'telecom', id: SPLIT_C! },
    change: { field: 'note', value: 'Food and drink' },
    cleared: 'note',
    refused: {
      fields: { ...SPLIT_ROW, amount: 'six', category: 'groceries', id: SPLIT_R! },
      reason: 'is not a number',
      fixed: { ...SPLIT_ROW, amount: '-6.00', category: 'groceries', id: SPLIT_R! },
      beside: [{ ...SPLIT_ROW, amount: '-4.00', category: 'telecom', id: SPLIT_B! }],
    },
  },
  dismissal: {
    records: [
      { kind: 'not-covered', key: 'name:corner shop', category: 'groceries', dismissed_on: '2026-10-05', id: DISMISSAL_A! },
      { kind: 'exception', key: 'name:bank|bank-fees', id: DISMISSAL_B! },
    ],
    outside: { kind: 'not-covered', key: 'name:kiosk', id: DISMISSAL_C! },
    change: { field: 'category', value: 'telecom' },
    cleared: 'dismissed_on',
    refused: { fields: { kind: 'maybe', key: 'name:x', id: DISMISSAL_R! }, reason: 'is not a kind of suggestion', fixed: { kind: 'not-covered', key: 'name:x', id: DISMISSAL_R! } },
  },
  setting: {
    records: [
      { key: 'review_label', value: 'tester' },
      { key: 'invoice_place', value: 'Testtown' },
    ],
    outside: { key: 'invoice_country', value: 'Testland' },
    change: { field: 'value', value: 'reviewer' },
    cleared: 'value',
    refused: null,
  },
  rule: {
    records: [
      { rule: 'shop', order: '100', enabled: true, counterparty_contains: 'SHOP', confidence: 'review', note: 'Shops' },
      { rule: 'bank', order: '200', enabled: false, confidence: 'review' },
    ],
    outside: { rule: 'other', order: '300', enabled: true, description_contains: 'X', confidence: 'review' },
    change: { field: 'note', value: 'Corner shops' },
    cleared: 'note',
    refused: null,
  },
  'hr-doo.owner-advance': {
    seed: { category: CATEGORIES },
    records: [
      { date: '2026-10-05', amount: '12.50', description: 'Pens', category: 'office-supplies', owner_share: '0', id: ADVANCE_A! },
      { date: '2026-10-06', amount: '3.00', category: 'office-supplies', id: ADVANCE_B! },
    ],
    outside: { date: '2026-10-07', amount: '7.00', category: 'telecom', id: ADVANCE_C! },
    change: { field: 'owner_share', value: '60' },
    cleared: 'owner_share',
    refused: {
      fields: { date: '2026-10-07', amount: '-4.00', category: 'office-supplies', id: ADVANCE_R! },
      reason: 'belongs on the splits tab',
      fixed: { date: '2026-10-07', amount: '4.00', category: 'office-supplies', id: ADVANCE_R! },
    },
  },
  'hr-doo.asset': {
    records: [
      { asset: 'Laptop', bought: '2026-10-05', in_use: '2026-10-07', cost_net: '1500.75', group: 'computers', doubled: true, ledger_reference: 'REF-1', note: 'Work laptop', id: ASSET_A! },
      { asset: 'Desk', bought: '2026-10-06', cost_net: '200.00', group: 'equipment', id: ASSET_B! },
    ],
    outside: { asset: 'Lamp', bought: '2026-10-07', cost_net: '40.00', group: 'equipment', id: ASSET_C! },
    change: { field: 'note', value: 'Laptop for work' },
    cleared: 'note',
    refused: {
      fields: { asset: 'Chair', bought: '2026-10-06', cost_net: '100.00', group: 'sofa', id: ASSET_R! },
      reason: '"sofa" is not a group',
      fixed: { asset: 'Chair', bought: '2026-10-06', cost_net: '100.00', group: 'equipment', id: ASSET_R! },
    },
  },
  'hr-doo.grant': {
    records: [
      {
        grant: 'start-grant',
        received: '2026-10-05',
        amount: '1000.00',
        fixed_part: '400.00',
        variable_part: '600.00',
        period_from: '2026-10-05',
        period_to: '2027-10-04',
        release: 'fixed-then-assets',
        clawback_year1: 'whole',
        clawback_year2: '250.00',
        employment_required_until: '2027-10-04',
        note: 'Start-up grant',
      },
      { grant: 'second-grant', received: '2026-10-06', amount: '500.00', release: 'straight-line', period_from: '2026-10-06', period_to: '2027-10-05' },
    ],
    outside: { grant: 'third-grant', received: '2026-10-07', amount: '100.00', fixed_part: '100.00', variable_part: '0.00' },
    change: { field: 'note', value: 'Regional start-up grant' },
    cleared: 'note',
    refused: {
      fields: { grant: 'bad-grant', received: '2026-10-05', amount: '100.00', fixed_part: '30.00', variable_part: '30.00' },
      reason: 'add up to',
      fixed: { grant: 'bad-grant', received: '2026-10-05', amount: '100.00', fixed_part: '30.00', variable_part: '70.00' },
    },
  },
  'hr-doo.year-end-line': {
    records: [
      { year: '2025', statement: 'pl', line: 'sales', label: 'Sales', amount: '57000.50', source: 'package.pdf', note: 'As filed', id: YEAR_END_A! },
      { year: '2025', statement: 'pl', line: 'other-operating-income', amount: '2050.00', id: YEAR_END_B! },
    ],
    outside: { year: '2025', statement: 'pl', line: 'financial-income', amount: '0.04', id: YEAR_END_C! },
    change: { field: 'label', value: 'Sales revenue' },
    cleared: 'note',
    refused: {
      fields: { year: '2024', statement: 'pl', line: 'nonsense', amount: '1.00', id: YEAR_END_R! },
      reason: 'is not a line of pl',
      fixed: { year: '2024', statement: 'pl', line: 'sales', amount: '1.00', id: YEAR_END_R! },
    },
  },
  'hr-doo.plan-line': {
    seed: { category: CATEGORIES },
    records: [
      { year: '2027', month: '5', item: 'ai-services', amount: '20.00', note: 'Seats', id: PLAN_A! },
      { year: '2027', item: 'purchase', amount: '420.00', note: 'Monitor', date: '2027-01-13', group: 'equipment', id: PLAN_B! },
    ],
    outside: { year: '2027', month: '7', item: 'telecom', amount: '15.00', id: PLAN_C! },
    change: { field: 'note', value: 'More seats' },
    cleared: 'note',
    refused: {
      fields: { year: '2027', month: '13', item: 'ai-services', amount: '5.00', id: PLAN_R! },
      reason: 'is not a month',
      fixed: { year: '2027', month: '6', item: 'ai-services', amount: '5.00', id: PLAN_R! },
    },
  },
  'hr-doo.scenario-component': {
    records: [
      { scenario: 'base', label: 'Base', year: '2027', component: 'salary_gross', amount: 'floor' },
      { scenario: 'base', year: '2027', component: 'dividend', amount: 'max' },
    ],
    outside: { scenario: 'other', label: 'Other', year: '2027', component: 'salary_gross', amount: 'floor' },
    change: { field: 'label', value: 'Base pay' },
    cleared: 'label',
    refused: {
      fields: { scenario: 'third', year: '2027', component: 'salary_gross', amount: 'floor', from: '2025-12-09' },
      reason: 'is outside 2027',
      fixed: { scenario: 'third', year: '2027', component: 'salary_gross', amount: 'floor', from: '2027-01-13' },
    },
  },
  'hr-doo.employee': {
    records: [
      { employee: 'dora', name: 'Dora Example', residence_city: 'Zagreb', pension_pillar_2: true, dependants: '2', birth_year: '1990', from: '2025-06-05', director: true },
      { employee: 'ivo', name: 'Ivo Example', residence_city: 'Split', from: '2026-01-12', to: '2026-12-31' },
    ],
    outside: { employee: 'ana', residence_city: 'Rijeka', pension_pillar_2: true, from: '2026-03-01' },
    change: { field: 'name', value: 'Dora Example-Horvat' },
    cleared: 'name',
    refused: {
      fields: { employee: 'mia', residence_city: 'Atlantida', from: '2026-02-01' },
      reason: 'is not a Croatian city or municipality',
      fixed: { employee: 'mia', residence_city: 'Osijek', from: '2026-02-01' },
    },
  },
}

const [BANK_LOAN_A, BANK_LOAN_B, BANK_LOAN_C, BANK_LOAN_R] = ids('11', 4)
const [RATE_A, RATE_B, RATE_C, RATE_R, RATE_FIRST, RATE_FIRST_A, RATE_FIRST_B, RATE_FIRST_C, RATE_FIRST_R] = ids('12', 9)
const [EXTRA_A, EXTRA_B, EXTRA_C, EXTRA_R] = ids('13', 4)
const [LATE_A, LATE_B, LATE_C, LATE_R] = ids('14', 4)
const [INFORMAL_A, INFORMAL_B, INFORMAL_C, INFORMAL_R] = ids('15', 4)
const [MOVEMENT_A, MOVEMENT_B, MOVEMENT_C, MOVEMENT_R] = ids('16', 4)
const [CAR_LOAN, FRIEND_LOAN] = ids('17', 2)

/** 1,200.00 repaid in 12 instalments from 2026-02-05, and its rate from the first instalment, which every bank loan needs. */
const CAR_LOAN_SEED: Seed = {
  'bank-loan': [{ name: 'Car loan', principal: '1200.00', drawdown: '2026-01-05', first_instalment: '2026-02-05', instalments: '12', id: CAR_LOAN! }],
  'rate-period': [{ loan: CAR_LOAN!, from: '2026-02-05', rate: '6', rate_type: 'fixed', id: RATE_FIRST! }],
}

const rateFrom = (loan: string, from: string, id: string): RecordFields => ({ loan, from, rate: '5', rate_type: 'fixed', id })

const LOANS_FIXTURES: Readonly<Record<string, KindFixture>> = {
  'bank-loan': {
    seed: {
      'rate-period': [
        rateFrom(BANK_LOAN_A!, '2026-02-05', RATE_FIRST_A!),
        rateFrom(BANK_LOAN_B!, '2026-04-10', RATE_FIRST_B!),
        rateFrom(BANK_LOAN_C!, '2026-06-01', RATE_FIRST_C!),
        rateFrom(BANK_LOAN_R!, '2026-07-01', RATE_FIRST_R!),
      ],
    },
    records: [
      {
        name: 'Car loan',
        lender: 'Example Bank',
        principal: '1200.00',
        drawdown: '2026-01-05',
        first_instalment: '2026-02-05',
        instalments: '12',
        interim_interest: '3.50',
        interim_interest_date: '2026-01-20',
        subsidy_monthly: '10.00',
        subsidy_first_instalment: '1',
        subsidy_instalments: '6',
        subsidy_payer: 'APN',
        note: 'Family car',
        id: BANK_LOAN_A!,
      },
      { name: 'Boat loan', principal: '5000.00', drawdown: '2026-03-10', first_instalment: '2026-04-10', instalments: '24', id: BANK_LOAN_B! },
    ],
    outside: { name: 'Bike loan', principal: '300.00', drawdown: '2026-05-01', first_instalment: '2026-06-01', instalments: '6', id: BANK_LOAN_C! },
    change: { field: 'lender', value: 'Other Bank' },
    cleared: 'subsidy_payer',
    refused: {
      fields: { name: 'Sofa loan', principal: '800.00', drawdown: '2026-06-01', first_instalment: '2026-07-01', instalments: '0', id: BANK_LOAN_R! },
      reason: 'is not a whole number above zero',
      fixed: { name: 'Sofa loan', principal: '800.00', drawdown: '2026-06-01', first_instalment: '2026-07-01', instalments: '8', id: BANK_LOAN_R! },
    },
    remove: removeBankLoan,
  },
  'rate-period': {
    seed: CAR_LOAN_SEED,
    records: [
      { loan: CAR_LOAN!, from: '2026-05-05', rate: '4.25', rate_type: 'variable', note: 'Euribor plus 2', id: RATE_A! },
      { loan: CAR_LOAN!, from: '2026-08-05', rate: '3', rate_type: 'fixed', id: RATE_B! },
    ],
    outside: { loan: CAR_LOAN!, from: '2026-11-05', rate: '2.5', rate_type: 'fixed', id: RATE_C! },
    change: { field: 'note', value: 'Euribor plus 2.5' },
    cleared: 'note',
    refused: {
      fields: { loan: CAR_LOAN!, from: '2026-10-05', rate: 'lots', rate_type: 'fixed', id: RATE_R! },
      reason: 'is not a yearly percent',
      fixed: { loan: CAR_LOAN!, from: '2026-10-05', rate: '3.5', rate_type: 'fixed', id: RATE_R! },
    },
  },
  'extra-payment': {
    seed: CAR_LOAN_SEED,
    records: [
      { loan: CAR_LOAN!, date: '2026-04-05', amount: '100.00', effect: 'shorter-term', id: EXTRA_A! },
      { loan: CAR_LOAN!, date: '2026-06-05', amount: '200.00', effect: 'lower-instalment', id: EXTRA_B! },
    ],
    outside: { loan: CAR_LOAN!, date: '2026-08-05', amount: '50.00', effect: 'shorter-term', id: EXTRA_C! },
    change: { field: 'effect', value: 'lower-instalment' },
    cleared: null,
    refused: {
      fields: { loan: CAR_LOAN!, date: '2026-09-05', amount: '20.00', effect: 'sooner', id: EXTRA_R! },
      reason: 'is not a payment effect',
      fixed: { loan: CAR_LOAN!, date: '2026-09-05', amount: '20.00', effect: 'shorter-term', id: EXTRA_R! },
    },
  },
  'late-instalment': {
    seed: CAR_LOAN_SEED,
    records: [
      { loan: CAR_LOAN!, due: '2026-03-05', paid: '2026-03-20', id: LATE_A! },
      { loan: CAR_LOAN!, due: '2026-04-05', paid: '2026-04-08', id: LATE_B! },
    ],
    outside: { loan: CAR_LOAN!, due: '2026-05-05', paid: '2026-05-07', id: LATE_C! },
    change: { field: 'paid', value: '2026-03-25' },
    cleared: null,
    refused: {
      fields: { loan: CAR_LOAN!, due: '2026-06-05', paid: '2026-06-01', id: LATE_R! },
      reason: 'is not after the due date',
      fixed: { loan: CAR_LOAN!, due: '2026-06-05', paid: '2026-06-09', id: LATE_R! },
    },
  },
  'informal-loan': {
    records: [
      { name: 'From Ana', counterparty: 'Ana', direction: 'you-owe', opening_balance: '3000.00', start: '2026-03-01', note: 'For the boat', id: INFORMAL_A! },
      { name: 'To Marko', direction: 'owed-to-you', opening_balance: '150.00', start: '2026-04-01', id: INFORMAL_B! },
    ],
    outside: { name: 'From Iva', direction: 'you-owe', opening_balance: '40.00', start: '2026-05-01', id: INFORMAL_C! },
    change: { field: 'counterparty', value: 'Ana Example' },
    cleared: 'note',
    refused: {
      fields: { name: 'To Luka', direction: 'sideways', opening_balance: '60.00', start: '2026-06-01', id: INFORMAL_R! },
      reason: 'is not a direction',
      fixed: { name: 'To Luka', direction: 'owed-to-you', opening_balance: '60.00', start: '2026-06-01', id: INFORMAL_R! },
    },
  },
  movement: {
    seed: { 'informal-loan': [{ name: 'From Ana', direction: 'you-owe', opening_balance: '3000.00', start: '2026-03-01', id: FRIEND_LOAN! }] },
    records: [
      { loan: FRIEND_LOAN!, date: '2026-04-01', kind: 'repaid', amount: '500.00', note: 'First repayment', id: MOVEMENT_A! },
      { loan: FRIEND_LOAN!, date: '2026-04-20', kind: 'borrowed', amount: '250.00', id: MOVEMENT_B! },
    ],
    outside: { loan: FRIEND_LOAN!, date: '2026-05-01', kind: 'forgiven', amount: '100.00', id: MOVEMENT_C! },
    change: { field: 'note', value: 'First repayment, in cash' },
    cleared: 'note',
    refused: {
      fields: { loan: FRIEND_LOAN!, date: '2026-06-01', kind: 'lent', amount: '30.00', id: MOVEMENT_R! },
      reason: 'is not a movement kind',
      fixed: { loan: FRIEND_LOAN!, date: '2026-06-01', kind: 'borrowed-in-kind', amount: '30.00', id: MOVEMENT_R! },
    },
  },
}

const CORE_WRITES: readonly WriteRules<unknown>[] = [
  LEDGER_WRITES,
  CATEGORY_WRITES,
  ACCOUNT_WRITES,
  CLIENT_WRITES,
  INVOICE_WRITES,
  BILLING_WRITES,
  SPLIT_WRITES,
  DISMISSAL_WRITES,
  SETTING_WRITES,
  RULE_WRITES,
]

const COMPANY_KINDS = [...CORE_WRITES, ...installedPack().workbook!.kinds].map((rules) => [rules.kind.name, rules] as const)

const LOANS_WRITES: readonly WriteRules<unknown>[] = [BANK_LOAN_WRITES, RATE_PERIOD_WRITES, EXTRA_PAYMENT_WRITES, LATE_INSTALMENT_WRITES, INFORMAL_LOAN_WRITES, MOVEMENT_WRITES]

const LOANS_KINDS = LOANS_WRITES.map((rules) => [rules.kind.name, rules] as const)

/** Every kind with the app whose document keeps it and its fixture. */
const KINDS: readonly (readonly [string, WriteRules<unknown>, AppUnderTest<BooksRead>, KindFixture])[] = [
  ...COMPANY_KINDS.map(([name, rules]) => [name, rules, COMPANY, COMPANY_FIXTURES[name]!] as const),
  ...LOANS_KINDS.map(([name, rules]) => [name, rules, LOANS, LOANS_FIXTURES[name]!] as const),
]

const STORAGES = [
  ['a file on Drive', driveStorage],
  ['the document kept in this browser', browserStorage],
] as const

it('has a fixture for every kind, core’s and the pack’s', () => {
  expect(COMPANY_KINDS.map(([name]) => name).filter((name) => COMPANY_FIXTURES[name] === undefined)).toEqual([])
  expect(COMPANY_KINDS).toHaveLength(17)
})

it('has a fixture for every Loans kind', () => {
  expect(LOANS_KINDS.map(([name]) => name).filter((name) => LOANS_FIXTURES[name] === undefined)).toEqual([])
  expect(LOANS_KINDS).toHaveLength(6)
})

describe.each(STORAGES)('records kept in %s', (_storage, open) => {
  describe.each(KINDS)('of the kind %s', (name, rules, app, fixture) => {
    const { kind } = rules
    const [first, second] = fixture.records
    const firstId = idOf(app, kind, first)
    const seeded = (fixture.seed?.[name] ?? []).map((fields) => idOf(app, kind, fields))

    /** The ids of the kind's records on screen, less those the seed holds. */
    function idsOnScreen(store: StorageUnderTest<BooksRead>['store']): (RecordId | null)[] {
      return recordsOnScreen(store, kind, app)
        .records.map((stored) => stored.id)
        .filter((id) => id === null || !seeded.includes(id))
    }

    function removeAll(store: StorageUnderTest<BooksRead>['store'], records: readonly unknown[]): Promise<unknown> {
      return store.write('Removed', (unit) => records.forEach((record) => (fixture.remove === undefined ? unit.of(rules).remove(record) : fixture.remove(unit, store.state.records, record))))
    }

    async function withBoth(): Promise<StorageUnderTest<BooksRead>> {
      const storage = await open(app, fixture.seed ?? {})
      await storage.store.write('Added', (unit) => fixture.records.forEach((fields) => unit.of(rules).add(recordOf(app, kind, fields))))
      return storage
    }

    it(fixture.cleared === null ? 'reads a record back as written, field by field' : 'reads a record back as written, field by field, and a cleared field reads blank', async () => {
      const { store } = await withBoth()

      for (const fields of fixture.records) {
        expect(recordOnScreen(store, kind, idOf(app, kind, fields), app).record).toEqual(recordOf(app, kind, fields))
      }
      if (fixture.cleared === null) return
      const cleared = { ...first, [fixture.cleared]: '' }
      await store.write('Cleared', (unit) => unit.of(rules).change(recordOnScreen(store, kind, firstId, app).record, recordOf(app, kind, cleared)))
      expect(recordOnScreen(store, kind, firstId, app).record).toEqual(recordOf(app, kind, cleared))
      expect(recordOnScreen(store, kind, firstId, app).fields[fixture.cleared]).toBeUndefined()
    })

    it('finds the records it changes and removes by identity, after a record was added ahead of them from outside', async () => {
      const storage = await withBoth()
      const { store } = storage
      await storage.addOutside(kind, fixture.outside)

      const changed = { ...first, [fixture.change.field]: fixture.change.value }
      await store.write('Changed', (unit) => unit.of(rules).change(recordOnScreen(store, kind, firstId, app).record, recordOf(app, kind, changed)))
      expect(recordOnScreen(store, kind, firstId, app).record).toEqual(recordOf(app, kind, changed))

      const both = fixture.records.map((fields) => recordOnScreen(store, kind, idOf(app, kind, fields), app).record)
      await removeAll(store, both)
      expect(idsOnScreen(store)).toEqual([idOf(app, kind, fixture.outside)])
    })

    it('refuses work that awaits before it makes its changes, and writes nothing', async () => {
      const storage = await withBoth()
      const { store } = storage
      const held = await storage.held()
      const changed = recordOf(app, kind, { ...first, [fixture.change.field]: fixture.change.value })

      const awaiting = store.write('Changed', async (unit) => {
        await Promise.resolve()
        unit.of(rules).change(recordOnScreen(store, kind, firstId, app).record, changed)
      })

      await expect(awaiting).rejects.toThrow('before it returns')
      expect(await storage.held()).toBe(held)
    })

    it('refuses a change to a record that differs from what the app read, or is gone, and writes nothing', async () => {
      const storage = await withBoth()
      const { store } = storage
      const stale = recordOnScreen(store, kind, firstId, app).record
      const changed = recordOf(app, kind, { ...first, [fixture.change.field]: fixture.change.value })
      await storage.changeOutside(kind, firstId, fixture.change.field, 'edited outside')
      const held = await storage.held()

      await expect(store.write('Changed', (unit) => unit.of(rules).change(stale, changed))).rejects.toThrow('changed since the app read it')
      expect(await storage.held()).toBe(held)

      await storage.removeOutside(kind, firstId)
      const gone = await storage.held()
      await expect(store.write('Changed', (unit) => unit.of(rules).change(stale, changed))).rejects.toThrow(WorkbookWriteRefused)
      await expect(store.write('Removed', (unit) => unit.of(rules).remove(stale))).rejects.toThrow('is no longer in the workbook')
      expect(await storage.held()).toBe(gone)
      expect(idsOnScreen(store)).toEqual([idOf(app, kind, second)])
    })

    it.skipIf(fixture.refused === null)(
      rules.changeable === undefined
        ? 'reads a refused record with its fields and reason, and stores it repaired as a valid record'
        : 'reads a refused record with its fields and reason, and leaves its repair to the workbook',
      async () => {
        const refused = fixture.refused!
        const storage = await open(app, fixture.seed ?? {})
        for (const fields of [...(refused.beside ?? []), refused.fields]) {
          await storage.addOutside(kind, fields)
        }
        const { store } = storage
        const [held] = recordsOnScreen(store, kind, app).refused

        expect(held?.reason).toContain(refused.reason)
        expect(Object.keys(held!.fields).sort()).toEqual(Object.keys(refused.fields).sort())
        expect(Object.entries(refused.fields).filter(([field, value]) => !holdsValue(held!.fields[field], value))).toEqual([])
        const repair = store.write('Repaired', (unit) => unit.of(rules).repair(held!, recordOf(app, kind, refused.fixed)))
        if (rules.changeable !== undefined) {
          await expect(repair).rejects.toThrow('is fixed in the workbook itself')
          return
        }
        await repair
        expect(recordsOnScreen(store, kind, app).refused).toEqual([])
        expect(recordOnScreen(store, kind, idOf(app, kind, refused.fixed), app).record).toEqual(recordOf(app, kind, refused.fixed))
      },
    )

    it.skipIf(fixture.refused === null || rules.changeable !== undefined)('takes a refused record out, and keeps no Undo of it', async () => {
      const refused = fixture.refused!
      const storage = await withBoth()
      for (const fields of [...(refused.beside ?? []), refused.fields]) {
        await storage.addOutside(kind, fields)
      }
      const { store } = storage
      const held = recordsOnScreen(store, kind, app).refused.find((candidate) => candidate.reason.includes(refused.reason))

      await store.write('Discarded', (unit) => unit.of(rules).discard(held!))

      expect(recordsOnScreen(store, kind, app).refused.filter((candidate) => candidate.reason.includes(refused.reason))).toEqual([])
      expect(canUndo(store.state.writes[0]!, store.state.writes)).toBe(false)
    })

    it(rules.undoable ? 'brings removed records back with the same identity on Undo' : 'keeps no Undo', async () => {
      const storage = await withBoth()
      const { store } = storage
      await storage.addOutside(kind, fixture.outside)
      const both = fixture.records.map((fields) => recordOnScreen(store, kind, idOf(app, kind, fields), app).record)
      await removeAll(store, both)
      const [removed] = store.state.writes

      expect(canUndo(removed!, store.state.writes)).toBe(rules.undoable)
      if (!rules.undoable) {
        await expect(store.undo(removed!)).rejects.toThrow('cannot be undone')
        return
      }
      await store.undo(removed!)
      expect(fixture.records.map((fields) => recordOnScreen(store, kind, idOf(app, kind, fields), app).record)).toEqual(both)
      await expect(store.undo(removed!)).rejects.toThrow('cannot be undone')
    })
  })

  describe('a write across two kinds', () => {
    const category = { category: 'groceries', family: 'operating', bucket: 'operating' }
    const client = { client: 'northwind', iban: 'GB82WEST12345698765432' }

    it('applies whole', async () => {
      const storage = await open(COMPANY, {})
      const { store } = storage

      await store.write('Added', (unit) => {
        unit.of(CATEGORY_WRITES).add(recordOf(COMPANY, CATEGORY_RECORDS, category))
        unit.of(CLIENT_WRITES).add(recordOf(COMPANY, CLIENT_RECORDS, client))
      })

      expect(store.state.workbook!.categories.map((held) => held.slug)).toEqual(['groceries'])
      expect(store.state.workbook!.clients.map((held) => held.slug)).toEqual(['northwind'])
      expect(store.state.writes).toHaveLength(1)
    })

    it('or not at all, when one kind refuses its part', async () => {
      const storage = await open(COMPANY, {})
      const { store } = storage
      const held = await storage.held()

      await expect(
        store.write('Added', (unit) => {
          unit.of(CATEGORY_WRITES).add(recordOf(COMPANY, CATEGORY_RECORDS, category))
          unit.of(INVOICE_WRITES).add(recordOf(COMPANY, INVOICE_RECORDS, { number: '1-1-26', client: 'nobody', amount: '10.00', issued: '2026-10-05' }))
        }),
      ).rejects.toThrow('nobody is not on the clients tab')

      expect(await storage.held()).toBe(held)
      expect(store.state.workbook!.categories).toEqual([])
      expect(store.state.writes).toEqual([])
    })
  })
})
