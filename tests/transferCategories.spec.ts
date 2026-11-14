import { describe, expect, it } from 'vitest'

import { entrySplit } from '../src/apps/spending/entries/domain/entrySplit'
import { splittableRows } from '../src/apps/spending/receipts/domain/receiptMatch'
import { reviewCount, reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import type { StatementRow, StatementRows } from '../src/apps/spending/statements/domain/statementRows'
import { isTransferCategory, transferCategoryOf } from '../src/apps/spending/workbook/domain/category'
import type { Category } from '../src/apps/spending/workbook/domain/category'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { filedAsTransfer } from '../src/apps/spending/workbook/domain/rowItems'
import { CATEGORY_RECORDS, RULE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { SpendingRule } from '../src/apps/spending/workbook/domain/spendingRule'
import { spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { StoredRow, Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil } from './fixtures/ledger'
import { ACCOUNTS, CASH, CATEGORIES, OTP, REVOLUT_EUR, category, row, storedBeforeItems, wholeItems } from './fixtures/spending'

const DAY = civil('2026-10-30')
const FIRST = category('Between my accounts')
const GROCERIES = category('Food/Groceries')

/** A second transfer category after the starter one, which the reader doubts but keeps counting. */
const SECOND: Category = {
  id: recordIdOf(CATEGORY_RECORDS, '5e000000-0000-4000-8000-000000000999'),
  name: 'Own accounts',
  kind: 'transfer',
  parent: null,
  order: 99,
  colour: '',
  hidden: false,
}
const CATEGORIES_WITH_SECOND: readonly Category[] = [...CATEGORIES, SECOND]

function bookOf(transactions: readonly Transaction[], rules: readonly SpendingRule[] = []): SpendingBook {
  return {
    accounts: ACCOUNTS,
    categories: CATEGORIES_WITH_SECOND,
    transactions,
    budgets: [],
    rules,
    receipts: [],
    items: wholeItems(transactions),
    held: [],
    settings: spendingSettingsOf([]),
    stored: storedBeforeItems(transactions),
    readings: {} as SpendingBook['readings'],
    problems: [],
  }
}

const underSecond = (on: typeof OTP, amount: number, payee: string, fields: Partial<StoredRow> = {}): StoredRow =>
  row(on, '2026-10-20', amount, null, { category: SECOND.id, payee, description: payee, ...fields })

const fromStatement = (on: typeof OTP, amount: number, payee: string, fields: Partial<StoredRow> = {}): StoredRow =>
  underSecond(on, amount, payee, { source: 'statement', importKey: `earlier-${payee}`, ...fields })

function statementRow(on: typeof OTP, amount: number, payee: string, fields: Partial<StatementRow> = {}): StatementRow {
  return {
    account: on.id,
    date: civil('2026-10-21'),
    amount: accountMoneyFromAmount(amount),
    payee,
    category: null,
    description: payee,
    counterpartyIban: '',
    importKey: `key-${payee}`,
    movedAt: '',
    pocket: false,
    cashWithdrawal: false,
    ...fields,
  }
}

const statementOf = (...rows: StatementRow[]): StatementRows => ({ label: 'export.csv', rows, notes: [] })

describe('a second transfer category', () => {
  it('holds money between your own accounts as the first one does', () => {
    const isTransfer = filedAsTransfer(CATEGORIES_WITH_SECOND)
    const [second, first, groceries] = [underSecond(OTP, -30, 'Top-up'), row(OTP, '2026-10-20', -30, 'Between my accounts'), row(OTP, '2026-10-20', -30, 'Food/Groceries')]

    expect(CATEGORIES_WITH_SECOND.filter(isTransferCategory)).toEqual([FIRST, SECOND])
    expect(isTransfer(wholeItems([second]))).toBe(true)
    expect(isTransfer(wholeItems([first]))).toBe(true)
    expect(isTransfer(wholeItems([groceries]))).toBe(false)
    expect(isTransfer([])).toBe(false)
    expect(isTransfer([...wholeItems([second]), ...wholeItems([groceries])])).toBe(false)
  })

  it('leaves a new transfer under the first one in file order', () => {
    expect(transferCategoryOf(CATEGORIES_WITH_SECOND)).toEqual(FIRST)
    expect(transferCategoryOf([SECOND, ...CATEGORIES])).toEqual(SECOND)
    expect(transferCategoryOf([GROCERIES])).toBeNull()
  })

  it('keeps a lone leg under it on To review, and a withdrawal under it waiting for its cash leg', () => {
    const lone = fromStatement(OTP, -75, 'To Revolut', { counterpartyIban: REVOLUT_EUR.iban })
    const withdrawal = fromStatement(OTP, -50, 'Bankomat Ilica', { cashWithdrawal: true })
    const book = bookOf([lone, withdrawal])
    const queue = reviewQueue(book, DAY)

    expect(queue.loneLegs).toEqual([lone])
    expect(queue.withdrawals.map(({ row: waiting }) => waiting)).toEqual([withdrawal])
    expect(reviewCount(book)).toBe(1)
  })

  it('takes no receipt for a row under it', () => {
    const [transfer, groceries] = [underSecond(OTP, -30, 'Top-up'), row(OTP, '2026-10-20', -30, 'Food/Groceries')]

    expect(splittableRows(bookOf([transfer, groceries]))).toEqual([groceries])
  })

  it('splits no row under it, and takes no part of a split', () => {
    const transfer = underSecond(OTP, -30, 'Top-up')
    const groceries = row(OTP, '2026-10-20', -30, 'Food/Groceries')
    const drafts = (on: Category) => [
      { id: null, amount: accountMoneyFromAmount(-10), category: GROCERIES.id, note: '' },
      { id: null, amount: 'rest' as const, category: on.id, note: '' },
    ]

    expect(entrySplit(bookOf([transfer]), transfer, drafts(GROCERIES))).toEqual({ refused: 'transfer-leg' })
    expect(entrySplit(bookOf([groceries]), groceries, drafts(SECOND))).toEqual({ refused: 'between-accounts' })
  })

  describe('in an import', () => {
    it('lets a typed leg under it take the bank row that moves the same money', () => {
      const typed = underSecond(OTP, -75, 'To Revolut')
      const run = statementDryRun(bookOf([typed]), statementOf(statementRow(OTP, -75, 'To Revolut', { counterpartyIban: REVOLUT_EUR.iban })), DAY)

      expect(run).toMatchObject({ filled: 1, newRows: 0 })
    })

    it('leaves a lone leg under it where it is', () => {
      const lone = fromStatement(OTP, -75, 'To Revolut', { counterpartyIban: REVOLUT_EUR.iban })

      expect(statementDryRun(bookOf([lone]), statementOf(statementRow(REVOLUT_EUR, -12, 'Coffee')), DAY).changed).toEqual([])
    })

    it('gives a withdrawal its rule files under it a cash leg', () => {
      const bankomat: SpendingRule = {
        id: recordIdOf(RULE_RECORDS, 'rule-bankomat'),
        order: 1,
        condition: { column: 'counterparty_contains', fragment: 'Bankomat' },
        category: SECOND.id,
        withdrawal: { cashAccount: null },
      }
      const run = statementDryRun(bookOf([], [bankomat]), statementOf(statementRow(OTP, -50, 'Bankomat Ilica')), DAY)

      expect(run.added.map((added) => added.account)).toEqual([OTP.id, CASH.id])
    })
  })
})
