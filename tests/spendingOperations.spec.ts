import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { KEPT_BY_KUNA, defaultsOnAdd } from '../src/apps/spending/assistant/operations/proposalLines'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { SPENDING_OPERATIONS } from '../src/apps/spending/assistant/operations/spendingOperations'
import { words } from '../src/apps/spending/assistant/words'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import { BANK_SETUP_OPERATIONS } from '../src/apps/spending/assistant/operations/bankSetupOperations'
import { SET_STARTING_ACCOUNT } from '../src/apps/spending/assistant/operations/startingAccountOperation'
import { lastAccountId, startingAccount } from '../src/apps/spending/entries/infrastructure/lastAccount'
import { BANK_ACCOUNT_LINES } from '../src/apps/spending/bankSync/domain/bankAccountSetup'
import { spendingReader } from '../src/apps/spending/assistant/spendingReader'
import { NO_RATES } from '../src/shared/money/rateBook'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { DESK_ACCOUNTS, DESK_LOAN_TARGETS, EXAMPLE_RECORDS, attachedPhoto, deskBankSetup, deskPorts, spendingDesk } from './fixtures/spendingDesk'
import type { SpendingDesk } from './fixtures/spendingDesk'
import { forgetCaches } from './fixtures/writeBack'
import { addEntries, filedRows } from './fixtures/spending'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import { SETTING_WRITES } from '../src/apps/spending/workbook/application/settingWrites'
import { BANK_SYNC_DEPLOYMENT_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { setSetting } from '../src/shared/storage/application/settingWrites'
import { ACCOUNT_WRITES } from '../src/apps/spending/accounts/application/accountWrites'
import { CATEGORY_RECORDS, ITEM_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BY_DAYS, OUT_OF_EVENTS } from '../src/apps/spending/workbook/domain/event'
import { wholeRowItemId } from '../src/apps/spending/workbook/domain/rowItems'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { expectCountsOfChanges } from './fixtures/cardCounts'
import { stepOf } from './fixtures/operationSteps'
import { writeRows } from '../src/apps/spending/entries/application/rowRecords'
import { exampleInput } from './fixtures/exampleInput'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: SpendingDesk) => store.state.workbook!
const rowOf = (desk: SpendingDesk, id: string) => filedRows(bookOf(desk)).find((row) => row.id === id)
const categoryNamed = (desk: SpendingDesk, name: string) => bookOf(desk).categories.find((category) => category.name === name)!

/** A field's value as the card reads it, where an empty text and a missing value both say nothing. */
function said(value: unknown): unknown {
  return value === undefined || value === '' ? null : value
}

/**
 * The card's names of the fields a change sets, leaving out the ones Kuna keeps by itself, where a rule stands among the rules, and
 * on an add the values a new record holds unless a person sets them, which its card leaves off.
 */
function namesSet(kind: RecordKind<unknown>, before: Readonly<Record<string, unknown>> | null, after: Readonly<Record<string, unknown>>): string[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after)])].filter((field) => !KEPT_BY_KUNA.has(field) && !(kind.name === 'rule' && field === 'order'))
  const unchanged = before ?? defaultsOnAdd(kind)
  const altered = fields.filter((field) => JSON.stringify(said(unchanged[field])) !== JSON.stringify(said(after[field])))
  return altered.map((field) => (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field)
}

describe('a new category or account on its card', () => {
  const fieldNames = (desk: SpendingDesk) => desk.cards.at(-1)!.groups.flatMap((group) => group.lines.flatMap((line) => line.fields.map((field) => field.name)))

  it('leaves off what a new one holds unless a person sets it, and shows it when a step sets it', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'add-category', { name: 'Pets', kind: 'spending' })])
    expect(fieldNames(desk)).not.toContain(words.proposals.fields.hidden)
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'add-category', { name: 'Pets', kind: 'spending', hidden: 'yes' })])
    expect(fieldNames(desk)).toContain(words.proposals.fields.hidden)
  })
})

/** A change-entry step that sets only the given fields. */
function changeEntry(desk: SpendingDesk, entry: string, fields: Readonly<Record<string, unknown>>) {
  return {
    op: 'change-entry',
    input: { entry: desk.ref('transaction', entry), account: null, kind: null, category: null, date: null, amount: null, payee: null, note: null, ...fields },
  }
}

describe('every Spending operation', () => {
  it.each(SPENDING_OPERATIONS.map((operation) => [operation.name, operation] as const))(
    'has an example that passes the checks of the file, and a card that names every field it sets: %s',
    async (_name, operation) => {
      expect(Object.keys(operation.input.type === 'object' ? operation.input.properties : {}).filter((field) => KEPT_BY_KUNA.has(field))).toEqual([])
      const desk = await spendingDesk(used, deskPorts(), operation.name === 'move-to-items' ? 'before-items' : 'items')

      const answer = await desk.propose([{ op: operation.name, input: exampleInput(operation, desk, EXAMPLE_RECORDS, attachedPhoto().id) }], [attachedPhoto()])

      expect(answer.text).toContain('The card shows')
      expect(answer.isError).toBe(false)
      const [card] = desk.cards
      expectCountsOfChanges(card!)
      const { changes = [] } = card!.held as { readonly changes?: readonly RuledChange[] }
      const linesTaken = new Map<string, number>()
      const checked = changes.flatMap(({ change }) => {
        if (change.verb === 'repair' || change.verb === 'discard') return []
        const group = card!.groups.find((candidate) => candidate.verb === change.verb && candidate.noun === change.kind.noun)!
        const at = linesTaken.get(`${change.verb}/${change.kind.name}`) ?? 0
        linesTaken.set(`${change.verb}/${change.kind.name}`, at + 1)
        if (change.verb === 'remove') return []
        const before = change.verb === 'change' ? (change.before as Readonly<Record<string, unknown>>) : null
        return [
          {
            shown: group.lines.filter((line) => line.fields.length > 0 || line.warning === null)[at]!.fields.map((field) => field.name),
            set: namesSet(change.kind, before, change.after as Readonly<Record<string, unknown>>),
          },
        ]
      })
      for (const { shown, set } of checked) expect(shown).toEqual(expect.arrayContaining(set))
      expect((await desk.accept()).kind).toBe('done')
    },
  )
})

