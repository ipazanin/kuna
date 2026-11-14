import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { spendingFigures } from '../src/apps/spending/analytics/presentation/spendingFigures'
import { linkEntry, unlinkEntry } from '../src/apps/spending/entries/application/entryWrites'
import type { LinkPlace } from '../src/apps/spending/entries/application/entryWrites'
import { loanTargetsFrom } from '../src/apps/spending/links/application/loanTargets'
import { beyondPlan, linkFiling, splitByInstalment } from '../src/apps/spending/links/domain/instalmentSplit'
import type { InstalmentSplit } from '../src/apps/spending/links/domain/instalmentSplit'
import { linkStateOf, targetsFor } from '../src/apps/spending/links/domain/linkTarget'
import type { InstalmentTarget, LinkTarget } from '../src/apps/spending/links/domain/linkTarget'
import { BLANK_CELLS, storedRowOf } from '../src/apps/spending/workbook/domain/transaction'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { month } from './fixtures/ledger'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'
import { rowLinkOf, rowLinkText } from '../src/apps/spending/workbook/domain/rowLink'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { moneyFromAmount } from '../src/shared/money/money'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, ITEM_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { rowLinksOf } from '../src/apps/spending/facts'
import { DESK_LOAN_TARGETS } from './fixtures/spendingDesk'
import { ACCOUNTS, CATEGORIES, OTP, REVOLUT_USD, category, row, wholeItems } from './fixtures/spending'

const on = (date: string) => parseCivilDate(date)!
const LOAN = '3f6c1e2a-0000-4000-8000-000000000001'

describe("a Spending row's link", () => {
  it('reads app/kind/key with a due date for an instalment, and writes it back as it read it', () => {
    const texts = [`loans/bank-loan/${LOAN}/2026-11-15`, `loans/informal-loan/${LOAN}`, 'hr-doo.trip/ledger-row/a1b2']
    expect(texts.map(rowLinkOf)).toEqual([
      { app: 'loans', kind: 'bank-loan', key: LOAN, due: on('2026-11-15') },
      { app: 'loans', kind: 'informal-loan', key: LOAN, due: null },
      { app: 'hr-doo.trip', kind: 'ledger-row', key: 'a1b2', due: null },
    ])
    expect(texts.map((text) => rowLinkText(rowLinkOf(text)!))).toEqual(texts)
  })

  it('reads no link from text with a part missing, a due date that is no day, a part too many, or a space in its key', () => {
    for (const text of ['loans', 'loans/bank-loan', `loans/bank-loan/${LOAN}/15.11.2026`, `loans/bank-loan/${LOAN}/2026-11-15/x`, 'Loans/bank-loan/a', 'loans/bank-loan/a b', '/bank-loan/a']) {
      expect(rowLinkOf(text), text).toBeNull()
    }
  })

  it('is kept in the row it links, written back as it was read, and a link of another shape refuses the row', () => {
    const codec = codecOfSpendingKind(TRANSACTION_RECORDS)
    const fields = { account: LOAN, date: '2026-11-15', amount: '-650.00', payee: 'Example Bank', source: 'statement', link: `loans/bank-loan/${LOAN}/2026-11-15` }
    const read = (link: string) => codec.make(storedFieldsOfValues({ ...fields, link }), recordIdOf(TRANSACTION_RECORDS, LOAN))
    expect(codec.fieldsOf(read(fields.link))).toMatchObject({ link: fields.link })
    expect(() => read('loans/bank-loan')).toThrow('loans/bank-loan')
  })

  it('reads as the record Loans has, as Loans still opening, failed or not set up, and as gone when Loans has no such record or the app is not Loans', () => {
    const october = { app: 'loans', kind: 'bank-loan', key: 'made-up-housing-loan', due: on('2026-10-15') }
    expect(linkStateOf(october, DESK_LOAN_TARGETS)).toEqual({ state: 'there', target: DESK_LOAN_TARGETS[0] })
    expect([null, 'opening', 'failed'].map((loans) => linkStateOf(october, loans as null | 'opening' | 'failed').state)).toEqual(['not-set-up', 'opening', 'failed'])
    expect(linkStateOf({ ...october, due: on('2026-10-16') }, DESK_LOAN_TARGETS).state).toBe('gone')
    expect(linkStateOf({ ...october, due: null }, DESK_LOAN_TARGETS).state).toBe('gone')
    expect(linkStateOf({ ...october, app: 'company' }, DESK_LOAN_TARGETS).state).toBe('gone')
  })

  it("names an instalment and interim interest by its loan's key and due date, and an informal loan by its key, as Loans publishes them", () => {
    const to = { path: '/loans' }
    const targets = loanTargetsFrom({
      instalments: [
        { kind: 'interim-interest', loan: LOAN, loanName: 'Home loan', due: on('2026-10-31'), yourShare: moneyFromAmount(80), interest: moneyFromAmount(80), principal: moneyFromAmount(0), to },
        { kind: 'instalment', loan: LOAN, loanName: 'Home loan', due: on('2026-11-20'), yourShare: moneyFromAmount(650), interest: moneyFromAmount(250), principal: moneyFromAmount(400), to },
      ],
      informalLoans: [{ key: 'b', name: 'From Marko', counterparty: 'Marko', direction: 'you-owe', to }],
    })
    expect(targets.map((target) => rowLinkText(target.link))).toEqual([`loans/bank-loan/${LOAN}/2026-10-31`, `loans/bank-loan/${LOAN}/2026-11-20`, 'loans/informal-loan/b'])
    expect(targets.map((target) => target.kind === 'instalment' && target.interim)).toEqual([true, false, false])
  })

  it('publishes each linked row with its account, day, amount in its own currency and the record it names, and no row without a link', () => {
    const link = rowLinkOf(`loans/bank-loan/${LOAN}/2026-11-20`)!
    const linked = row(ACCOUNTS[0]!, '2026-11-20', -650, 'Money and fees/Loan interest', { link })
    const rows = [row(ACCOUNTS[0]!, '2026-11-19', -12, 'Food/Groceries'), linked]
    const book = { accounts: ACCOUNTS, transactions: rows, items: wholeItems(rows) }
    expect(rowLinksOf(book)).toEqual([
      { row: expect.any(String), item: expect.any(String), account: expect.any(String), day: on('2026-11-20'), amount: linked.amount, currency: ACCOUNTS[0]!.currency, target: link },
    ])
  })
})

