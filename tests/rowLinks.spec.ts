import { describe, expect, it } from 'vitest'

import { loanTargetsFrom } from '../src/apps/spending/links/application/loanTargets'
import { linkStateOf } from '../src/apps/spending/links/domain/linkTarget'
import { rowLinkOf, rowLinkText } from '../src/apps/spending/workbook/domain/rowLink'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { moneyFromAmount } from '../src/shared/money/money'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { rowLinksOf } from '../src/apps/spending/facts'
import { DESK_LOAN_TARGETS } from './fixtures/spendingDesk'
import { ACCOUNTS, row, wholeItems } from './fixtures/spending'

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

  it("names an instalment by its loan's key and due date, and an informal loan by its key, as Loans publishes them", () => {
    const to = { path: '/loans' }
    const targets = loanTargetsFrom({
      instalments: [{ loan: LOAN, loanName: 'Home loan', due: on('2026-11-20'), yourShare: moneyFromAmount(650), interest: moneyFromAmount(250), principal: moneyFromAmount(400), to }],
      informalLoans: [{ key: 'b', name: 'From Marko', counterparty: 'Marko', direction: 'you-owe', to }],
    })
    expect(targets.map((target) => rowLinkText(target.link))).toEqual([`loans/bank-loan/${LOAN}/2026-11-20`, 'loans/informal-loan/b'])
  })

  it('publishes each linked row with its account, day, amount in its own currency and the record it names, and no row without a link', () => {
    const link = rowLinkOf(`loans/bank-loan/${LOAN}/2026-11-20`)!
    const linked = row(ACCOUNTS[0]!, '2026-11-20', -650, 'Money and fees/Loan instalments', { link })
    const rows = [row(ACCOUNTS[0]!, '2026-11-19', -12, 'Food/Groceries'), linked]
    const book = { accounts: ACCOUNTS, transactions: rows, items: wholeItems(rows) }
    expect(rowLinksOf(book)).toEqual([
      { row: expect.any(String), item: expect.any(String), account: expect.any(String), day: on('2026-11-20'), amount: linked.amount, currency: ACCOUNTS[0]!.currency, target: link },
    ])
  })
})