describe('transfers', () => {
  it('adds both legs, which name each other, and takes them back with one Undo', async () => {
    const desk = await spendingDesk(used)
    const before = bookOf(desk).transactions.length
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-transfer', { from: desk.ref('account', DESK_ACCOUNTS.CURRENT.id), to: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id), date: '2026-11-02', amount: 50, note: '' }),
    ])
    const result = await desk.accept()
    expect(result.kind).toBe('done')
    const [out, into] = bookOf(desk).transactions.slice(before)
    expect([out!.amount, into!.amount]).toEqual([-5000, 5000])
    expect([out!.pair, into!.pair]).toEqual([into!.id, out!.id])
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(bookOf(desk).transactions).toHaveLength(before)
  })

  it('asks what reached an account in another currency, and refuses one account on both sides', async () => {
    const desk = await spendingDesk(used)
    const current = desk.ref('account', DESK_ACCOUNTS.CURRENT.id)
    const transfer = (to: string, toAmount: number | null) => stepOf(SPENDING_OPERATIONS, 'add-transfer', { from: current, to, date: '2026-11-02', amount: 50, toAmount, note: '' })
    const dollars = desk.ref('account', DESK_ACCOUNTS.DOLLARS.id)
    expect((await desk.propose([transfer(dollars, null)])).text).toContain('toAmount')
    expect((await desk.propose([transfer(current, null)])).isError).toBe(true)
    expect((await desk.propose([transfer(dollars, 58.2)])).isError).toBe(false)
    await desk.accept()
    expect(bookOf(desk).transactions.at(-1)!.amount).toBe(5820)
  })

  it('writes what did not arrive in one currency as a fee row on the arrival account in the same write, and refuses more arriving than was sent', async () => {
    const desk = await spendingDesk(used)
    const before = bookOf(desk).transactions.length
    const transfer = (toAmount: number) =>
      stepOf(SPENDING_OPERATIONS, 'add-transfer', {
        from: desk.ref('account', DESK_ACCOUNTS.CURRENT.id),
        to: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id),
        date: '2026-11-02',
        amount: 50,
        toAmount,
        note: '',
      })
    expect((await desk.propose([transfer(50.5)])).text).toContain('not more than amount')
    await desk.propose([transfer(49.5)])
    const result = await desk.accept()
    expect(result.kind).toBe('done')
    const [out, into, fee] = bookOf(desk).transactions.slice(before)
    expect([out!.amount, into!.amount, fee!.amount]).toEqual([-5000, 5000, -50])
    expect(fee).toMatchObject({ account: DESK_ACCOUNTS.SAVINGS.id, pair: null })
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(bookOf(desk).transactions).toHaveLength(before)
  })

  it('keeps a transfer in one currency arriving in full when change-transfer gives a new amount alone', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-transfer', { from: desk.ref('account', DESK_ACCOUNTS.CURRENT.id), to: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id), date: '2026-11-02', amount: 50, note: '' }),
    ])
    await desk.accept()
    const count = bookOf(desk).transactions.length
    const [out] = bookOf(desk).transactions.slice(-2)
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'change-transfer', { entry: desk.ref('transaction', out!.id), amount: 60 })])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).transactions).toHaveLength(count)
    expect(
      bookOf(desk)
        .transactions.slice(-2)
        .map((leg) => leg.amount),
    ).toEqual([-6000, 6000])
  })

  it('turns a plain entry into the leg its money is with no payee, and a kind turns a leg back into a plain entry with its other leg gone', async () => {
    const desk = await spendingDesk(used)
    const entry = EXAMPLE_RECORDS['transaction']!
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'change-transfer', { entry: desk.ref('transaction', entry), to: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id) })])
    expect((await desk.accept()).kind).toBe('done')
    const leg = rowOf(desk, entry)!
    expect(leg.amount).toBe(-4530)
    expect(leg.category).toBe(categoryNamed(desk, 'Between my accounts').id)
    const other = leg.pair!
    expect(rowOf(desk, other)!.amount).toBe(4530)
    expect([leg.payee, rowOf(desk, other)!.payee]).toEqual(['', ''])

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'change-entry', { entry: desk.ref('transaction', entry), kind: 'out', category: desk.ref('category', categoryNamed(desk, 'Groceries').id) })])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, entry)).toMatchObject({ pair: null, amount: -4530 })
    expect(rowOf(desk, other)).toBeUndefined()
  })

  it('refuses a new date, amount or account on one leg of a transfer, which change-transfer moves on both', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-transfer', { from: desk.ref('account', DESK_ACCOUNTS.CURRENT.id), to: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id), date: '2026-11-02', amount: 50, note: '' }),
    ])
    await desk.accept()
    const [out, into] = filedRows(bookOf(desk)).slice(-2)
    for (const fields of [{ date: '2026-11-03' }, { amount: -60 }, { account: desk.ref('account', DESK_ACCOUNTS.WALLET.id) }]) {
      const answer = await desk.propose([changeEntry(desk, out!.id, fields)])
      expect(answer.isError).toBe(true)
      expect(answer.text).toContain('change-transfer')
    }
    expect([rowOf(desk, out!.id), rowOf(desk, into!.id)]).toEqual([out, into])

    expect((await desk.propose([changeEntry(desk, out!.id, { note: 'Rent money' })])).isError).toBe(false)
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, out!.id)).toMatchObject({ note: 'Rent money', pair: into!.id, date: out!.date, amount: out!.amount })
  })

  it('refuses a payee on one leg of a transfer, and takes one once a kind makes the leg a plain entry', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-transfer', { from: desk.ref('account', DESK_ACCOUNTS.CURRENT.id), to: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id), date: '2026-11-02', amount: 50, note: '' }),
    ])
    await desk.accept()
    const [out, into] = filedRows(bookOf(desk)).slice(-2)

    const answer = await desk.propose([changeEntry(desk, out!.id, { payee: 'Landlord' })])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('takes no payee')
    expect([rowOf(desk, out!.id), rowOf(desk, into!.id)]).toEqual([out, into])

    expect((await desk.propose([changeEntry(desk, out!.id, { kind: 'out', payee: 'Landlord' })])).isError).toBe(false)
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, out!.id)).toMatchObject({ payee: 'Landlord', pair: null })
  })

  it('refuses moving a row a statement brought to another account', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'change-entry', { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction-receipt']!), account: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id) }),
    ])
    expect(answer.isError).toBe(true)
  })
})

describe('an entry’s day and account', () => {
  it('refuses a new day before its account opened', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([changeEntry(desk, EXAMPLE_RECORDS['transaction']!, { date: '2025-12-31' })])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('before the account opened')
  })

  it('refuses another account that opened after the day the entry keeps', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-account', { name: 'New card', kind: 'bank', currency: 'EUR', opening: 0, openedOn: '2026-11-01', rowsFrom: 'by-hand' }, '$card'),
      changeEntry(desk, EXAMPLE_RECORDS['transaction']!, { account: '$card' }),
    ])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('before the account opened')
  })
})

describe('where an account takes its rows from', () => {
  const added = (name: string, kind: string, iban: string | null, rowsFrom: string) =>
    stepOf(SPENDING_OPERATIONS, 'add-account', { name, kind, currency: 'EUR', opening: 0, openedOn: '2026-11-01', iban, rowsFrom })
  const saveDeployment = (desk: SpendingDesk) => desk.store.write('Saved', (unit) => setSetting(unit, SETTING_WRITES, [], BANK_SYNC_DEPLOYMENT_KEY, 'AKfy-deployment'))
  const rowsFromOf = (desk: SpendingDesk, name: string) => bookOf(desk).accounts.find((account) => account.name === name)?.rowsFrom

  it('refuses a bank link until a bank sync deployment is saved, then takes one with an IBAN', async () => {
    const desk = await spendingDesk(used)
    expect((await desk.propose([added('Card', 'bank', 'HR1723600001101234565', 'bank-link')])).text).toContain('once the person saves a bank sync deployment')
    await saveDeployment(desk)
    expect((await desk.propose([added('Card', 'bank', null, 'bank-link')])).text).toContain("needs the account's IBAN")
    expect((await desk.propose([added('Jar', 'cash', null, 'bank-link')])).isError).toBe(true)
    await desk.propose([added('Card', 'bank', 'HR1723600001101234565', 'bank-link'), added('Typed card', 'bank', 'HR1723600001101234566', 'by-hand')])
    expect((await desk.accept()).kind).toBe('done')
    expect(['Card', 'Typed card'].map((name) => rowsFromOf(desk, name))).toEqual(['bank-link', 'by-hand'])
  })

  it('tells the chat whether a bank link is offered, and never the deployment', async () => {
    const desk = await spendingDesk(used)
    const offered = () => {
      const reader = spendingReader({
        status: () => 'open',
        book: () => bookOf(desk),
        rates: () => NO_RATES,
        bankSetup: deskBankSetup,
        qrTextOn: async () => null,
        linkTargets: () => DESK_LOAN_TARGETS,
        linkSource: () => 'loans',
      })
      return reader.kinds
        .find((kind) => kind.name === 'bank-sync')!
        .rows()[0]!
        .fields.find((field) => field.name === 'bankLinkOffered')
    }
    expect(offered()).toMatchObject({ value: false })
    await saveDeployment(desk)
    expect(offered()).toMatchObject({ value: true })
    expect(JSON.stringify(offered())).not.toContain('AKfy-deployment')
  })

  it("keeps the date and amount of the bank's row on an account the bank fills, and files it all the same", async () => {
    const desk = await spendingDesk(used)
    await saveDeployment(desk)
    const current = bookOf(desk).accounts.find((account) => account.id === DESK_ACCOUNTS.CURRENT.id)!
    const synced = {
      ...rowOf(desk, EXAMPLE_RECORDS['transaction']!)!,
      id: recordIdOf(TRANSACTION_RECORDS, 'synced-row'),
      account: current.id,
      source: 'statement' as const,
      importKey: 'bank-synced-row',
      pair: null,
    }
    await desk.store.write('Linked', (unit) => {
      unit.of(ACCOUNT_WRITES).change(current, { ...current, rowsFrom: 'bank-link' })
      addEntries(unit, desk.store.state.records!, [synced])
    })
    const change = (fields: Record<string, unknown>) => ({
      op: 'change-entry',
      input: { entry: desk.ref('transaction', synced.id), account: null, kind: null, category: null, date: null, amount: null, payee: null, note: null, ...fields },
    })
    expect((await desk.propose([change({ amount: -1 })])).text).toContain('so its date and amount stay')
    expect((await desk.propose([change({ date: '2026-11-02' })])).isError).toBe(true)
    await desk.propose([change({ note: 'Checked', payee: 'Corner market' })])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, synced.id)).toMatchObject({ note: 'Checked', amount: synced.amount, date: synced.date })
  })

  it('switches an account typed by hand to a bank link only while a deployment is saved, and back to by hand', async () => {
    const desk = await spendingDesk(used)
    const current = desk.ref('account', DESK_ACCOUNTS.CURRENT.id)
    const change = (rowsFrom: string) => stepOf(SPENDING_OPERATIONS, 'change-account', { account: current, rowsFrom })
    expect((await desk.propose([change('bank-link')])).isError).toBe(true)
    await saveDeployment(desk)
    await desk.propose([change('bank-link')])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsFromOf(desk, 'Current')).toBe('bank-link')
    await desk.propose([change('by-hand')])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsFromOf(desk, 'Current')).toBe('by-hand')
  })
})

