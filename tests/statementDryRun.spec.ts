import { describe, expect, it } from 'vitest'

import { fileRow, payeeCondition, rowsRuleWouldFile, writeDryRun, writeRule, deleteRule } from '../src/apps/spending/statements/application/statementWrites'
import { reviewCount, reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue'
import { rulesRerun, spendingCategorisationContext } from '../src/apps/spending/statements/domain/spendingCategorisation'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import type { StatementRow, StatementRows } from '../src/apps/spending/statements/domain/statementRows'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { RULE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { SpendingRule, SpendingRuleCondition } from '../src/apps/spending/workbook/domain/spendingRule'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { account, ACCOUNTS, CATEGORIES, category, OTP, REVOLUT_EUR, REVOLUT_USD, row, transactionId } from './fixtures/spending'
import { civil, euros } from './fixtures/ledger'

const DAY = civil('2026-10-30')

function bookOf(transactions: readonly Transaction[], rules: readonly SpendingRule[] = []): SpendingBook {
  return {
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    transactions,
    budgets: [],
    rules,
    receipts: [],
    lines: [],
    settings: spendingSettingsOf([]),
    readings: {} as SpendingBook['readings'],
    problems: [],
  }
}

function statementRow(on: typeof OTP, date: string, amount: number, payee: string, fields: Partial<StatementRow> = {}): StatementRow {
  return {
    account: on.id,
    date: civil(date),
    amount: euros(amount),
    payee,
    category: null,
    description: payee,
    counterpartyIban: '',
    importKey: `key-${payee}-${date}`,
    movedAt: '',
    pocket: false,
    ...fields,
  }
}

const statementOf = (...rows: StatementRow[]): StatementRows => ({ label: 'export.csv', rows, notes: [] })

function counting(): () => string {
  let place = 0
  return () => `99000000-0000-4000-8000-${String((place += 1)).padStart(12, '0')}`
}

const ruleOf = (condition: SpendingRuleCondition, path: string, order = 1): SpendingRule => ({ id: recordIdOf(RULE_RECORDS, `rule-${order}`), order, condition, category: category(path).id })
const onFile = (on: typeof OTP, date: string, amount: number, fields: Partial<Transaction> = {}) => row(on, date, amount, null, { source: 'statement', ...fields })

describe('the dry run of a statement', () => {
  it('skips a row whose key is on the account already', () => {
    const held = onFile(OTP, '2026-10-20', -5, { importKey: 'held' })
    const run = statementDryRun(bookOf([held]), statementOf(statementRow(OTP, '2026-10-20', -5, 'Coffee', { importKey: 'held' })), DAY)

    expect(run).toMatchObject({ newRows: 0, alreadyIn: 1, filled: 0, added: [], changed: [] })
  })

  it('takes the same key on another account as a new row', () => {
    const held = onFile(REVOLUT_EUR, '2026-10-20', -5, { importKey: 'held' })

    expect(statementDryRun(bookOf([held]), statementOf(statementRow(OTP, '2026-10-20', -5, 'Coffee', { importKey: 'held' })), DAY).newRows).toBe(1)
  })

  it('leaves a row before its account opened out with a note, as the entry dialog refuses one', () => {
    const run = statementDryRun(bookOf([]), statementOf(statementRow(OTP, '2026-08-31', -5, 'Coffee')), DAY)

    expect(run).toMatchObject({ newRows: 0, added: [], notes: ['1 row before its account opened left out.'] })
    expect(run.lines[0]?.outcome).toBe('before-opening')
  })

  it("fills a typed row of the same money with the bank's facts, and keeps its id, category, note and payee", () => {
    const typed = row(OTP, '2026-10-19', -5, 'Food/Coffee', { payee: 'My coffee', note: 'With Ana', categorisedBy: 'person' })
    const run = statementDryRun(bookOf([typed]), statementOf(statementRow(OTP, '2026-10-20', -5, 'CAFE 123', { counterpartyIban: 'HR2200000000000000022' })), DAY)

    expect(run).toMatchObject({ newRows: 0, filled: 1, added: [] })
    expect(run.changed).toEqual([
      {
        before: typed,
        after: {
          ...typed,
          date: civil('2026-10-20'),
          description: 'CAFE 123',
          counterpartyIban: 'HR2200000000000000022',
          importKey: 'key-CAFE 123-2026-10-20',
          statement: 'export.csv',
        },
      },
    ])
  })

  it('does not fill a row a statement already filled', () => {
    const filled = row(OTP, '2026-10-19', -5, 'Food/Coffee', { importKey: 'earlier' })

    expect(statementDryRun(bookOf([filled]), statementOf(statementRow(OTP, '2026-10-20', -5, 'Coffee')), DAY).filled).toBe(0)
  })

  it('files a new row by the first rule that holds', () => {
    const rules = [ruleOf({ column: 'counterparty_contains', fragment: 'Corner market' }, 'Food/Groceries')]
    const run = statementDryRun(bookOf([], rules), statementOf(statementRow(OTP, '2026-10-20', -5, 'CORNER MARKET 12')), DAY, counting())

    expect(run.added).toMatchObject([{ category: category('Food/Groceries').id, categorisedBy: 'rule', source: 'statement', statement: 'export.csv' }])
  })

  it('files by the IBAN too, however it is grouped', () => {
    const rules = [ruleOf({ column: 'counterparty_iban', iban: 'HR2200000000000000022' }, 'Food/Groceries')]
    const run = statementDryRun(bookOf([], rules), statementOf(statementRow(OTP, '2026-10-20', -5, 'Shop', { counterpartyIban: 'HR22 0000 0000 0000 0002 2' })), DAY)

    expect(run.added[0]?.category).toBe(category('Food/Groceries').id)
  })

  it('leaves a new row no rule decides waiting on review', () => {
    expect(statementDryRun(bookOf([]), statementOf(statementRow(OTP, '2026-10-20', -5, 'Shop')), DAY).added).toMatchObject([{ category: null, categorisedBy: null }])
  })

  it("keeps the category a reader gave, with no rule's mark, so a rule change leaves it", () => {
    const fees = category('Money and fees/Bank fees').id
    const run = statementDryRun(bookOf([]), statementOf(statementRow(OTP, '2026-10-20', -1, 'Revolut', { category: fees })), DAY)

    expect(run.added).toMatchObject([{ category: fees, categorisedBy: null }])
  })

  it('pairs a new credit with a lone leg on the file, within the last 30 days', () => {
    const between = category('Between my accounts').id
    const lone = onFile(OTP, '2026-10-20', -75, { category: between, counterpartyIban: REVOLUT_EUR.iban })
    const run = statementDryRun(bookOf([lone]), statementOf(statementRow(REVOLUT_EUR, '2026-10-21', 75, 'Top-up')), DAY, counting())

    expect(run.added).toMatchObject([{ category: between, pair: lone.id }])
    expect(run.changed).toEqual([{ before: lone, after: { ...lone, pair: run.added[0]?.id, categorisedBy: null } }])
  })

  it('does not touch a lone leg more than 30 days before today and before the oldest new row', () => {
    const old = onFile(OTP, '2026-09-20', -75, { category: category('Between my accounts').id, counterpartyIban: REVOLUT_EUR.iban })

    expect(statementDryRun(bookOf([old]), statementOf(statementRow(REVOLUT_EUR, '2026-10-21', 75, 'Top-up')), civil('2026-10-21')).changed).toEqual([])
  })

  it("pairs an old exchange across two imports, reaching back from the statement's own rows", () => {
    const at = '2026-03-10 09:00:00'
    const between = category('Between my accounts').id
    const onSept = (date: string) => ACCOUNTS.map((held) => ({ ...held, openedOn: civil(date) }))
    const leg = onFile(REVOLUT_EUR, '2026-03-10', -54, { category: between, movedAt: at })
    const run = statementDryRun({ ...bookOf([leg]), accounts: onSept('2026-01-01') }, statementOf(statementRow(REVOLUT_USD, '2026-03-10', 58, 'From EUR', { movedAt: at })), DAY)

    expect(run.added[0]?.pair).toBe(leg.id)
    expect(run.changed).toHaveLength(1)
  })

  it('shows a row on the file the pairing changes as a line of its own', () => {
    const filedByRule = onFile(OTP, '2026-10-20', -30, { payee: 'Corner', category: category('Food/Groceries').id, categorisedBy: 'rule', counterpartyIban: REVOLUT_EUR.iban, importKey: 'held' })
    const statement = statementOf(statementRow(OTP, '2026-10-20', -30, 'Corner', { importKey: 'held' }))
    const run = statementDryRun(bookOf([filedByRule]), statement, DAY)

    expect(run).toMatchObject({ newRows: 0, alreadyIn: 1 })
    expect(run.changed).toHaveLength(1)
    expect(run.lines.map((line) => [line.outcome, line.category])).toEqual([
      ['already-in', null],
      ['refiled', category('Between my accounts').id],
    ])
  })

  describe('a pocket move', () => {
    const at = '2026-10-20 09:00:00'
    const between = category('Between my accounts').id
    const pocket = account(9, { name: 'Revolut pocket', kind: 'savings', bank: 'revolut', currency: REVOLUT_EUR.currency, opening: euros(0), openedOn: civil('2026-09-01'), iban: '', closed: false })
    const currentLeg = statementRow(REVOLUT_EUR, '2026-10-20', -20, 'Pocket Summer trip', { movedAt: at, pocket: true })
    const savingsLeg = statementRow(pocket, '2026-10-20', 20, 'From current', { movedAt: at, pocket: true })
    const withPocket = (transactions: readonly Transaction[] = []) => ({ ...bookOf(transactions), accounts: [...ACCOUNTS, pocket] })

    it('pairs as a transfer with a savings account', () => {
      const { added, notes } = statementDryRun(withPocket(), statementOf(currentLeg, savingsLeg), DAY, counting())

      expect(added.map((row) => [row.category, row.pair])).toEqual([
        [between, added[1]?.id],
        [between, added[0]?.id],
      ])
      expect(notes).toEqual([])
    })

    it('counts as a transfer and waits with no savings account, saying it wants one, in the dry run and on To review', () => {
      const run = statementDryRun(bookOf([]), statementOf(currentLeg), DAY)

      expect(run.added).toMatchObject([{ category: between, pair: null, pocket: true, categorisedBy: null }])
      expect(run.notes).toEqual(['1 pocket move counts as a transfer and waits for a Revolut savings account.'])
      const queue = reviewQueue(bookOf(run.added), DAY)
      expect(queue.loneLegs).toEqual(run.added)
      expect(queue.wantingSavings).toBe(1)
      expect(queue.waiting).toEqual([])
    })

    it('does not count a pair or an exchange as wanting a savings account', () => {
      const exchange = onFile(REVOLUT_EUR, '2026-10-20', -5, { category: between, movedAt: at })
      const paired = onFile(REVOLUT_EUR, '2026-10-20', -6, { category: between, movedAt: at, pocket: true, pair: transactionId(80) })

      expect(reviewQueue(bookOf([exchange, paired]), DAY).wantingSavings).toBe(0)
    })

    it('pairs the lone leg once a savings account exists and the file is imported again, however old', () => {
      const old = statementRow(REVOLUT_EUR, '2026-10-20', -20, 'Pocket Summer trip', { movedAt: at, pocket: true })
      const first = statementDryRun(bookOf([]), statementOf(old), DAY, counting())
      const second = statementDryRun(withPocket(first.added), statementOf(old, savingsLeg), civil('2027-06-01'), counting())

      expect(second).toMatchObject({ newRows: 1, alreadyIn: 1 })
      expect(second.added[0]?.pair).toBe(first.added[0]?.id)
      expect(second.changed[0]?.after.pair).toBe(second.added[0]?.id)
    })

    it('does not fill a typed purchase of the same money', () => {
      const typed = row(REVOLUT_EUR, '2026-10-20', -20, 'Food/Groceries')

      expect(statementDryRun(bookOf([typed]), statementOf(currentLeg), DAY).filled).toBe(0)
    })

    it('adds nothing on a second import of the same file', () => {
      const statement = statementOf(currentLeg, savingsLeg)
      const { added } = statementDryRun(withPocket(), statement, DAY, counting())

      expect(statementDryRun(withPocket(added), statement, DAY)).toMatchObject({ newRows: 0, alreadyIn: 2, changed: [] })
    })

    it('does not pair two moves of one second across their amounts', () => {
      const other = statementRow(pocket, '2026-10-20', 7, 'From current', { movedAt: at, pocket: true })

      expect(statementDryRun(withPocket(), statementOf(currentLeg, other), DAY).added.map((added) => added.pair)).toEqual([null, null])
    })
  })

  describe('which row may fill a typed one', () => {
    const typedShop = () => row(REVOLUT_EUR, '2026-10-20', -54, 'Food/Groceries', { payee: 'Big shop' })

    it('not an exchange leg, which stays a transfer', () => {
      const run = statementDryRun(bookOf([typedShop()]), statementOf(statementRow(REVOLUT_EUR, '2026-10-20', -54, 'To USD', { movedAt: '2026-10-20 09:00:00' })), DAY)

      expect(run).toMatchObject({ filled: 0, newRows: 1, added: [{ category: category('Between my accounts').id }] })
    })

    it('not a debit to an own IBAN', () => {
      const typed = row(OTP, '2026-10-20', -54, 'Food/Groceries')

      expect(statementDryRun(bookOf([typed]), statementOf(statementRow(OTP, '2026-10-20', -54, 'To Revolut', { counterpartyIban: REVOLUT_EUR.iban })), DAY).filled).toBe(0)
    })

    it('not a fee the reader filed', () => {
      const fee = statementRow(REVOLUT_EUR, '2026-10-20', -54, 'Revolut', { category: category('Money and fees/Bank fees').id })

      expect(statementDryRun(bookOf([typedShop()]), statementOf(fee), DAY).filled).toBe(0)
    })

    it('but a debit to an own IBAN fills a typed transfer leg', () => {
      const between = category('Between my accounts').id
      const [out, into] = [transactionId(70), transactionId(71)]
      const legs = [row(OTP, '2026-10-20', -75, 'Between my accounts', { id: out, pair: into }), row(REVOLUT_EUR, '2026-10-20', 75, 'Between my accounts', { id: into, pair: out })]
      const run = statementDryRun(bookOf(legs), statementOf(statementRow(OTP, '2026-10-21', -75, 'To Revolut', { counterpartyIban: REVOLUT_EUR.iban })), DAY)

      expect(run).toMatchObject({ filled: 1, newRows: 0 })
      expect(run.changed[0]?.after).toMatchObject({ id: out, pair: into, category: between, importKey: 'key-To Revolut-2026-10-21' })
    })

    it('and an ordinary row fills a typed transfer leg too, such as a card top-up', () => {
      const [out, into] = [transactionId(72), transactionId(73)]
      const legs = [row(OTP, '2026-10-20', -60, 'Between my accounts', { id: out, pair: into }), row(REVOLUT_EUR, '2026-10-20', 60, 'Between my accounts', { id: into, pair: out })]

      expect(statementDryRun(bookOf(legs), statementOf(statementRow(OTP, '2026-10-20', -60, 'Card top-up')), DAY).filled).toBe(1)
    })
  })

  it('does not pair a row you sent back with Not a pair', () => {
    const sentBack = onFile(OTP, '2026-10-20', -75, { categorisedBy: 'person', counterpartyIban: REVOLUT_EUR.iban })
    const run = statementDryRun(bookOf([sentBack]), statementOf(statementRow(REVOLUT_EUR, '2026-10-21', 75, 'Top-up')), DAY)

    expect(run.changed).toEqual([])
    expect(run.added[0]?.pair).toBeNull()
  })

  it('files a lone debit to an own IBAN under Between my accounts, waiting', () => {
    const run = statementDryRun(bookOf([]), statementOf(statementRow(OTP, '2026-10-20', -75, 'To Revolut', { counterpartyIban: REVOLUT_EUR.iban })), DAY)

    expect(run.added).toMatchObject([{ category: category('Between my accounts').id, pair: null, categorisedBy: null }])
  })

  it("pairs an exchange's legs inside one file", () => {
    const at = '2026-10-20 09:00:00'
    const run = statementDryRun(
      bookOf([]),
      statementOf(statementRow(REVOLUT_EUR, '2026-10-20', -54, 'To USD', { movedAt: at }), statementRow(REVOLUT_USD, '2026-10-20', 58, 'From EUR', { movedAt: at })),
      DAY,
    )

    expect(run.added[0]?.pair).toBe(run.added[1]?.id)
    expect(run.added[1]?.pair).toBe(run.added[0]?.id)
  })

  it('reads a statement twice as all in, once its rows are written', () => {
    const statement = statementOf(statementRow(OTP, '2026-10-20', -5, 'Shop'))
    const { added } = statementDryRun(bookOf([]), statement, DAY)

    expect(statementDryRun(bookOf(added), statement, DAY)).toMatchObject({ newRows: 0, alreadyIn: 1, changed: [] })
  })
})

/** A unit that notes what a write does. */
function noting(): { unit: UnitOfWork; added: unknown[]; changed: [unknown, unknown][]; removed: unknown[] } {
  const added: unknown[] = []
  const changed: [unknown, unknown][] = []
  const removed: unknown[] = []
  const unit = {
    of: () => ({
      add: (record: unknown) => added.push(record),
      change: (before: unknown, after: unknown) => changed.push([before, after]),
      remove: (record: unknown) => removed.push(record),
    }),
  } as unknown as UnitOfWork
  return { unit, added, changed, removed }
}

describe('a rule change', () => {
  const groceries = category('Food/Groceries').id
  const corner: SpendingRuleCondition = { column: 'counterparty_contains', fragment: 'Corner' }

  it("re-runs the rules over a rule's rows and rows waiting, and never over rows you set", () => {
    const yours = onFile(OTP, '2026-10-20', -1, { payee: 'Corner', category: category('Food/Coffee').id, categorisedBy: 'person' })
    const waiting = onFile(OTP, '2026-10-21', -2, { payee: 'Corner' })
    const byOldRule = onFile(OTP, '2026-10-22', -3, { payee: 'Corner', category: category('Food/Coffee').id, categorisedBy: 'rule' })
    const typedBlank = row(OTP, '2026-10-23', -4, 'Food/Coffee', { payee: 'Corner' })

    expect(rulesRerun(bookOf([yours, waiting, byOldRule, typedBlank]), [ruleOf(corner, 'Food/Groceries')])).toEqual([
      { before: waiting, after: { ...waiting, category: groceries, categorisedBy: 'rule' } },
      { before: byOldRule, after: { ...byOldRule, category: groceries, categorisedBy: 'rule' } },
    ])
  })

  it('sends the rows of a deleted rule back to review, and takes it out in the same write', () => {
    const rule = ruleOf(corner, 'Food/Groceries')
    const filed = onFile(OTP, '2026-10-22', -3, { payee: 'Corner', category: groceries, categorisedBy: 'rule' })
    const { unit, changed, removed } = noting()

    deleteRule(unit, bookOf([filed], [rule]), rule)

    expect(removed).toEqual([rule])
    expect(changed).toEqual([[filed, { ...filed, category: null, categorisedBy: null }]])
  })

  it('holds a rule on an income category for money in only, so a later purchase from that payee waits on review', () => {
    const rules = [ruleOf({ column: 'counterparty_contains', fragment: 'Zara' }, 'Income/Other income')]
    const run = statementDryRun(bookOf([], rules), statementOf(statementRow(OTP, '2026-10-20', -50, 'Zara'), statementRow(OTP, '2026-10-21', 50, 'Zara')), DAY)

    expect(run.added.map((row) => [row.amount, row.category, row.categorisedBy])).toEqual([
      [euros(-50), null, null],
      [euros(50), category('Income/Other income').id, 'rule'],
    ])
  })

  it('lets a later rule take a purchase an income rule passes over, and sends one already filed by it back to review', () => {
    const income = ruleOf({ column: 'counterparty_contains', fragment: 'Zara' }, 'Income/Other income', 1)
    const spending = ruleOf({ column: 'counterparty_contains', fragment: 'Zara' }, 'Personal/Clothes and shoes', 2)
    const purchase = onFile(OTP, '2026-10-20', -50, { payee: 'Zara' })
    const filed = onFile(OTP, '2026-10-21', -60, { payee: 'Zara', category: category('Income/Other income').id, categorisedBy: 'rule' })

    expect(rulesRerun(bookOf([purchase]), [income, spending])[0]?.after.category).toBe(category('Personal/Clothes and shoes').id)
    expect(rulesRerun(bookOf([filed]), [income])).toEqual([{ before: filed, after: { ...filed, category: null, categorisedBy: null } }])
  })

  it('leaves a spending rule on money in, where it is a refund', () => {
    const refund = onFile(OTP, '2026-10-20', 40, { payee: 'Zara' })

    expect(rulesRerun(bookOf([refund]), [ruleOf({ column: 'counterparty_contains', fragment: 'Zara' }, 'Personal/Clothes and shoes')])[0]?.after.category).toBe(
      category('Personal/Clothes and shoes').id,
    )
  })

  it('says how many rows a rule would file, without writing it', () => {
    const waiting = [onFile(OTP, '2026-10-20', -1, { payee: 'Corner' }), onFile(OTP, '2026-10-21', -2, { payee: 'CORNER 12' }), onFile(OTP, '2026-10-22', -3, { payee: 'Other' })]
    const yours = onFile(OTP, '2026-10-23', -4, { payee: 'Corner', category: category('Food/Coffee').id, categorisedBy: 'person' })
    const held = ruleOf(corner, 'Food/Coffee')

    expect(rowsRuleWouldFile(bookOf([...waiting, yours]), corner, groceries)).toBe(2)
    expect(rowsRuleWouldFile(bookOf([...waiting, yours], [held]), corner, groceries)).toBe(2)
    expect(rowsRuleWouldFile(bookOf([yours]), corner, groceries)).toBe(0)
  })

  it('leaves a row you sent back with Not a pair waiting, whatever the rules say', () => {
    const sentBack = onFile(OTP, '2026-10-22', -3, { payee: 'Corner', categorisedBy: 'person' })

    expect(rulesRerun(bookOf([sentBack]), [ruleOf(corner, 'Food/Groceries')])).toEqual([])
  })

  it('leaves a lone leg, a pair and a reader-filed fee where they are, even when a rule fits their payee', () => {
    const between = category('Between my accounts').id
    const leg = onFile(OTP, '2026-10-22', -3, { payee: 'Corner', category: between })
    const paired = onFile(OTP, '2026-10-23', -4, { payee: 'Corner', category: between, pair: transactionId(74) })
    const fee = onFile(OTP, '2026-10-24', -1, { payee: 'Corner', category: category('Money and fees/Bank fees').id })

    expect(rulesRerun(bookOf([leg, paired, fee]), [ruleOf(corner, 'Food/Groceries')])).toEqual([])
  })

  it('moves the rule it already has to the new category, rather than adding a second', () => {
    const rule = ruleOf(corner, 'Food/Coffee')
    const { unit, added, changed } = noting()

    writeRule(unit, bookOf([], [rule]), corner, groceries)

    expect(added).toEqual([])
    expect(changed).toEqual([[rule, { ...rule, category: groceries }]])
  })

  it('adds a new rule last', () => {
    const { unit, added } = noting()

    writeRule(unit, bookOf([], [ruleOf({ column: 'counterparty_iban', iban: 'HR1' }, 'Food/Coffee', 4)]), corner, groceries)

    expect(added).toMatchObject([{ order: 5, condition: corner, category: groceries }])
  })

  it('tests the IBAN of a row that has one, else its payee, and nothing on a row with neither', () => {
    expect(payeeCondition({ payee: 'Shop', counterpartyIban: 'HR1' })).toEqual({ column: 'counterparty_iban', iban: 'HR1' })
    expect(payeeCondition({ payee: 'Shop', counterpartyIban: '' })).toEqual({ column: 'counterparty_contains', fragment: 'Shop' })
    expect(payeeCondition({ payee: '', counterpartyIban: '' })).toBeNull()
  })

  it('states the accounts as own and fills the fields Spending has no use for', () => {
    expect(spendingCategorisationContext({ accounts: ACCOUNTS })).toMatchObject({ clientIbans: new Set(), cardSettlementIbans: new Set(), defaultCurrency: 'EUR' })
    expect(spendingCategorisationContext({ accounts: ACCOUNTS }).ownIbans.has(OTP.iban)).toBe(true)
  })
})

describe('To review', () => {
  it('counts the rows with no category, and lists them newest first', () => {
    const [older, newer] = [onFile(OTP, '2026-10-20', -1), onFile(OTP, '2026-10-21', -2)]
    const book = bookOf([older, newer, row(OTP, '2026-10-22', -3, 'Food/Coffee')])

    expect(reviewCount(book)).toBe(2)
    expect(reviewQueue(book, DAY).waiting.map(({ row: waiting }) => waiting)).toEqual([newer, older])
  })

  it('never offers a typed row waiting on review against itself', () => {
    const typedLeg = row(OTP, '2026-10-21', 30, null)

    expect(reviewQueue(bookOf([typedLeg]), DAY).waiting[0]?.maybeTyped).toBeNull()
  })

  it('offers a near typed row on the waiting row', () => {
    const typed = row(OTP, '2026-10-20', -10, 'Food/Coffee')
    const bank = onFile(OTP, '2026-10-21', -10.5)

    expect(reviewQueue(bookOf([typed, bank]), DAY).waiting[0]?.maybeTyped).toEqual({ typed, bank, difference: euros(-0.5) })
  })

  it('offers a typed row of the same money too, since one typed after the import never met a dry run', () => {
    const typed = row(OTP, '2026-10-20', -10, 'Food/Coffee')
    const bank = onFile(OTP, '2026-10-21', -10)

    expect(reviewQueue(bookOf([typed, bank]), DAY).waiting[0]?.maybeTyped).toEqual({ typed, bank, difference: euros(0) })
  })

  it('offers an amount and date alone as a transfer on both rows, and stops once you said no', () => {
    const debit = onFile(OTP, '2026-10-20', -60)
    const credit = onFile(REVOLUT_EUR, '2026-10-21', 60)
    const offered = reviewQueue(bookOf([debit, credit]), DAY).waiting.map((waiting) => waiting.maybeTransfer)

    expect(offered).toEqual([
      { debit, credit },
      { debit, credit },
    ])
    expect(reviewQueue(bookOf([{ ...debit, categorisedBy: 'person' }, credit]), DAY).waiting.map((waiting) => waiting.maybeTransfer)).toEqual([null, null])
  })

  it('lists a pair of the last 30 days once, the typed kind and older ones left out, and a lone leg apart', () => {
    const between = category('Between my accounts').id
    const [debitId, creditId] = [transactionId(50), transactionId(51)]
    const debit = onFile(OTP, '2026-10-20', -75, { id: debitId, category: between, pair: creditId })
    const credit = onFile(REVOLUT_EUR, '2026-10-20', 75, { id: creditId, category: between, pair: debitId })
    const lone = onFile(OTP, '2026-10-25', -20, { category: between })
    const [typedOut, typedIn] = [transactionId(52), transactionId(53)]
    const typed = [row(OTP, '2026-10-21', -5, 'Between my accounts', { id: typedOut, pair: typedIn }), row(REVOLUT_EUR, '2026-10-21', 5, 'Between my accounts', { id: typedIn, pair: typedOut })]
    const queue = reviewQueue(bookOf([debit, credit, lone, ...typed]), DAY)

    expect(queue.pairs).toEqual([{ debit, credit }])
    expect(queue.loneLegs).toEqual([lone])
  })
})

describe('what To review and the import write', () => {
  const between = category('Between my accounts').id

  it('writes a dry run in one unit', () => {
    const typed = row(OTP, '2026-10-19', -5, 'Food/Coffee')
    const run = statementDryRun(bookOf([typed]), statementOf(statementRow(OTP, '2026-10-20', -5, 'Coffee'), statementRow(OTP, '2026-10-21', -7, 'Shop')), DAY)
    const { unit, added, changed } = noting()

    writeDryRun(unit, run)

    expect(added).toEqual(run.added)
    expect(changed).toEqual(run.changed.map(({ before, after }) => [before, after]))
    expect(added).toHaveLength(1)
    expect(changed).toHaveLength(1)
  })

  it('marks a row you filed as yours', () => {
    const waiting = onFile(OTP, '2026-10-20', -1)
    const { unit, changed } = noting()

    fileRow(unit, waiting, category('Food/Coffee'))

    expect(changed).toEqual([[waiting, { ...waiting, category: category('Food/Coffee').id, categorisedBy: 'person' }]])
  })

  it('leaves a row you filed under Between my accounts a lone leg, which a later statement pairs', () => {
    const topUp = onFile(REVOLUT_EUR, '2026-10-20', 75, { categorisedBy: 'person' })
    const { unit, changed } = noting()

    fileRow(unit, topUp, category('Between my accounts'))
    const filed = changed[0]![1] as Transaction
    const run = statementDryRun(bookOf([filed]), statementOf(statementRow(OTP, '2026-10-21', -75, 'To Revolut', { counterpartyIban: REVOLUT_EUR.iban })), DAY)

    expect(filed).toMatchObject({ category: between, categorisedBy: null })
    expect(run.added[0]?.pair).toBe(filed.id)
  })
})
