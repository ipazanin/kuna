import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { spendingFigures } from '../src/apps/spending/analytics/domain/spendingFigures'
import { linkEntries, linkEntry, unlinkEntry, writeEntrySplit } from '../src/apps/spending/entries/application/entryWrites'
import { entrySplit } from '../src/apps/spending/entries/domain/entrySplit'
import type { LinkPlace } from '../src/apps/spending/links/domain/instalmentSplit'
import { loanTargetsFrom } from '../src/apps/spending/links/application/loanTargets'
import { linkLineOf, targetLineOf } from '../src/apps/spending/links/presentation/linkLine'
import { beyondPlan, linkFiling, linkedEntry, splitByInstalment } from '../src/apps/spending/links/domain/instalmentSplit'
import type { InstalmentSplit } from '../src/apps/spending/links/domain/instalmentSplit'
import { linkStateOf, movementKindsFor, targetsFor } from '../src/apps/spending/links/domain/linkTarget'
import type { InstalmentTarget, LinkTarget, LoanDirection, MovementKind } from '../src/apps/spending/links/domain/linkTarget'
import { BLANK_CELLS, storedRowOf } from '../src/apps/spending/workbook/domain/transaction'
import { waitsOnReview } from '../src/apps/spending/workbook/domain/rowItems'
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
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, ITEM_RECORDS, LABEL_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { rowLinksOf } from '../src/apps/spending/facts'
import { DESK_LOAN_TARGETS } from './fixtures/spendingDesk'
import { ACCOUNTS, CATEGORIES, OTP, REVOLUT_USD, category, row, spendingBook, wholeItems } from './fixtures/spending'
import { writeDryRun } from '../src/apps/spending/statements/application/statementWrites'
import { writeReceiptSplit } from '../src/apps/spending/receipts/application/receiptWrites'
import { receiptSplit } from '../src/apps/spending/receipts/domain/receiptSplit'
import type { ReceiptDraft } from '../src/apps/spending/receipts/domain/receiptSplit'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import type { StatementRow } from '../src/apps/spending/statements/domain/statementRows'

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

  it('names each record by the link Loans publishes with it, an informal loan followed by its movements', () => {
    const to = { path: '/loans' }
    const linkTo = (kind: string, key: string, due: string | null = null) => ({ app: 'loans', kind, key, due: due === null ? null : on(due) })
    const targets = loanTargetsFrom({
      instalments: [
        {
          kind: 'interim-interest',
          loan: LOAN,
          loanName: 'Home loan',
          lender: 'Example Bank',
          number: null,
          count: 300,
          due: on('2026-10-31'),
          yourShare: moneyFromAmount(80),
          interest: moneyFromAmount(80),
          principal: moneyFromAmount(0),
          link: linkTo('bank-loan', LOAN, '2026-10-31'),
          to,
        },
        {
          kind: 'instalment',
          loan: LOAN,
          loanName: 'Home loan',
          lender: 'Example Bank',
          number: 1,
          count: 300,
          due: on('2026-11-20'),
          yourShare: moneyFromAmount(650),
          interest: moneyFromAmount(250),
          principal: moneyFromAmount(400),
          link: linkTo('bank-loan', LOAN, '2026-11-20'),
          to,
        },
      ],
      extraPayments: [{ loanName: 'Home loan', day: on('2026-09-01'), amount: moneyFromAmount(2000), link: linkTo('extra-payment', 'e'), to }],
      informalLoans: [
        {
          key: 'b',
          name: 'From Marko',
          counterparty: 'Marko',
          direction: 'you-owe',
          movements: [{ day: on('2026-11-03'), kind: 'repaid', amount: moneyFromAmount(300), note: '', link: linkTo('movement', 'm') }],
          link: linkTo('informal-loan', 'b'),
          to,
        },
      ],
    })
    expect(targets.map((target) => rowLinkText(target.link))).toEqual([
      `loans/bank-loan/${LOAN}/2026-10-31`,
      `loans/bank-loan/${LOAN}/2026-11-20`,
      'loans/extra-payment/e',
      'loans/informal-loan/b',
      'loans/movement/m',
    ])
    expect(targets.map((target) => target.kind)).toEqual(['instalment', 'instalment', 'extra-payment', 'informal-loan', 'movement'])
    expect(targets[4]).toMatchObject({ loan: linkTo('informal-loan', 'b'), loanName: 'From Marko', direction: 'you-owe', movement: 'repaid', amount: moneyFromAmount(300) })
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
  lender: 'Example Bank',
  number: 14,
  count: 300,
  due: on('2026-11-20'),
  yourShare: moneyFromAmount(650),
  interest: moneyFromAmount(250),
  principal: moneyFromAmount(400),
}
const INFORMAL: LinkTarget = { kind: 'informal-loan', link: { app: 'loans', kind: 'informal-loan', key: 'b', due: null }, name: 'From Marko', counterparty: 'Marko', direction: 'you-owe' }

const filed = (stored: StoredRow) => ({ row: stored, items: wholeItems([stored]) })

/** A receipt for the instalment of 20 November, waiting on OTP for the bank's row. */
const RECEIPT: ReceiptDraft = {
  merchant: 'Example Bank',
  merchantOib: '',
  buyerOib: '',
  issuedOn: on('2026-11-20'),
  issuedTime: '09:00',
  total: moneyFromAmount(650),
  jir: '',
  zki: '',
  readBy: '',
  photo: '',
  latitude: '',
  longitude: '',
}

/** A statement's row out of OTP. */
function paying(date: string, amount: number, payee: string, fields: Partial<StatementRow> = {}): StatementRow {
  return {
    account: OTP.id,
    date: on(date),
    amount: accountMoneyFromAmount(amount),
    payee,
    category: null,
    description: payee,
    counterpartyIban: '',
    importKey: `key-${payee}-${date}`,
    movedAt: '',
    pocket: false,
    cashWithdrawal: false,
    ...fields,
  }
}
const ON_OTP = { currency: EURO, receipt: false, categories: CATEGORIES }

describe('a row linked to a loan instalment', () => {
  it("reads as its instalment with what it paid above or below the plan, on Import as on Entries, and as the instalment alone when it paid the plan's share", () => {
    const shown = [{ ...INSTALMENT, to: '/loans' }]
    const lines = [-652.4, -650, -640].map((amount) => {
      const paid = { amount: accountMoneyFromAmount(amount), currency: EURO }
      return [targetLineOf(INSTALMENT, paid), linkLineOf(INSTALMENT.link, shown, paid).text]
    })

    expect(lines.map(([onImport, onEntries]) => onImport === onEntries)).toEqual([true, true, true])
    expect(lines.map(([onImport]) => onImport!.split(', ').slice(3))).toEqual([['€2.40 above the plan'], [], ['€10.00 below the plan']])
  })

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

  it("links whole under Loan principal an informal loan, and as it is interim interest, money in, an account not in euros, a transfer's leg and a receipt's row", () => {
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
    ]).toEqual(['principal', 'no-principal', 'money-in', 'not-euro', 'transfer-leg', 'receipt'])
  })

  it('keeps the interest of a row with no category under Loan interest, and leaves the category to the write in a file that has none', () => {
    const category = (entry: StoredRow, on = ON_OTP) => {
      const filing = linkFiling(filed(entry), INSTALMENT, on)
      return filing.split ? filing.category : filing.why
    }
    expect([
      category(row(OTP, '2026-11-20', -650, null)),
      category(row(OTP, '2026-11-20', -650, null, { category: PRINCIPAL.id })),
      category(row(OTP, '2026-11-20', -650, null), { ...ON_OTP, categories: CATEGORIES.filter((held) => held.id !== LOAN_INTEREST.id) }),
    ]).toEqual([LOAN_INTEREST.id, LOAN_INTEREST.id, null])
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

    const linked = splitByInstalment({ row: spend, items }, INSTALMENT.link, { ...filing, category: GROCERIES.id }, PRINCIPAL.id, NOTES, () => 'made-up-part')
    expect(linked.items.map((part) => [part.id, part.amount, part.category, part.note, part.link])).toEqual([
      [items[0]!.id, accountMoneyFromAmount(-250), GROCERIES.id, 'Interest', INSTALMENT.link],
      [recordIdOf(ITEM_RECORDS, 'made-up-part'), accountMoneyFromAmount(-400), PRINCIPAL.id, '', INSTALMENT.link],
    ])
    expect(linked.row.categorisedBy).toBe('person')
  })

  it('joins the parts of an entry split by hand into one under Loan principal that keeps every label, when it links to a movement', () => {
    const paid = row(OTP, '2026-11-20', -300, null)
    const label = recordIdOf(LABEL_RECORDS, 'made-up-label')
    const [whole] = wholeItems([paid])
    const parts = [
      { ...whole!, amount: accountMoneyFromAmount(-200), category: GROCERIES.id },
      { ...whole!, id: recordIdOf(ITEM_RECORDS, 'made-up-part'), amount: accountMoneyFromAmount(-100), category: LOAN_INTEREST.id, labels: [label] },
    ]
    const movement: LinkTarget = {
      kind: 'extra-payment',
      link: { app: 'loans', kind: 'extra-payment', key: 'e', due: null },
      loanName: 'Home loan',
      day: on('2026-11-20'),
      amount: moneyFromAmount(300),
    }
    const { entry, added } = linkedEntry({ row: paid, items: parts }, movement, { currency: EURO, categories: CATEGORIES, language: 'en', notes: NOTES, receipt: false })

    expect(added).toEqual([])
    expect(entry.items.map((part) => [part.id, part.amount, part.category, part.link, part.labels])).toEqual([[parts[0]!.id, paid.amount, PRINCIPAL.id, movement.link, [label]]])
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

  it('offers for money out the instalments, the movements it can be and the extra payments within half a month of its day, nearest first, and for money in the movements alone', () => {
    const due = (date: string): LinkTarget => ({ ...INSTALMENT, due: on(date), link: { ...INSTALMENT.link, due: on(date) } })
    const moved = (date: string, movement: MovementKind, direction: LoanDirection = 'you-owe'): LinkTarget => ({
      kind: 'movement',
      link: { app: 'loans', kind: 'movement', key: `${date}-${movement}-${direction}`, due: null },
      loan: INFORMAL.link,
      loanName: 'From Marko',
      counterparty: 'Marko',
      direction,
      day: on(date),
      movement,
      amount: moneyFromAmount(300),
    })
    const extra: LinkTarget = { kind: 'extra-payment', link: { app: 'loans', kind: 'extra-payment', key: 'e', due: null }, loanName: 'Home loan', day: on('2026-11-21'), amount: moneyFromAmount(2000) }
    const targets = [due('2026-10-20'), INFORMAL, moved('2026-11-01', 'repaid'), moved('2026-11-24', 'borrowed'), extra, due('2026-12-05'), due('2026-11-20'), moved('2026-11-23', 'repaid')]
    const offered = (amount: number, currency = EURO) =>
      targetsFor({ date: on('2026-11-22'), amount: accountMoneyFromAmount(amount) }, currency, targets).map((target) =>
        target.kind === 'instalment' ? target.due : target.kind === 'movement' ? `${target.movement} ${target.day}` : target.kind,
      )
    expect(offered(-650)).toEqual(['2026-11-20', '2026-12-05', 'repaid 2026-11-23', 'extra-payment'])
    expect(offered(-650, REVOLUT_USD.currency)).toEqual(['2026-11-20', '2026-12-05', 'repaid 2026-11-23'])
    expect(offered(650)).toEqual(['borrowed 2026-11-24'])
  })

  it('matches money out and in to the movements of each direction that move one of your accounts', () => {
    const kinds = (amount: number, direction: LoanDirection) => movementKindsFor(accountMoneyFromAmount(amount), direction)
    expect([kinds(-300, 'owed-to-you'), kinds(300, 'owed-to-you'), kinds(-300, 'you-owe'), kinds(300, 'you-owe')]).toEqual([
      ['borrowed', 'borrowed-in-kind'],
      ['repaid'],
      ['repaid', 'repaid-in-kind'],
      ['borrowed'],
    ])
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
  async function fileWith(rows: readonly StoredRow[], categories = CATEGORIES.filter((held) => held.kind !== 'repayment')): Promise<WorkbookStore<SpendingBooks>> {
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
      ...stored(CATEGORY_RECORDS, categories),
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
    // A file from before items keeps no mark of the parts a link split off.
    const byLink = shape === 'items'
    const principal = book().categories.find((held) => held.kind === 'repayment')!
    expect(principal).toMatchObject({ name: 'Loan principal', parent: null })
    expect(book().problems).toEqual([])
    expect(
      book()
        .items.filter((part) => part.transaction === paid.id)
        .map((part) => [part.amount, part.category, part.note, part.splitByLink]),
    ).toEqual([
      [accountMoneyFromAmount(-250), LOAN_INTEREST.id, 'Interest', byLink],
      [accountMoneyFromAmount(-400), principal.id, '', byLink],
      [accountMoneyFromAmount(-2.4), LOAN_INTEREST.id, 'Difference from the plan', byLink],
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

  it('files a row linked to a movement whole under Loans to and from people, added once, so the month counts none of it, and Undo takes both back', async () => {
    const lent = row(OTP, '2026-11-20', -300, 'Food/Groceries')
    const store = await fileWith(
      [lent],
      CATEGORIES.filter((held) => held.kind !== 'informal-loan'),
    )
    const book = () => store.state.workbook!
    const movement: LinkTarget = {
      kind: 'movement',
      link: { app: 'loans', kind: 'movement', key: 'made-up-movement', due: null },
      loan: INFORMAL.link,
      loanName: 'To Marko',
      counterparty: 'Marko',
      direction: 'owed-to-you',
      day: on('2026-11-20'),
      movement: 'borrowed',
      amount: moneyFromAmount(300),
    }
    await store.write('Linked', (unit) => linkEntry(unit, store.state.records!, book().transactions[0]!, movement, { ...english, categories: book().categories }))

    const people = book().categories.find((held) => held.kind === 'informal-loan')!
    expect(people).toMatchObject({ name: 'Loans to and from people', parent: null })
    expect(book().problems).toEqual([])
    expect(book().items.map((part) => [part.amount, part.category, part.link])).toEqual([[accountMoneyFromAmount(-300), people.id, movement.link]])
    expect(spendingFigures(book(), NO_RATES).totalsOf(month('2026-11')).spent).toEqual(moneyFromAmount(0))

    await store.undo(store.state.writes[0]!)
    expect(book().categories.some((held) => held.kind === 'informal-loan')).toBe(false)
    expect(book().items).toEqual(wholeItems([lent]))
  })

  it('files the interest of a row with no category under Loan interest, adding it under Money and fees to a file without it, so the row leaves To review', async () => {
    const waiting = row(OTP, '2026-11-20', -650, null)
    const store = await fileWith(
      [waiting],
      CATEGORIES.filter((held) => held.kind !== 'repayment' && held.id !== LOAN_INTEREST.id),
    )
    const book = () => store.state.workbook!
    await store.write('Linked', (unit) => linkEntry(unit, store.state.records!, book().transactions[0]!, INSTALMENT, { ...english, categories: book().categories }))

    const interest = book().categories.find((held) => held.name === 'Loan interest')!
    expect(interest).toMatchObject({ kind: 'spending', parent: category('Money and fees').id })
    expect(book().problems).toEqual([])
    expect(book().items.map((part) => part.category)).toEqual([interest.id, book().categories.find((held) => held.kind === 'repayment')!.id])
    expect(waitsOnReview(book().items)).toBe(false)

    await store.undo(store.state.writes[0]!)
    expect(book().categories.some((held) => held.name === 'Loan interest')).toBe(false)
    expect(waitsOnReview(book().items)).toBe(true)
  })

  it('links several rows in one write, adding Loan principal once, and one Undo takes them all back', async () => {
    const rows = [row(OTP, '2026-10-20', -650, 'Money and fees/Loan interest'), row(OTP, '2026-11-20', -650, null)]
    const store = await fileWith(rows)
    const book = () => store.state.workbook!
    const due = (date: string): InstalmentTarget => ({ ...INSTALMENT, due: on(date), link: { ...INSTALMENT.link, due: on(date) } })
    await store.write('Linked', (unit) =>
      linkEntries(
        unit,
        store.state.records!,
        book().transactions.map((held, place) => ({ row: held, target: due(place === 0 ? '2026-10-20' : '2026-11-20'), currency: EURO })),
        { ...english, categories: book().categories },
      ),
    )

    expect(book().categories.filter((held) => held.kind === 'repayment')).toHaveLength(1)
    expect(book().problems).toEqual([])
    const principal = book().categories.find((held) => held.kind === 'repayment')!.id
    expect(
      book().transactions.map((held) =>
        book()
          .items.filter((part) => part.transaction === held.id)
          .map((part) => [part.category, part.link?.due]),
      ),
    ).toEqual([
      [
        [LOAN_INTEREST.id, on('2026-10-20')],
        [principal, on('2026-10-20')],
      ],
      [
        [LOAN_INTEREST.id, on('2026-11-20')],
        [principal, on('2026-11-20')],
      ],
    ])
    expect(store.state.writes).toHaveLength(1)

    await store.undo(store.state.writes[0]!)
    expect(book().items).toEqual(wholeItems(rows))
  })

  it('imports a new row that pays an instalment linked and split, with Loan interest and Loan principal added to a file without them, in one write one Undo takes back', async () => {
    const store = await fileWith(
      [],
      CATEGORIES.filter((held) => held.kind !== 'repayment' && held.id !== LOAN_INTEREST.id),
    )
    const book = () => store.state.workbook!
    const statement = { label: 'export.csv', rows: [paying('2026-11-21', -650, 'EXAMPLE BANK')], notes: [] }
    const run = statementDryRun(book(), statement, on('2026-11-25'), { targets: [INSTALMENT], language: 'en', notes: NOTES })

    expect(run.lines.map((line) => line.outcome === 'new' && line.pays?.target)).toEqual([INSTALMENT])
    expect(run.lines.map((line) => line.outcome === 'new' && line.pays?.parts.map((part) => part.amount))).toEqual([[accountMoneyFromAmount(-250), accountMoneyFromAmount(-400)]])
    expect(run.categories?.map((held) => held.name)).toEqual(['Loan principal', 'Loan interest'])
    expect(run.lines.map((line) => line.category)).toEqual([run.categories?.[1]?.id])
    await store.write('Imported', (unit) => writeDryRun(unit, store.state.records!, run))

    const interest = book().categories.find((held) => held.name === 'Loan interest')!
    const principal = book().categories.find((held) => held.kind === 'repayment')!
    expect(book().problems).toEqual([])
    expect(book().items.map((part) => [part.amount, part.category, part.note, part.link])).toEqual([
      [accountMoneyFromAmount(-250), interest.id, 'Interest', INSTALMENT.link],
      [accountMoneyFromAmount(-400), principal.id, '', INSTALMENT.link],
    ])
    expect(waitsOnReview(book().items)).toBe(false)
    expect(store.state.writes).toHaveLength(1)

    await store.undo(store.state.writes[0]!)
    expect([book().transactions, book().categories.filter((held) => held.kind === 'repayment' || held.name === 'Loan interest')]).toEqual([[], []])
  })

  it("leaves unlinked a new row a waiting receipt files in the same import, with the receipt's lines, as To review offers no row a receipt is on", async () => {
    const store = await fileWith([])
    await store.write('Saved', (unit) =>
      writeReceiptSplit(
        unit,
        store.state.records!,
        receiptSplit(RECEIPT, { account: OTP }, [
          { printed: 'RATA', note: 'rata', amount: accountMoneyFromAmount(-600), category: LOAN_INTEREST.id },
          { printed: 'NAKNADA', note: 'naknada', amount: accountMoneyFromAmount(-50), category: GROCERIES.id },
        ]),
      ),
    )
    const book = () => store.state.workbook!
    const statement = { label: 'export.csv', rows: [paying('2026-11-20', -650, 'EXAMPLE BANK ZAGREB')], notes: [] }
    const run = statementDryRun(book(), statement, on('2026-11-25'), { targets: [INSTALMENT], language: 'en', notes: NOTES })

    expect(run.receipts).toHaveLength(1)
    expect(run.lines.map((line) => line.outcome === 'new' && [line.category, line.pays])).toEqual([[LOAN_INTEREST.id, undefined]])
    expect(run.categories).toBeUndefined()
    expect(run.items.map((part) => [part.amount, part.category, part.receipt, part.link])).toEqual([
      [accountMoneyFromAmount(-600), LOAN_INTEREST.id, run.receipts[0]!.receipt.after.id, null],
      [accountMoneyFromAmount(-50), GROCERIES.id, run.receipts[0]!.receipt.after.id, null],
    ])
    await store.write('Imported', (unit) => writeDryRun(unit, store.state.records!, run))
    expect(book().problems).toEqual([])
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

  it('says a part was split off by the link until you split the row again by hand, even when a part stays under Loan principal', async () => {
    const paid = row(OTP, '2026-11-20', -650, 'Money and fees/Loan interest')
    const store = await fileWith([paid])
    const book = () => store.state.workbook!
    await store.write('Linked', (unit) => linkEntry(unit, store.state.records!, book().transactions[0]!, INSTALMENT, { ...english, categories: book().categories }))
    const [interest, principal] = book().items
    const drafts = [
      { id: interest!.id, amount: accountMoneyFromAmount(-200), category: interest!.category!, note: '' },
      { id: principal!.id, amount: 'rest' as const, category: principal!.category!, note: '' },
    ]
    const split = entrySplit(book(), book().transactions[0]!, drafts)
    if ('refused' in split) throw new Error(split.refused)

    await store.write('Split', (unit) => writeEntrySplit(unit, store.state.records!, split))

    expect(book().items.map((part) => [part.category, part.splitByLink])).toEqual([
      [interest!.category, false],
      [principal!.category, false],
    ])
  })
})

describe('importing a statement against the instalments in Loans', () => {
  it("files an imported row's interest under the category its rule gives, and leaves a row only near the plan, and every row of a sync, unlinked for To review", () => {
    const book = spendingBook([], { categories: CATEGORIES })
    const ruled = { label: 'export.csv', rows: [paying('2026-11-20', -650, 'Example Bank', { category: GROCERIES.id })], notes: [] }
    const near = { label: 'export.csv', rows: [paying('2026-11-20', -700, 'Card payment')], notes: [] }
    const links = { targets: [INSTALMENT], language: 'en' as const, notes: NOTES }

    expect(statementDryRun(book, ruled, on('2026-11-25'), links).items.map((part) => part.category)).toEqual([GROCERIES.id, PRINCIPAL.id])
    const nearRun = statementDryRun(book, near, on('2026-11-25'), links)
    expect([nearRun.lines[0]?.outcome === 'new' && nearRun.lines[0].pays, nearRun.items.map((part) => part.link)]).toEqual([undefined, [null]])
    expect(statementDryRun(book, ruled, on('2026-11-25')).items.map((part) => part.link)).toEqual([null])
  })
})