describe("an account's cards", () => {
  it("sets an account's cards, reads them back, refuses one that is not four digits and clears them", async () => {
    const desk = await spendingDesk(used)
    const current = desk.ref('account', DESK_ACCOUNTS.CURRENT.id)
    const cardsOf = () => bookOf(desk).accounts.find((account) => account.name === 'Current')?.cards
    const change = (cards: string) => stepOf(SPENDING_OPERATIONS, 'change-account', { account: current, cards })
    expect((await desk.propose([change('*3670')])).isError).toBe(true)
    await desk.propose([change('3670, 1234')])
    expect((await desk.accept()).kind).toBe('done')
    expect(cardsOf()).toEqual(['3670', '1234'])
    await desk.propose([change('')])
    expect((await desk.accept()).kind).toBe('done')
    expect(cardsOf()).toEqual([])
  })
})

describe('To review', () => {
  it('joins, pairs and unpairs only what To review offers', async () => {
    const desk = await spendingDesk(used)
    const typedRow = desk.ref('transaction', EXAMPLE_RECORDS['transaction']!)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'join-rows', { row: typedRow })])).isError).toBe(true)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'pair-rows', { row: typedRow })])).isError).toBe(true)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'unpair-rows', { row: typedRow })])).isError).toBe(true)

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'pair-rows', { row: desk.ref('transaction', EXAMPLE_RECORDS['transaction-pairable']!) })])
    expect((await desk.accept()).kind).toBe('done')
    const paired = rowOf(desk, EXAMPLE_RECORDS['transaction-pairable']!)!
    expect(paired.pair).not.toBeNull()

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'unpair-rows', { row: desk.ref('transaction', paired.id) })])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, paired.id)).toMatchObject({ pair: null, category: null, categorisedBy: 'person' })
  })

  it('joins a bank row with the typed row, which takes the bank’s amount', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'join-rows', { row: desk.ref('transaction', EXAMPLE_RECORDS['transaction-joinable']!) })])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, EXAMPLE_RECORDS['transaction-joinable']!)).toBeUndefined()
    expect(bookOf(desk).transactions.find((row) => row.payee === 'Pharmacy')!.amount).toBe(-3100)
  })

  it('moves a withdrawal To review lists to cash, and refuses a row it does not list or an account it does not offer', async () => {
    const desk = await spendingDesk(used)
    const withdrawal = desk.ref('transaction', EXAMPLE_RECORDS['transaction-withdrawal']!)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'move-to-cash', { row: desk.ref('transaction', EXAMPLE_RECORDS['transaction']!) })])).isError).toBe(true)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'move-to-cash', { row: withdrawal, cash_account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id) })])).isError).toBe(true)

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'move-to-cash', { row: withdrawal })])
    expect((await desk.accept()).kind).toBe('done')
    const leg = bookOf(desk).transactions.find((row) => row.account === DESK_ACCOUNTS.WALLET.id)
    expect(leg).toMatchObject({ amount: accountMoneyFromAmount(50), pair: EXAMPLE_RECORDS['transaction-withdrawal'] })
  })
})

describe('a withdrawal that is not cash', () => {
  it('leaves the row where it is filed and off the list, and refuses a row To review does not list', async () => {
    const desk = await spendingDesk(used)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'not-cash', { row: desk.ref('transaction', EXAMPLE_RECORDS['transaction']!) })])).isError).toBe(true)

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'not-cash', { row: desk.ref('transaction', EXAMPLE_RECORDS['transaction-withdrawal']!) })])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, EXAMPLE_RECORDS['transaction-withdrawal']!)).toMatchObject({ categorisedBy: 'person', pair: null })
  })
})

describe('a rule card', () => {
  it('says how many rows already in the book would change, and writes only the rule on Only new rows', async () => {
    const desk = await spendingDesk(used)
    const rent = categoryNamed(desk, 'Rent')
    const out = EXAMPLE_RECORDS['transaction-pairable']!
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-rule', {
        conditions: [
          { test: 'amount_at_least', values: ['200'], not: false },
          { test: 'money_out', values: [], not: false },
          { test: 'iban_none', values: [], not: false },
        ],
        category: desk.ref('category', rent.id),
      }),
    ])
    const [card] = desk.cards
    expect(card!.narrower?.label).toBe('Only new rows')
    expect(card!.groups.flatMap((group) => group.notes).map((note) => note.text)).toContain('1 row already in the book would change. Rows you filed yourself keep their category either way.')
    expect(card!.narrower!.proposal.count).toBe(1)
    expect(card!.narrower!.proposal.groups.flatMap((group) => group.notes)).toEqual([])
    expect((await desk.accept(0, true)).kind).toBe('done')
    expect(bookOf(desk).rules.some((rule) => rule.category === rent.id)).toBe(true)
    expect(rowOf(desk, out)).toMatchObject({ category: null, categorisedBy: null })
  })

  it('offers no Only new rows when no row already in the book would change', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-rule', { conditions: [{ test: 'payee_contains', values: ['Nobody at all'], not: false }], category: desk.ref('category', categoryNamed(desk, 'Rent').id) }),
    ])
    expect(desk.cards[0]!.narrower).toBeUndefined()
  })
})