const LOAN_INTEREST = category('Money and fees/Loan interest')
const GROCERIES = category('Food/Groceries')
const PRINCIPAL = CATEGORIES.find((held) => held.kind === 'repayment')!
const NOTES = { interest: 'Interest', difference: 'Difference from the plan' }

/** A made-up instalment due on 20 November: 650.00 of your share, 250.00 of it interest and 400.00 principal. */
const INSTALMENT: InstalmentTarget = {
  kind: 'instalment',
  interim: false,
  link: { app: 'loans', kind: 'bank-loan', key: LOAN, due: on('2026-11-20') },
  loanName: 'Home loan',
  due: on('2026-11-20'),
  yourShare: moneyFromAmount(650),
  interest: moneyFromAmount(250),
  principal: moneyFromAmount(400),
}
const INFORMAL: LinkTarget = { kind: 'informal-loan', link: { app: 'loans', kind: 'informal-loan', key: 'b', due: null }, name: 'From Marko', counterparty: 'Marko', direction: 'you-owe' }

const filed = (stored: StoredRow) => ({ row: stored, items: wholeItems([stored]) })
const ON_OTP = { currency: EURO, receipt: false, categories: CATEGORIES }

describe('a row linked to a loan instalment', () => {
  it("splits into the plan's interest under its category and principal under Loan principal, the difference above or below the plan a part of its own", () => {
    const split = (amount: number) => linkFiling(filed(row(OTP, '2026-11-20', amount, 'Money and fees/Loan interest')), INSTALMENT, ON_OTP)
    const parts = (interest: number, principal: number, difference: number): InstalmentSplit => ({
      split: true,
      category: LOAN_INTEREST.id,
      interest: accountMoneyFromAmount(interest),
      principal: accountMoneyFromAmount(principal),
      difference: accountMoneyFromAmount(difference),
    })

    expect(split(-650)).toEqual(parts(-250, -400, 0))
    expect(split(-652.4)).toEqual(parts(-250, -400, -2.4))
    expect(split(-640)).toEqual(parts(-250, -400, 10))
  })

  it("links whole an informal loan, interim interest, money in, an account not in euros, a transfer's leg, a receipt's row and a row with no category", () => {
    const paid = row(OTP, '2026-11-20', -650, 'Money and fees/Loan interest')
    const why = (target: LinkTarget, entry: StoredRow = paid, on = ON_OTP) => {
      const filing = linkFiling(filed(entry), target, on)
      return filing.split ? 'split' : filing.why
    }

    expect([
      why(INFORMAL),
      why({ ...INSTALMENT, interim: true, interest: INSTALMENT.yourShare, principal: moneyFromAmount(0) }),
      why(INSTALMENT, row(OTP, '2026-11-20', 650, 'Money and fees/Loan interest')),
      why(INSTALMENT, row(REVOLUT_USD, '2026-11-20', -650, 'Money and fees/Loan interest'), { ...ON_OTP, currency: REVOLUT_USD.currency }),
      why(INSTALMENT, { ...paid, pair: row(OTP, '2026-11-20', 650, null).id }),
      why(INSTALMENT, paid, { ...ON_OTP, receipt: true }),
      why(INSTALMENT, row(OTP, '2026-11-20', -650, null)),
      why(INSTALMENT, row(OTP, '2026-11-20', -650, null, { category: PRINCIPAL.id })),
    ]).toEqual(['informal-loan', 'no-principal', 'money-in', 'not-euro', 'transfer-leg', 'receipt', 'unfiled', 'unfiled'])
  })

  it('keeps the interest under the category most of a split row is in besides Loan principal, and leaves out a part of nothing', () => {
    const spend = row(OTP, '2026-11-20', -650, null)
    const [whole] = wholeItems([spend])
    const items = [
      { ...whole!, amount: accountMoneyFromAmount(-400), category: PRINCIPAL.id },
      { ...whole!, id: recordIdOf(ITEM_RECORDS, 'second'), amount: accountMoneyFromAmount(-250), category: GROCERIES.id },
    ]
    const filing = linkFiling({ row: spend, items }, INSTALMENT, ON_OTP)
    if (!filing.split) throw new Error(`linked whole: ${filing.why}`)
    expect(filing.category).toBe(GROCERIES.id)

    const linked = splitByInstalment({ row: spend, items }, INSTALMENT.link, filing, PRINCIPAL.id, NOTES, () => 'made-up-part')
    expect(linked.items.map((part) => [part.id, part.amount, part.category, part.note, part.link])).toEqual([
      [items[0]!.id, accountMoneyFromAmount(-250), GROCERIES.id, 'Interest', INSTALMENT.link],
      [recordIdOf(ITEM_RECORDS, 'made-up-part'), accountMoneyFromAmount(-400), PRINCIPAL.id, '', INSTALMENT.link],
    ])
    expect(linked.row.categorisedBy).toBe('person')
  })

  it('says what a row on a euro account paid above or below the plan, and nothing for an account in another currency or an informal loan', () => {
    const beyond = (amount: number, currency = EURO, target: LinkTarget = INSTALMENT) => beyondPlan(target, { amount: accountMoneyFromAmount(amount) }, currency)
    expect([beyond(-652.4), beyond(-640), beyond(-650), beyond(-652.4, REVOLUT_USD.currency), beyond(-652.4, EURO, INFORMAL)]).toEqual([
      accountMoneyFromAmount(2.4),
      accountMoneyFromAmount(-10),
      accountMoneyFromAmount(0),
      null,
      null,
    ])
  })

  it('offers for money out the instalments due within half a month of its day, nearest first, and the informal loans, and for money in the informal loans only', () => {
    const due = (date: string): LinkTarget => ({ ...INSTALMENT, due: on(date), link: { ...INSTALMENT.link, due: on(date) } })
    const targets = [due('2026-10-20'), INFORMAL, due('2026-12-05'), due('2026-11-20')]
    const offered = (amount: number) =>
      targetsFor({ date: on('2026-11-22'), amount: accountMoneyFromAmount(amount) }, targets).map((target) => (target.kind === 'instalment' ? target.due : target.name))
    expect(offered(-650)).toEqual(['2026-11-20', '2026-12-05', 'From Marko'])
    expect(offered(650)).toEqual(['From Marko'])
  })
})

