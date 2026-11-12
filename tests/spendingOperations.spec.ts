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
import { SETTING_WRITES } from '../src/apps/spending/workbook/application/settingWrites'
import { BANK_SYNC_DEPLOYMENT_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { setSetting } from '../src/shared/storage/application/settingWrites'
import { ACCOUNT_WRITES } from '../src/apps/spending/accounts/application/accountWrites'
import { TRANSACTION_WRITES } from '../src/apps/spending/entries/application/entryWrites'
import { TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { expectCountsOfChanges } from './fixtures/cardCounts'
import { stepOf } from './fixtures/operationSteps'
import { exampleInput } from './fixtures/exampleInput'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: SpendingDesk) => store.state.workbook!
const rowOf = (desk: SpendingDesk, id: string) => bookOf(desk).transactions.find((row) => row.id === id)
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
      const desk = await spendingDesk(used)

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
    const [out, into] = bookOf(desk).transactions.slice(-2)
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
    const [out, into] = bookOf(desk).transactions.slice(-2)

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
      ...bookOf(desk).transactions.find((row) => row.id === EXAMPLE_RECORDS['transaction'])!,
      id: recordIdOf(TRANSACTION_RECORDS, 'synced-row'),
      account: current.id,
      source: 'statement' as const,
      importKey: 'bank-synced-row',
      pair: null,
    }
    await desk.store.write('Linked', (unit) => {
      unit.of(ACCOUNT_WRITES).change(current, { ...current, rowsFrom: 'bank-link' })
      unit.of(TRANSACTION_WRITES).add(synced)
    })
    const change = (fields: Record<string, unknown>) => ({
      op: 'change-entry',
      input: { entry: desk.ref('transaction', synced.id), account: null, kind: null, category: null, date: null, amount: null, payee: null, note: null, ...fields },
    })
    expect((await desk.propose([change({ amount: -1 })])).text).toContain('so its date and amount stay')
    expect((await desk.propose([change({ date: '2026-11-02' })])).isError).toBe(true)
    await desk.propose([change({ note: 'Checked', payee: 'Corner market' })])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).transactions.find((row) => row.id === synced.id)).toMatchObject({ note: 'Checked', amount: synced.amount, date: synced.date })
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