describe('a rule that spots cash taken out', () => {
  it('adds one into Between my accounts with the cash account named, and changes it to the cash account of the currency', async () => {
    const desk = await spendingDesk(used)
    const between = categoryNamed(desk, 'Between my accounts')
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-rule', {
        conditions: [{ test: 'payee_contains', values: ['Bankomat'], not: false }],
        category: desk.ref('category', between.id),
        withdrawal: 'yes',
        cash_account: desk.ref('account', DESK_ACCOUNTS.WALLET.id),
      }),
    ])
    expect((await desk.accept()).kind).toBe('done')
    const rule = bookOf(desk).rules.find((each) => each.category === between.id)!
    expect(rule.withdrawal).toEqual({ cashAccount: DESK_ACCOUNTS.WALLET.id })

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'change-rule', { rule: desk.ref('rule', rule.id), withdrawal: 'yes' })])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).rules.find((each) => each.id === rule.id)!.withdrawal).toEqual({ cashAccount: null })
  })

  it('refuses one that spots cash taken out into a spending category', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-rule', {
        conditions: [{ test: 'payee_contains', values: ['Bankomat'], not: false }],
        category: desk.ref('category', categoryNamed(desk, 'Rent').id),
        withdrawal: 'yes',
      }),
    ])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Between my accounts')
  })
})

describe('categories and accounts', () => {
  it('moves a category to another group, last there, with its colour, and up among the groups', async () => {
    const desk = await spendingDesk(used)
    const restaurants = categoryNamed(desk, 'Restaurants')
    const rent = categoryNamed(desk, 'Rent')
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'change-category', { category: desk.ref('category', restaurants.id), group: desk.ref('category', rent.id), colour: '#2A78D6' }),
      stepOf(SPENDING_OPERATIONS, 'move-category', { category: desk.ref('category', rent.id), direction: 'up' }),
    ])
    const fields = desk.cards[0]!.groups.flatMap((group) => group.lines).flatMap((line) => line.fields.map((field) => field.name))
    expect(fields).toEqual(expect.arrayContaining(['Group', 'Colour', 'Place']))
    expect((await desk.accept()).kind).toBe('done')
    expect(categoryNamed(desk, 'Restaurants')).toMatchObject({ parent: rent.id, order: 1, colour: '#2a78d6' })
    expect(categoryNamed(desk, 'Rent').order).toBeLessThan(categoryNamed(desk, 'Food').order)
  })

  it('refuses a group for a group, more than a name for a fixed category, a colour too pale for the light theme, and a move past the end, and takes an own colour', async () => {
    const desk = await spendingDesk(used)
    const ref = (name: string) => desk.ref('category', categoryNamed(desk, name).id)
    const change = (category: string, fields: Record<string, unknown>) => ({ op: 'change-category', input: { category, name: null, group: null, colour: null, hidden: null, ...fields } })
    expect((await desk.propose([change(ref('Rent'), { group: ref('Food') })])).isError).toBe(true)
    expect((await desk.propose([change(ref('Between my accounts'), { hidden: 'yes' })])).isError).toBe(true)
    expect((await desk.propose([change(ref('Groceries'), { colour: '#ffd27a' })])).isError).toBe(true)
    expect((await desk.propose([change(ref('Groceries'), { colour: '#7A3E12' })])).isError).toBe(false)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'move-category', { category: ref('Food'), direction: 'up' })])).isError).toBe(true)
  })

  it('keeps the currency of an account with entries, deletes only an empty one, and takes a bank, an IBAN and cards off cash', async () => {
    const desk = await spendingDesk(used)
    const current = desk.ref('account', DESK_ACCOUNTS.CURRENT.id)
    const change = (fields: Record<string, unknown>) => ({
      op: 'change-account',
      input: { account: current, name: null, kind: null, bank: null, currency: null, opening: null, openedOn: null, iban: null, cards: null, rowsFrom: null, alsoFrom: null, closed: null, ...fields },
    })
    expect((await desk.propose([change({ currency: 'USD' })])).isError).toBe(true)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'delete-account', { account: current })])).isError).toBe(true)
    await desk.propose([change({ kind: 'cash', cards: '3670' })])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).accounts.find((account) => account.id === DESK_ACCOUNTS.CURRENT.id)).toMatchObject({ kind: 'cash', bank: null, iban: '', cards: [] })
  })

  const moveStart = (desk: SpendingDesk, openedOn: string) => stepOf(SPENDING_OPERATIONS, 'change-account', { account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id), openedOn })

  it('moves the start day later as the dialog does: the card says what goes, the opening keeps the balance, and the other leg stays alone', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([moveStart(desk, '2026-10-29')])
    const notes = desk.cards[0]!.groups.flatMap((group) => group.notes)
    expect(notes).toEqual([
      {
        label: 'Current',
        text: "Moving the opening balance day to 29 Oct 2026 deletes what came before it: 6 entries, 1 receipt and 1 split part. The other leg of 1 transfer stays on Savings as a lone row under Between my accounts. The opening balance becomes €573.70, so today's balance stays. You can change it.",
        tone: 'warning',
      },
    ])
    expect((await desk.accept()).kind).toBe('done')
    const book = bookOf(desk)
    expect(book.accounts.find((account) => account.id === DESK_ACCOUNTS.CURRENT.id)).toMatchObject({ openedOn: '2026-10-29', opening: accountMoneyFromAmount(573.7) })
    expect(book.transactions.filter((row) => row.account === DESK_ACCOUNTS.CURRENT.id).map((row) => row.id)).toEqual([EXAMPLE_RECORDS['transaction-split']])
    expect(book.receipts.map((receipt) => receipt.id)).toEqual([EXAMPLE_RECORDS['receipt-waiting']])
    expect(rowOf(desk, EXAMPLE_RECORDS['transaction-paired']!.replace('paired-out', 'paired-in'))).toMatchObject({ pair: null, category: categoryNamed(desk, 'Between my accounts').id })
    expect(book.problems).toEqual([])
  })

  it('says the bank reaches back only about 90 days when the start day moves earlier, and deletes nothing', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([moveStart(desk, '2025-06-01')])
    expect(desk.cards[0]!.groups.flatMap((group) => group.notes)).toEqual([
      { label: 'Current', text: 'The bank sync brings only about the last 90 days, so older rows come from a statement file.', tone: 'neutral' },
    ])
    expect(desk.cards[0]!.groups.map((group) => group.verb)).toEqual(['change'])
  })
})