describe.each(['items', 'before-items'] as const)('linking a row to an instalment in a file of %s', (shape) => {
  const used = new Set<string>()
  afterEach(async () => forgetCaches(used))
  const english: LinkPlace = { currency: EURO, categories: [], language: 'en', notes: NOTES }

  function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
    const codec = codecOfSpendingKind(kind)
    return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
  }

  /** A file made before Loan principal, holding the rows. */
  async function fileWith(rows: readonly StoredRow[]): Promise<WorkbookStore<SpendingBooks>> {
    const entries =
      shape === 'before-items'
        ? stored(TRANSACTION_RECORDS, rows)
        : {
            ...stored(
              TRANSACTION_RECORDS,
              rows.map((held) => storedRowOf(held, BLANK_CELLS)),
            ),
            ...stored(ITEM_RECORDS, wholeItems(rows)),
          }
    const document = spendingDocumentOf('2026-11-20T09:00:00.000Z', {
      ...stored(ACCOUNT_RECORDS, ACCOUNTS),
      ...stored(
        CATEGORY_RECORDS,
        CATEGORIES.filter((held) => held.kind !== 'repayment'),
      ),
      ...entries,
    })
    const { store } = await browserHarness(used, document, SPENDING)
    return store
  }

  it('adds Loan principal once, splits the row so the month counts only its interest and what it paid above the plan, and Undo takes both back', async () => {
    const paid = row(OTP, '2026-11-20', -652.4, 'Money and fees/Loan interest')
    const next = row(OTP, '2026-12-20', -650, 'Money and fees/Loan interest')
    const store = await fileWith([paid, next])
    const book = () => store.state.workbook!
    const link = (entry: StoredRow, target: InstalmentTarget) =>
      store.write('Linked', (unit) =>
        linkEntry(
          unit,
          store.state.records!,
          book().transactions.find((held) => held.id === entry.id)!,
          target,
          { ...english, categories: book().categories },
        ),
      )

    await link(paid, INSTALMENT)
    const principal = book().categories.find((held) => held.kind === 'repayment')!
    expect(principal).toMatchObject({ name: 'Loan principal', parent: null })
    expect(book().problems).toEqual([])
    expect(
      book()
        .items.filter((part) => part.transaction === paid.id)
        .map((part) => [part.amount, part.category, part.note]),
    ).toEqual([
      [accountMoneyFromAmount(-250), LOAN_INTEREST.id, 'Interest'],
      [accountMoneyFromAmount(-400), principal.id, ''],
      [accountMoneyFromAmount(-2.4), LOAN_INTEREST.id, 'Difference from the plan'],
    ])
    const november = spendingFigures(book(), NO_RATES).totalsOf(month('2026-11'))
    expect([november.spent, november.byCategory.get(LOAN_INTEREST.id), november.byCategory.get(principal.id)]).toEqual([moneyFromAmount(252.4), moneyFromAmount(252.4), undefined])

    await link(next, { ...INSTALMENT, due: on('2026-12-20'), link: { ...INSTALMENT.link, due: on('2026-12-20') } })
    expect(book().categories.filter((held) => held.kind === 'repayment')).toEqual([principal])
    expect(book().problems).toEqual([])

    const [later, earlier] = store.state.writes
    await store.undo(later!)
    await store.undo(earlier!)
    expect(book().categories.some((held) => held.kind === 'repayment')).toBe(false)
    expect(book().items.filter((part) => part.transaction === paid.id)).toEqual(wholeItems([paid]))
  })

  it('takes the link off every part and leaves the parts as they are', async () => {
    const paid = row(OTP, '2026-11-20', -650, 'Money and fees/Loan interest')
    const store = await fileWith([paid])
    const book = () => store.state.workbook!
    await store.write('Linked', (unit) => linkEntry(unit, store.state.records!, book().transactions[0]!, INSTALMENT, { ...english, categories: book().categories }))
    const split = book().items

    await store.write('Unlinked', (unit) => unlinkEntry(unit, store.state.records!, book().transactions[0]!))

    expect(book().items).toEqual(split.map((part) => ({ ...part, link: null })))
  })
})