describe('a rule that spots cash taken out', () => {
  it('adds one into Between my accounts with the cash account named, and changes it to the cash account of the currency', async () => {
    const desk = await spendingDesk(used)
    const between = categoryNamed(desk, 'Between my accounts')
    await desk.propose([
      stepOf(SPENDING_OPERATIONS, 'add-rule', { fragment: 'Bankomat', category: desk.ref('category', between.id), withdrawal: 'yes', cash_account: desk.ref('account', DESK_ACCOUNTS.WALLET.id) }),
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
    const answer = await desk.propose([stepOf(SPENDING_OPERATIONS, 'add-rule', { fragment: 'Bankomat', category: desk.ref('category', categoryNamed(desk, 'Rent').id), withdrawal: 'yes' })])
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

  it('refuses a group for a group, more than a name for a fixed category, and a move past the end', async () => {
    const desk = await spendingDesk(used)
    const ref = (name: string) => desk.ref('category', categoryNamed(desk, name).id)
    const change = (category: string, fields: Record<string, unknown>) => ({ op: 'change-category', input: { category, name: null, group: null, colour: null, hidden: null, ...fields } })
    expect((await desk.propose([change(ref('Rent'), { group: ref('Food') })])).isError).toBe(true)
    expect((await desk.propose([change(ref('Between my accounts'), { hidden: 'yes' })])).isError).toBe(true)
    expect((await desk.propose([change(ref('Groceries'), { colour: '#000000' })])).isError).toBe(true)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'move-category', { category: ref('Food'), direction: 'up' })])).isError).toBe(true)
  })

  it('keeps the currency of an account with entries, deletes only an empty one, and takes a bank and IBAN off cash', async () => {
    const desk = await spendingDesk(used)
    const current = desk.ref('account', DESK_ACCOUNTS.CURRENT.id)
    const change = (fields: Record<string, unknown>) => ({
      op: 'change-account',
      input: { account: current, name: null, kind: null, bank: null, currency: null, opening: null, openedOn: null, iban: null, rowsFrom: null, closed: null, ...fields },
    })
    expect((await desk.propose([change({ currency: 'USD' })])).isError).toBe(true)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'delete-account', { account: current })])).isError).toBe(true)
    await desk.propose([change({ kind: 'cash' })])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).accounts.find((account) => account.id === DESK_ACCOUNTS.CURRENT.id)).toMatchObject({ kind: 'cash', bank: null, iban: '' })
  })

  const moveStart = (desk: SpendingDesk, openedOn: string) => stepOf(SPENDING_OPERATIONS, 'change-account', { account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id), openedOn })

  it('moves the start day later as the dialog does: the card says what goes, the opening keeps the balance, and the other leg stays alone', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([moveStart(desk, '2026-10-29')])
    const notes = desk.cards[0]!.groups.flatMap((group) => group.notes)
    expect(notes).toEqual([
      {
        label: 'Current',
        text: "Moving the opening balance day to 29 Oct 2026 deletes what came before it: 6 entries and 1 receipt. The other leg of 1 transfer stays on Savings as a lone row under Between my accounts. The opening balance becomes €573.70, so today's balance stays. You can change it.",
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
  const split = (desk: SpendingDesk, entry: string, parts: readonly { readonly amount: number | null; readonly category: string; readonly text?: string }[]) =>
    stepOf(SPENDING_OPERATIONS, 'split-entry', {
      entry: desk.ref('transaction', entry),
      parts: parts.map((part) => ({ amount: part.amount, category: desk.ref('category', part.category), text: part.text ?? '' })),
    })
  const typed = EXAMPLE_RECORDS['transaction']!

  it('splits an entry into three parts signed as the entry, under the category with most of the money, and one Undo puts it back', async () => {
    const desk = await spendingDesk(used)
    const before = rowOf(desk, typed)
    await desk.propose([
      split(desk, typed, [
        { amount: 10, category: EXAMPLE_RECORDS['category']!, text: 'Light bulbs' },
        { amount: 15.3, category: categoryNamed(desk, 'For the company').id },
        { amount: null, category: EXAMPLE_RECORDS['category-other']! },
      ]),
    ])
    expect((await desk.accept()).kind).toBe('done')
    const parts = bookOf(desk).lines.filter((part) => part.transaction === typed)
    expect(parts.map((part) => [part.amount, part.text, part.receipt])).toEqual([
      [accountMoneyFromAmount(-10), 'Light bulbs', null],
      [accountMoneyFromAmount(-15.3), '', null],
      [accountMoneyFromAmount(-20), '', null],
    ])
    expect(rowOf(desk, typed)).toMatchObject({ category: EXAMPLE_RECORDS['category-other'], categorisedBy: 'person', amount: before!.amount })
    expect(bookOf(desk).problems).toEqual([])
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
    expect(bookOf(desk).lines.filter((part) => part.transaction === handSplit)).toEqual([])
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
  it('links an entry to an instalment by its loan and due date and shows it on the card as Entries does, keeping its category, and one Undo takes it off', async () => {
    const desk = await spendingDesk(used)
    const entry = EXAMPLE_RECORDS['transaction']!
    const before = rowOf(desk, entry)
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry: desk.ref('transaction', entry), loan: 'Housing loan', due: '2026-11-15' })])
    const fields = desk.cards[0]!.groups.flatMap((group) => group.lines).flatMap((line) => line.fields)
    expect(fields.find((field) => field.name === 'Linked to')).toMatchObject({ after: 'Housing loan, instalment due 15 Nov 2026' })
    const result = await desk.accept()
    expect(result.kind).toBe('done')
    expect(rowOf(desk, entry)).toEqual({ ...before, link: { app: 'loans', kind: 'bank-loan', key: 'made-up-housing-loan', due: parseCivilDate('2026-11-15') } })
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(rowOf(desk, entry)).toEqual(before)
  })

  it('links an informal loan by its name, and refuses a loan Loans does not list, an instalment on a day the plan has none, and a link off an entry with none', async () => {
    const desk = await spendingDesk(used)
    const entry = desk.ref('transaction', EXAMPLE_RECORDS['transaction']!)
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry, loan: 'Car loan', due: '2026-11-15' })])).text).toContain('not a bank loan Loans lists')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry, loan: 'Housing loan', due: '2026-11-16' })])).text).toContain('instalment due 2026-11-16')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry, loan: 'Housing loan' })])).text).toContain('needs its due date')
    expect((await desk.propose([stepOf(SPENDING_OPERATIONS, 'unlink-entry', { entry })])).text).toContain('no link')
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'link-entry', { entry, loan: 'From Marko' })])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, EXAMPLE_RECORDS['transaction']!)?.link).toEqual({ app: 'loans', kind: 'informal-loan', key: 'made-up-informal-loan', due: null })
  })

  it('tells the chat what a link names, or that Loans no longer has it', async () => {
    const desk = await spendingDesk(used)
    const linkOf = (targets: typeof DESK_LOAN_TARGETS) =>
      spendingReader({ status: () => 'open', book: () => bookOf(desk), rates: () => NO_RATES, bankSetup: deskBankSetup, qrTextOn: async () => null, linkTargets: () => targets })
        .kinds.find((kind) => kind.name === TRANSACTION_RECORDS.name)!
        .rows()
        .find((row) => row.id === EXAMPLE_RECORDS['transaction-linked'])!
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
    const reader = spendingReader({ status: () => 'open', book: () => bookOf(desk), rates: () => NO_RATES, bankSetup: deskBankSetup, qrTextOn: async () => null, linkTargets: () => DESK_LOAN_TARGETS })
    const lines = reader.kinds.find((kind) => kind.name === BANK_ACCOUNT_LINES.name)!.rows()
    const fieldOf = (at: number, name: string) => lines[at]!.fields.find((field) => field.name === name)
    expect(lines.map((line) => line.id)).toEqual([EXAMPLE_RECORDS['bank-account-missing'], EXAMPLE_RECORDS['bank-account-update'], EXAMPLE_RECORDS['bank-account-left-out']])
    expect([0, 1, 2].map((at) => fieldOf(at, 'offers'))).toMatchObject([{ value: ['add', 'leave-out'] }, { value: ['update', 'keep-mine'] }, { value: ['bring-back'] }])
    expect(fieldOf(1, 'account')).toMatchObject({ exposure: 'ref', id: DESK_ACCOUNTS.CURRENT.id })
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