describe('an entry split by hand', () => {
  const split = (desk: SpendingDesk, entry: string, parts: readonly { readonly amount: number | null; readonly category: string; readonly note?: string }[]) =>
    stepOf(SPENDING_OPERATIONS, 'split-entry', {
      entry: desk.ref('transaction', entry),
      parts: parts.map((part) => ({ part: null, amount: part.amount, category: desk.ref('category', part.category), note: part.note ?? '' })),
    })
  const typed = EXAMPLE_RECORDS['transaction']!

  it('splits an entry into three parts signed as the entry, under the category with most of the money, and one Undo puts it back', async () => {
    const desk = await spendingDesk(used)
    const before = rowOf(desk, typed)
    await desk.propose([
      split(desk, typed, [
        { amount: 10, category: EXAMPLE_RECORDS['category']!, note: 'Light bulbs' },
        { amount: 15.3, category: categoryNamed(desk, 'For the company').id },
        { amount: null, category: EXAMPLE_RECORDS['category-other']! },
      ]),
    ])
    expect((await desk.accept()).kind).toBe('done')
    const parts = bookOf(desk).items.filter((part) => part.transaction === typed)
    expect(parts.map((part) => [part.amount, part.note, part.receipt])).toEqual([
      [accountMoneyFromAmount(-10), 'Light bulbs', null],
      [accountMoneyFromAmount(-15.3), '', null],
      [accountMoneyFromAmount(-20), '', null],
    ])
    expect(rowOf(desk, typed)).toMatchObject({ category: EXAMPLE_RECORDS['category-other'], categorisedBy: 'person', amount: before!.amount })
    expect(bookOf(desk).problems).toEqual([])
  })

  it('takes the one part of an entry not split yet by its ref, which the first part keeps', async () => {
    const desk = await spendingDesk(used)
    const whole = wholeRowItemId(rowOf(desk, typed)!)
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'split-entry', {
        entry: desk.ref('transaction', typed),
        parts: [
          { part: null, amount: 10, category: desk.ref('category', EXAMPLE_RECORDS['category']!), note: '' },
          { part: desk.ref(ITEM_RECORDS.name, whole), amount: null, category: desk.ref('category', EXAMPLE_RECORDS['category-other']!), note: '' },
        ],
      }),
    ])
    expect((await desk.accept()).kind).toBe('done')
    expect(
      bookOf(desk)
        .items.filter((part) => part.transaction === typed)
        .map((part) => part.id),
    ).toEqual([whole, expect.any(String)])
    expect(bookOf(desk).problems).toEqual([])
  })

  it('splits an entry twice on one card, the second split in place of the first', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([
      split(desk, typed, [
        { amount: 10, category: EXAMPLE_RECORDS['category']! },
        { amount: null, category: EXAMPLE_RECORDS['category-other']! },
      ]),
      split(desk, typed, [
        { amount: 20, category: EXAMPLE_RECORDS['category']! },
        { amount: null, category: EXAMPLE_RECORDS['category-other']! },
      ]),
    ])
    expect(answer.isError).toBe(false)
    expect((await desk.accept()).kind).toBe('done')

    expect(bookOf(desk).problems).toEqual([])
    expect(
      bookOf(desk)
        .items.filter((part) => part.transaction === typed)
        .map((part) => part.amount),
    ).toEqual([accountMoneyFromAmount(-20), accountMoneyFromAmount(-25.3)])
  })

  it.each([
    ['one part', [{ amount: null, category: 'category' }], 'at least two parts'],
    [
      'no rest',
      [
        { amount: 10, category: 'category' },
        { amount: 35.3, category: 'category-other' },
      ],
      'Exactly one part takes the rest',
    ],
    [
      'an amount below zero',
      [
        { amount: -10, category: 'category' },
        { amount: null, category: 'category-other' },
      ],
      'Type each amount above zero',
    ],
    [
      'amounts that leave no rest',
      [
        { amount: 45.3, category: 'category' },
        { amount: null, category: 'category-other' },
      ],
      'nothing is left for the rest',
    ],
    [
      'a group with children',
      [
        { amount: 10, category: 'category-group' },
        { amount: null, category: 'category-other' },
      ],
      'Pick a category inside the group',
    ],
  ] as const)('refuses %s with why', async (_name, parts, why) => {
    const desk = await spendingDesk(used)
    const named = (key: string) => (key === 'category-group' ? categoryNamed(desk, 'Food').id : EXAMPLE_RECORDS[key]!)
    const answer = await desk.propose([
      split(
        desk,
        typed,
        parts.map((part) => ({ ...part, category: named(part.category) })),
      ),
    ])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain(why)
  })

  it("refuses a transfer's leg and an entry a receipt split, whose lines only remove-receipt takes off", async () => {
    const desk = await spendingDesk(used)
    const parts = [
      { amount: 1, category: EXAMPLE_RECORDS['category']! },
      { amount: null, category: EXAMPLE_RECORDS['category-other']! },
    ]
    expect((await desk.propose([split(desk, EXAMPLE_RECORDS['transaction-paired']!, parts)])).text).toContain('A move between your accounts stays whole')
    expect((await desk.propose([split(desk, EXAMPLE_RECORDS['transaction-receipt']!, parts)])).text).toContain('A receipt split this entry')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'remove-split', { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction-receipt']!) })])).text).toContain('remove-receipt')
  })

  it('takes a hand split off and keeps the row under its main category, refuses an entry that is not split, and leaves it to remove-split', async () => {
    const desk = await spendingDesk(used)
    const handSplit = EXAMPLE_RECORDS['transaction-split']!
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'remove-split', { entry: desk.ref('transaction', typed) })])).text).toContain('not split')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'remove-receipt', { entry: desk.ref('transaction', handSplit) })])).text).toContain('no receipt')
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'remove-split', { entry: desk.ref('transaction', handSplit) })])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).items.filter((part) => part.transaction === handSplit)).toMatchObject([{ id: wholeRowItemId({ id: handSplit as RecordId }), receipt: null }])
    expect(rowOf(desk, handSplit)).toMatchObject({ category: EXAMPLE_RECORDS['category'] })
  })
})

describe('an entry’s receipt and payee', () => {
  it('takes a receipt off and keeps the entry, and refuses an entry with none', async () => {
    const desk = await spendingDesk(used)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'remove-receipt', { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction']!) })])).isError).toBe(true)
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'remove-receipt', { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction-receipt']!) })])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).receipts.map((receipt) => receipt.id)).toEqual([EXAMPLE_RECORDS['receipt-waiting']])
    expect(rowOf(desk, EXAMPLE_RECORDS['transaction-receipt']!)).toBeDefined()
  })

  it("refiles a receipt's line under another category with new words, keeps its amount and the entry's account, and one Undo puts it back", async () => {
    const desk = await spendingDesk(used)
    const entry = EXAMPLE_RECORDS['transaction-receipt']!
    const line = EXAMPLE_RECORDS['item-receipt-line']!
    const refile = (fields: Readonly<Record<string, unknown>>, on = entry) =>
      stepOf(SPENDING_OPERATIONS, 'refile-receipt', { entry: desk.ref('transaction', on), lines: [{ line: desk.ref('item', line), category: null, note: null, ...fields }] })
    expect((await desk.propose([refile({}, EXAMPLE_RECORDS['transaction']!)])).text).toContain('no receipt')
    expect(
      (await desk.propose([refile({ category: desk.ref('category', EXAMPLE_RECORDS['category-other']!) }), refile({ line: desk.ref('item', recordIdOf(ITEM_RECORDS, 'line-hardware-rent')) })])).text,
    ).toContain('receipt lines')
    expect((await desk.propose([refile({ category: desk.ref('category', recordIdOf(CATEGORY_RECORDS, 'category-food')) })])).text).toContain('inside the group')

    await desk.propose([refile({ category: desk.ref('category', EXAMPLE_RECORDS['category-child']!), note: ' Bread for the trip ' })])
    const result = await desk.accept()

    expect(result.kind).toBe('done')
    expect(bookOf(desk).items.filter((part) => part.transaction === entry)).toMatchObject([
      { id: line, category: EXAMPLE_RECORDS['category-child'], note: 'Bread for the trip', amount: accountMoneyFromAmount(-20) },
    ])
    expect(rowOf(desk, entry)).toMatchObject({ account: DESK_ACCOUNTS.CURRENT.id, amount: accountMoneyFromAmount(-20) })
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(bookOf(desk).items.filter((part) => part.transaction === entry)).toMatchObject([{ id: line, category: EXAMPLE_RECORDS['category-other'], note: '' }])
  })

  it('flags a payee as a person, and a second flag changes nothing', async () => {
    const desk = await spendingDesk(used)
    const flag = stepOf(SPENDING_OPERATIONS, 'flag-person', { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction']!) })
    await desk.propose([flag])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).settings.personPayees).toContain('Corner market')
    expect((await desk.propose([flag])).isError).toBe(true)
  })
})

describe('an entry’s link to Loans', () => {
  it("links entries to instalments by loan and due date, splits each into the plan's interest and principal under one Loan principal it adds, shows the link on the card as Entries does, and one Undo takes it all back", async () => {
    const desk = await spendingDesk(used)
    const entry = EXAMPLE_RECORDS['transaction']!
    const other = EXAMPLE_RECORDS['transaction-joinable']!
    const before = bookOf(desk)
    const category = rowOf(desk, entry)!.category
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'link-entry', { entry: desk.ref('transaction', entry), loan: 'Housing loan', due: '2026-11-15' }),
      stepOf(SPENDING_OPERATIONS, 'link-entry', { entry: desk.ref('transaction', other), loan: 'Housing loan', due: '2026-10-15' }),
    ])
    const fields = desk.cards[0]!.groups.flatMap((group) => group.lines).flatMap((line) => line.fields)
    expect(fields.find((field) => field.name === 'Linked to')).toMatchObject({ after: 'Housing loan, instalment 15 of 300, due 15 Nov 2026' })
    const result = await desk.accept()
    expect(result.kind).toBe('done')
    const principal = bookOf(desk).categories.filter((held) => held.kind === 'repayment')
    expect(principal.map((held) => held.name)).toEqual(['Loan principal'])
    // The entry is 45.30 against the plan's 650.00, so the 604.70 below the plan stays as a part of the other sign.
    expect(
      bookOf(desk)
        .items.filter((part) => part.transaction === entry)
        .map((part) => [part.amount, part.category, part.note, part.link?.due]),
    ).toEqual([
      [accountMoneyFromAmount(-250), category, 'Interest', '2026-11-15'],
      [accountMoneyFromAmount(-400), principal[0]!.id, '', '2026-11-15'],
      [accountMoneyFromAmount(604.7), category, 'Difference from the plan', '2026-11-15'],
    ])
    expect(bookOf(desk).problems).toEqual([])
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect([bookOf(desk).categories, bookOf(desk).items]).toEqual([before.categories, before.items])
  })

  it("links a movement already in Loans by its loan's name and day, and refuses an informal loan as a whole, a loan Loans does not list, an instalment on a day the plan has none, and a link off an entry with none", async () => {
    const desk = await spendingDesk(used)
    const entry = desk.ref('transaction', EXAMPLE_RECORDS['transaction']!)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry, loan: 'Car loan', due: '2026-11-15' })])).text).toContain('not a loan Loans lists')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry, loan: 'Housing loan', due: '2026-11-16' })])).text).toContain(
      'an instalment, a movement or an extra payment on 2026-11-16',
    )
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry, loan: 'From Marko', due: null })])).isError).toBe(true)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry, loan: 'From Marko', due: '2026-10-13' })])).text).toContain('Add a movement or an extra payment in Loans first')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'unlink-entry', { entry })])).text).toContain('no link')
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry, loan: 'From Marko', due: '2026-10-12' })])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, EXAMPLE_RECORDS['transaction']!)?.link).toEqual({ app: 'loans', kind: 'movement', key: 'made-up-movement', due: null })
  })

  it('tells the chat what a link names, or that Loans no longer has it', async () => {
    const desk = await spendingDesk(used)
    const linkOf = (targets: typeof DESK_LOAN_TARGETS) =>
      spendingReader({
        status: () => 'open',
        book: () => bookOf(desk),
        rates: () => NO_RATES,
        bankSetup: deskBankSetup,
        qrTextOn: async () => null,
        linkTargets: () => targets,
        linkSource: () => 'loans',
      })
        .kinds.find((kind) => kind.name === ITEM_RECORDS.name)!
        .rows()
        .find((row) => row.id === wholeRowItemId({ id: EXAMPLE_RECORDS['transaction-linked'] as RecordId }))!
        .fields.find((field) => field.name === 'link')
    expect(linkOf(DESK_LOAN_TARGETS)).toMatchObject({ exposure: 'free-text', value: 'the instalment of the bank loan Housing loan due 2026-10-15, in Loans' })
    expect(linkOf([])).toMatchObject({ value: 'a record Loans no longer has' })
  })

  it('takes a link off and keeps the entry under its category', async () => {
    const desk = await spendingDesk(used)
    const linked = EXAMPLE_RECORDS['transaction-linked']!
    const category = rowOf(desk, linked)?.category
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'unlink-entry', { entry: desk.ref('transaction', linked) })])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, linked)).toMatchObject({ link: null, category })
  })

  it("refuses to take a link off an entry whose parts link to different records, and sends the person to the entry's dialog", async () => {
    const desk = await spendingDesk(used)
    const entry = EXAMPLE_RECORDS['transaction']!
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry: desk.ref('transaction', entry), loan: 'Housing loan', due: '2026-11-15' })])
    expect((await desk.accept()).kind).toBe('done')
    const row = bookOf(desk).transactions.find((held) => held.id === entry)!
    const [interest, ...rest] = bookOf(desk).items.filter((part) => part.transaction === entry)
    const extra = { app: 'loans', kind: 'extra-payment', key: 'made-up-extra', due: null }
    await desk.store.write('Relinked', (unit) => writeRows(unit, desk.store.state.records!, [{ before: row, after: row, items: [{ ...interest!, link: extra }, ...rest] }]))

    const refused = await desk.propose([stepOf(SPENDING_OPERATIONS, 'unlink-entry', { entry: desk.ref('transaction', entry) })])

    expect([refused.isError, refused.text]).toEqual([true, expect.stringContaining('parts link to different records')])
  })
})

/** The file as the chat's writes see it, to compare before Accept and after Undo. */
const snapshotOf = (desk: SpendingDesk) => JSON.stringify({ accounts: bookOf(desk).accounts, rows: bookOf(desk).transactions.length, settings: bookOf(desk).settings })

describe('bank account set-up', () => {
  it.each(BANK_SETUP_OPERATIONS.map((operation) => [operation.name, operation] as const))(
    'writes its example as the set-up list offers it, and one Undo puts the file back: %s',
    async (_name, operation) => {
      const desk = await spendingDesk(used)
      const before = snapshotOf(desk)
      expect((await desk.propose([{ op: operation.name, input: exampleInput(operation, desk, EXAMPLE_RECORDS) }])).isError).toBe(false)
      const result = await desk.accept()
      expect(result.kind).toBe('done')
      expect(snapshotOf(desk)).not.toBe(before)
      if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
      expect(snapshotOf(desk)).toBe(before)
    },
  )

  it('reads each line of the list with what it offers, the account that keeps it and the opening a fix sets', async () => {
    const desk = await spendingDesk(used)
    const reader = spendingReader({
      status: () => 'open',
      book: () => bookOf(desk),
      rates: () => NO_RATES,
      bankSetup: deskBankSetup,
      qrTextOn: async () => null,
      linkTargets: () => DESK_LOAN_TARGETS,
      linkSource: () => 'loans',
    })
    const lines = reader.kinds.find((kind) => kind.name === BANK_ACCOUNT_LINES.name)!.rows()
    const fieldOf = (at: number, name: string) => lines[at]!.fields.find((field) => field.name === name)
    expect(lines.map((line) => line.id)).toEqual([EXAMPLE_RECORDS['bank-account-missing'], EXAMPLE_RECORDS['bank-account-update'], EXAMPLE_RECORDS['bank-account-left-out']])
    expect([0, 1, 2].map((at) => fieldOf(at, 'offers'))).toMatchObject([{ value: ['add', 'leave-out'] }, { value: ['update', 'keep-mine'] }, { value: ['bring-back'] }])
    expect(fieldOf(1, 'account')).toMatchObject({ exposure: 'ref', ids: [DESK_ACCOUNTS.CURRENT.id] })
    expect(fieldOf(1, 'takesRowsFrom')).toMatchObject({ value: 'bank-link' })
    expect(fieldOf(1, 'fixedOpening')).toMatchObject({ cents: 90000, currency: 'EUR' })
  })

  it("adds the draft, gives the kept account the bank's kind and its rows from the bank, and sets the opening the bank's balance gives", async () => {
    const desk = await spendingDesk(used)
    const line = (name: string) => desk.ref(BANK_ACCOUNT_LINES.name, EXAMPLE_RECORDS[name]!)
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-bank-account', { line: line('bank-account-missing') }),
      stepOf(SPENDING_OPERATIONS, 'update-bank-account', { line: line('bank-account-update') }),
    ])
    expect((await desk.accept()).kind).toBe('done')
    const current = () => bookOf(desk).accounts.find((account) => account.id === DESK_ACCOUNTS.CURRENT.id)!
    expect(bookOf(desk).accounts.map((account) => account.currency)).toContain('GBP')
    expect(current()).toMatchObject({ kind: 'savings', rowsFrom: 'bank-link', name: 'Current', opening: DESK_ACCOUNTS.CURRENT.opening })
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'fix-opening', { account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id) })])
    expect((await desk.accept()).kind).toBe('done')
    expect(current().opening).toBe(90000)
  })

  it('refuses what a line does not offer, a step of another kind beside it, two marks of a sort, and a list nobody fetched', async () => {
    const desk = await spendingDesk(used)
    const line = (name: string) => desk.ref(BANK_ACCOUNT_LINES.name, EXAMPLE_RECORDS[name]!)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'add-bank-account', { line: line('bank-account-update') })])).text).toContain('offers update, keep-mine')
    const other = stepOf(SPENDING_OPERATIONS, 'delete-rule', { rule: desk.ref('rule', EXAMPLE_RECORDS['rule']!) })
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'leave-out-bank-account', { line: line('bank-account-missing') }), other])).text).toContain('card of their own')
    const marks = [
      stepOf(SPENDING_OPERATIONS, 'leave-out-bank-account', { line: line('bank-account-missing') }),
      stepOf(SPENDING_OPERATIONS, 'bring-back-bank-account', { line: line('bank-account-left-out') }),
    ]
    expect((await desk.propose(marks)).text).toContain('of each sort')
    const unfetched = await spendingDesk(used, deskPorts(undefined, null))
    expect((await unfetched.propose([stepOf(SPENDING_OPERATIONS, 'fix-opening', { account: unfetched.ref('account', DESK_ACCOUNTS.CURRENT.id) })])).text).toContain('No bank sync ran')
  })
})

describe('the account a new entry starts on', () => {
  it('sets it on this device, and Undo forgets it again when none was kept', async () => {
    const desk = await spendingDesk(used)
    const savings = desk.ref('account', DESK_ACCOUNTS.SAVINGS.id)
    await desk.propose([{ op: SET_STARTING_ACCOUNT.name, input: { account: savings } }])
    expect(desk.cards[0]!.groups[0]!.lines[0]!.fields[0]).toMatchObject({ before: 'Current', after: 'Savings' })
    const result = await desk.accept()
    expect(startingAccount(bookOf(desk).accounts)?.id).toBe(DESK_ACCOUNTS.SAVINGS.id)
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(lastAccountId()).toBeNull()
  })

  it('puts back the one kept before, and refuses when this browser changed it since the card', async () => {
    const desk = await spendingDesk(used)
    const ref = (account: { readonly id: string }) => desk.ref('account', account.id)
    await desk.propose([{ op: SET_STARTING_ACCOUNT.name, input: { account: ref(DESK_ACCOUNTS.SAVINGS) } }])
    const first = await desk.accept()
    await desk.propose([{ op: SET_STARTING_ACCOUNT.name, input: { account: ref(DESK_ACCOUNTS.REVOLUT) } }])
    await desk.propose([{ op: SET_STARTING_ACCOUNT.name, input: { account: ref(DESK_ACCOUNTS.DOLLARS) } }])
    const second = await desk.accept(1)
    expect((await desk.accept(2)).kind).toBe('refused')
    if (first.kind === 'done') expect((await first.undo!()).kind).toBe('refused')
    if (second.kind === 'done') expect((await second.undo!()).kind).toBe('undone')
    expect(lastAccountId()).toBe(DESK_ACCOUNTS.SAVINGS.id)
  })

  it('refuses the account already in use, and any other step beside it', async () => {
    const desk = await spendingDesk(used)
    const current = desk.ref('account', DESK_ACCOUNTS.CURRENT.id)
    expect((await desk.propose([{ op: SET_STARTING_ACCOUNT.name, input: { account: current } }])).text).toContain('already start')
    const step = { op: SET_STARTING_ACCOUNT.name, input: { account: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id) } }
    expect((await desk.propose([step, stepOf(SPENDING_OPERATIONS, 'delete-rule', { rule: desk.ref('rule', EXAMPLE_RECORDS['rule']!) })])).text).toContain('card of its own')
  })
})

describe('labels through the chat', () => {
  const RENT_PART = recordIdOf(ITEM_RECORDS, 'line-hardware-rent')
  const GROCERIES_PART = recordIdOf(ITEM_RECORDS, 'line-hardware-groceries')
  const labelsOn = (desk: SpendingDesk) => new Map(bookOf(desk).items.map((item) => [item.id, item.labels]))

  it('adds a label and puts it on an entry and on one part of a split entry by its $ name on one card, which one Undo takes back', async () => {
    const desk = await spendingDesk(used)
    const typed = wholeRowItemId({ id: EXAMPLE_RECORDS['transaction'] as RecordId })
    const renovation = EXAMPLE_RECORDS['label'] as RecordId

    const answer = await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-label', { name: ' Prague ' }, '$trip'),
      stepOf(SPENDING_OPERATIONS, 'label-entries', {
        label: '$trip',
        entries: [
          { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction']!), part: null },
          { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction-split']!), part: desk.ref('item', GROCERIES_PART) },
        ],
      }),
    ])
    expect(answer.isError, answer.text).toBe(false)
    const shown = desk.cards[0]!.groups.flatMap((group) => group.lines.flatMap((line) => line.fields.filter((field) => field.name === words.proposals.fields.labels).map((field) => field.after)))
    expect(shown).toEqual(['Prague', 'Prague'])
    const result = await desk.accept()

    const trip = bookOf(desk).labels.find((label) => label.name === 'Prague')!
    expect([labelsOn(desk).get(typed), labelsOn(desk).get(GROCERIES_PART), labelsOn(desk).get(RENT_PART)]).toEqual([[trip.id], [trip.id], [renovation]])
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(bookOf(desk).labels.map((label) => label.name)).toEqual(['Renovation'])
    expect(labelsOn(desk).get(typed)).toEqual([])
  })

  it('renames a label, takes it off an entry, and deletes it from every part that carries it', async () => {
    const desk = await spendingDesk(used)
    const label = desk.ref('label', EXAMPLE_RECORDS['label']!)
    const split = desk.ref('transaction', EXAMPLE_RECORDS['transaction-split']!)

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'rename-label', { label, name: 'Home works' })])
    await desk.accept()
    expect(bookOf(desk).labels.map((held) => held.name)).toEqual(['Home works'])

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'unlabel-entries', { label, entries: [{ entry: split, part: null }] })])
    await desk.accept()
    expect(labelsOn(desk).get(RENT_PART)).toEqual([])

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'label-entries', { label, entries: [{ entry: split, part: null }] })])
    await desk.accept()
    expect([labelsOn(desk).get(RENT_PART), labelsOn(desk).get(GROCERIES_PART)]).toEqual([[EXAMPLE_RECORDS['label']], [EXAMPLE_RECORDS['label']]])
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'delete-label', { label })])
    await desk.accept()
    expect(bookOf(desk).labels).toEqual([])
    expect([labelsOn(desk).get(RENT_PART), labelsOn(desk).get(GROCERIES_PART)]).toEqual([[], []])
  })

  it('refuses a name another label has once folded, a part of another entry, and a label on a file from before items', async () => {
    const desk = await spendingDesk(used)
    const label = desk.ref('label', EXAMPLE_RECORDS['label']!)
    const typed = desk.ref('transaction', EXAMPLE_RECORDS['transaction']!)

    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'add-label', { name: 'RENOVATION' })])).text).toContain('Another label is called RENOVATION')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'add-label', { name: '  ' })])).text).toContain('A label needs a name')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'label-entries', { label, entries: [{ entry: typed, part: desk.ref('item', GROCERIES_PART) }] })])).text).toContain("its entry's own parts")

    const older = await spendingDesk(used, deskPorts(), 'before-items')
    const olderLabel = older.ref('label', EXAMPLE_RECORDS['label']!)
    const olderRow = older.ref('transaction', EXAMPLE_RECORDS['transaction']!)
    expect((await older.propose([stepOf(SPENDING_OPERATIONS, 'label-entries', { label: olderLabel, entries: [{ entry: olderRow, part: null }] })])).text).toContain('move-to-items')
  })

  it('reads what each label counts as the month counts it, by group, with how many entries carry it', async () => {
    const desk = await spendingDesk(used)
    const reader = spendingReader({
      status: () => 'open',
      book: () => bookOf(desk),
      rates: () => NO_RATES,
      bankSetup: deskBankSetup,
      qrTextOn: async () => null,
      linkTargets: () => DESK_LOAN_TARGETS,
      linkSource: () => 'loans',
    })
    const labels = reader.reports.find((report) => report.id === 'labels')!

    expect(labels.figures('2026-10-31')).toEqual([
      { label: 'Renovation: spent', of: 'app', cents: 4000, currency: 'EUR' },
      { label: 'Renovation / Rent: spent', of: 'app', cents: 4000, currency: 'EUR' },
      { label: 'Renovation: entries', count: 1 },
    ])
    expect(labels.figures('2026-10-29')).toEqual([
      { label: 'Renovation: spent', of: 'app', cents: 0, currency: 'EUR' },
      { label: 'Renovation: entries', count: 0 },
    ])
  })
})

describe('events through the chat', () => {
  const RENT_PART = recordIdOf(ITEM_RECORDS, 'line-hardware-rent')
  const GROCERIES_PART = recordIdOf(ITEM_RECORDS, 'line-hardware-groceries')
  const choiceOn = (desk: SpendingDesk, item: RecordId) => bookOf(desk).items.find((held) => held.id === item)?.event
  const eventFieldsOn = (desk: SpendingDesk) =>
    desk.cards
      .at(-1)!
      .groups.flatMap((group) => group.lines)
      .flatMap((line) => line.fields.filter((field) => field.name === 'Event').map(({ before, after }) => ({ before, after })))

  it('adds an event and puts an entry in it by its $ name on one card, which one Undo takes back', async () => {
    const desk = await spendingDesk(used)
    const typed = wholeRowItemId({ id: EXAMPLE_RECORDS['transaction'] as RecordId })

    const answer = await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-event', { name: ' Prague ', from: '2027-07-10', to: '2027-07-14' }, '$prague'),
      stepOf(SPENDING_OPERATIONS, 'put-in-event', { event: '$prague', entries: [{ entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction']!), part: null }] }),
    ])
    expect(answer.isError, answer.text).toBe(false)
    const result = await desk.accept()

    const prague = bookOf(desk).events.find((event) => event.name === 'Prague')!
    expect(prague.days).toEqual({ from: '2027-07-10', to: '2027-07-14' })
    expect(choiceOn(desk, typed)).toBe(prague.id)
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(bookOf(desk).events.map((event) => event.name)).toEqual(['Trip'])
    expect(choiceOn(desk, typed)).toBe(BY_DAYS)
  })

  it('takes one part out of every event, puts the other back on its days, and deleting the event puts its hand-held parts back', async () => {
    const desk = await spendingDesk(used)
    const split = desk.ref('transaction', EXAMPLE_RECORDS['transaction-split']!)
    const event = desk.ref('event', EXAMPLE_RECORDS['event']!)

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'take-out-of-events', { entries: [{ entry: split, part: desk.ref('item', RENT_PART) }] })])
    await desk.accept()
    expect([choiceOn(desk, RENT_PART), choiceOn(desk, GROCERIES_PART)]).toEqual([OUT_OF_EVENTS, EXAMPLE_RECORDS['event']])

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'back-on-days', { entries: [{ entry: split, part: desk.ref('item', RENT_PART) }] })])
    expect(eventFieldsOn(desk)).toEqual([{ before: 'In no event', after: 'By its days: Trip' }])
    await desk.accept()
    expect(choiceOn(desk, RENT_PART)).toBe(BY_DAYS)

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'change-event', { event, name: 'Autumn trip', from: null, to: null })])
    await desk.accept()
    expect(bookOf(desk).events.map((held) => held.name)).toEqual(['Autumn trip'])

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'delete-event', { event })])
    expect(eventFieldsOn(desk)).toEqual([{ before: 'Autumn trip', after: 'By its days' }])
    await desk.accept()
    expect(bookOf(desk).events).toEqual([])
    expect(choiceOn(desk, GROCERIES_PART)).toBe(BY_DAYS)
  })

  it("reads what each event counts up to a day, and each part's event as by-days, out or the event it was put in", async () => {
    const desk = await spendingDesk(used)
    const reader = spendingReader({
      status: () => 'open',
      book: () => bookOf(desk),
      rates: () => NO_RATES,
      bankSetup: deskBankSetup,
      qrTextOn: async () => null,
      linkTargets: () => DESK_LOAN_TARGETS,
      linkSource: () => 'loans',
    })
    const events = reader.reports.find((report) => report.id === 'events')!

    // The split's rent part on its day, its groceries part put in by hand, and the kiosk row on the 27th: 40 + 20 + 18.
    expect(events.figures('2026-10-31')).toEqual([
      { label: 'Trip (2026-10-24 to 2026-10-31): spent', of: 'app', cents: 7800, currency: 'EUR' },
      { label: 'Trip (2026-10-24 to 2026-10-31) / Food: spent', of: 'app', cents: 3800, currency: 'EUR' },
      { label: 'Trip (2026-10-24 to 2026-10-31) / Rent: spent', of: 'app', cents: 4000, currency: 'EUR' },
      { label: 'Trip (2026-10-24 to 2026-10-31): entries', count: 2 },
    ])
    expect(events.figures('2026-10-26')).toEqual([
      { label: 'Trip (2026-10-24 to 2026-10-31): spent', of: 'app', cents: 0, currency: 'EUR' },
      { label: 'Trip (2026-10-24 to 2026-10-31): entries', count: 0 },
    ])
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'take-out-of-events', { entries: [{ entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction-split']!), part: desk.ref('item', RENT_PART) }] })])
    await desk.accept()
    const parts = reader.kinds.find((kind) => kind.name === ITEM_RECORDS.name)!.rows()
    const read = (item: RecordId) =>
      parts.find((part) => part.fields.some((field) => field.name === 'id' && 'ids' in field && field.ids.includes(item)))?.fields.find((field) => field.name === 'event')
    expect([read(RENT_PART), read(GROCERIES_PART), read(wholeRowItemId({ id: EXAMPLE_RECORDS['transaction'] as RecordId }))]).toEqual([
      { name: 'event', exposure: 'plain', value: 'out' },
      { name: 'event', exposure: 'plain', value: 'Trip (2026-10-24 to 2026-10-31)' },
      { name: 'event', exposure: 'plain', value: 'by-days' },
    ])
  })

  it('refuses a part of another entry, a last day before the first, and a hand choice on a file from before items', async () => {
    const desk = await spendingDesk(used)
    const event = desk.ref('event', EXAMPLE_RECORDS['event']!)
    const typed = desk.ref('transaction', EXAMPLE_RECORDS['transaction']!)

    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'put-in-event', { event, entries: [{ entry: typed, part: desk.ref('item', GROCERIES_PART) }] })])).text).toContain("its entry's own parts")
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'change-event', { event, name: null, from: '2026-11-02', to: null })])).text).toContain('cannot be before its first')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'add-event', { name: ' ', from: '2026-11-02', to: '2026-11-03' })])).text).toContain('An event needs a name')

    const older = await spendingDesk(used, deskPorts(), 'before-items')
    const olderRow = older.ref('transaction', EXAMPLE_RECORDS['transaction']!)
    expect((await older.propose([stepOf(SPENDING_OPERATIONS, 'take-out-of-events', { entries: [{ entry: olderRow, part: null }] })])).text).toContain('move-to-items')
  })
})
