import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { KEPT_BY_KUNA } from '../src/apps/spending/assistant/operations/proposalLines'
import { SPENDING_OPERATIONS } from '../src/apps/spending/assistant/operations/spendingOperations'
import { words } from '../src/apps/spending/assistant/words'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import { ATTACHMENT_REF } from '../src/shared/app/assistantOperations'
import { DESK_ACCOUNTS, EXAMPLE_RECORDS, attachedPhoto, spendingDesk } from './fixtures/spendingDesk'
import type { SpendingDesk } from './fixtures/spendingDesk'
import { forgetCaches } from './fixtures/writeBack'
import { expectCountsOfChanges } from './fixtures/cardCounts'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: SpendingDesk) => store.state.workbook!
const rowOf = (desk: SpendingDesk, id: string) => bookOf(desk).transactions.find((row) => row.id === id)
const categoryNamed = (desk: SpendingDesk, name: string) => bookOf(desk).categories.find((category) => category.name === name)!

/** The example's input with each record it names as a ref the chat handed out, in a list's items too, and a file as the id of the photo attached. */
function exampleInput(desk: SpendingDesk, operation: (typeof SPENDING_OPERATIONS)[number]): Record<string, unknown> {
  const refOf = (kind: string | undefined, value: unknown): unknown => {
    if (kind === ATTACHMENT_REF) return value === null ? null : attachedPhoto().id
    return kind !== undefined && typeof value === 'string' ? desk.ref(kind, EXAMPLE_RECORDS[value]!) : value
  }
  return Object.fromEntries(
    Object.entries(operation.example).map(([field, value]) => {
      if (!Array.isArray(value)) return [field, refOf(operation.refs[field], value)]
      const items = (value as readonly Readonly<Record<string, unknown>>[]).map((item) =>
        typeof item === 'object' && item !== null ? Object.fromEntries(Object.entries(item).map(([name, held]) => [name, refOf(operation.refs[`${field}.${name}`], held)])) : item,
      )
      return [field, items]
    }),
  )
}

/** A field's value as the card reads it, where an empty text and a missing value both say nothing. */
function said(value: unknown): unknown {
  return value === undefined || value === '' ? null : value
}

/** The card's names of the fields a change sets, leaving out the ones Kuna keeps by itself. */
function namesSet(before: Readonly<Record<string, unknown>> | null, after: Readonly<Record<string, unknown>>): string[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after)])].filter((field) => !KEPT_BY_KUNA.has(field))
  const altered = fields.filter((field) => JSON.stringify(said(before?.[field])) !== JSON.stringify(said(after[field])))
  return altered.map((field) => (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field)
}

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

      const answer = await desk.propose([{ op: operation.name, input: exampleInput(desk, operation) }], [attachedPhoto()])

      expect(answer.text).toContain('The card shows')
      expect(answer.isError).toBe(false)
      const [card] = desk.cards
      expectCountsOfChanges(card!)
      const { changes } = card!.held as { readonly changes: readonly RuledChange[] }
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
            set: namesSet(before, change.after as Readonly<Record<string, unknown>>),
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
      {
        op: 'add-transfer',
        input: { from: desk.ref('account', DESK_ACCOUNTS.CURRENT.id), to: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id), date: '2026-11-02', amount: 50, toAmount: null, payee: '', note: '' },
      },
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
    const transfer = (to: string, toAmount: number | null) => ({ op: 'add-transfer', input: { from: current, to, date: '2026-11-02', amount: 50, toAmount, payee: '', note: '' } })
    const dollars = desk.ref('account', DESK_ACCOUNTS.DOLLARS.id)
    expect((await desk.propose([transfer(dollars, null)])).text).toContain('toAmount')
    expect((await desk.propose([transfer(current, null)])).isError).toBe(true)
    expect((await desk.propose([transfer(dollars, 58.2)])).isError).toBe(false)
    await desk.accept()
    expect(bookOf(desk).transactions.at(-1)!.amount).toBe(5820)
  })

  it('turns a plain entry into the leg its money is, and a kind turns a leg back into a plain entry with its other leg gone', async () => {
    const desk = await spendingDesk(used)
    const entry = EXAMPLE_RECORDS['transaction']!
    await desk.propose([
      {
        op: 'change-transfer',
        input: { entry: desk.ref('transaction', entry), from: null, to: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id), date: null, amount: null, toAmount: null, payee: null, note: null },
      },
    ])
    expect((await desk.accept()).kind).toBe('done')
    const leg = rowOf(desk, entry)!
    expect(leg.amount).toBe(-4530)
    expect(leg.category).toBe(categoryNamed(desk, 'Between my accounts').id)
    const other = leg.pair!
    expect(rowOf(desk, other)!.amount).toBe(4530)

    await desk.propose([
      {
        op: 'change-entry',
        input: {
          entry: desk.ref('transaction', entry),
          account: null,
          kind: 'out',
          category: desk.ref('category', categoryNamed(desk, 'Groceries').id),
          date: null,
          amount: null,
          payee: null,
          note: null,
        },
      },
    ])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, entry)).toMatchObject({ pair: null, amount: -4530 })
    expect(rowOf(desk, other)).toBeUndefined()
  })

  it('refuses a new date, amount or account on one leg of a transfer, which change-transfer moves on both', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([
      {
        op: 'add-transfer',
        input: { from: desk.ref('account', DESK_ACCOUNTS.CURRENT.id), to: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id), date: '2026-11-02', amount: 50, toAmount: null, payee: '', note: '' },
      },
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

  it('refuses moving a row a statement brought to another account', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([
      {
        op: 'change-entry',
        input: {
          entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction-receipt']!),
          account: desk.ref('account', DESK_ACCOUNTS.SAVINGS.id),
          kind: null,
          category: null,
          date: null,
          amount: null,
          payee: null,
          note: null,
        },
      },
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
      { op: 'add-account', input: { name: 'New card', kind: 'bank', bank: null, currency: 'EUR', opening: 0, openedOn: '2026-11-01', iban: null }, as: '$card' },
      changeEntry(desk, EXAMPLE_RECORDS['transaction']!, { account: '$card' }),
    ])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('before the account opened')
  })
})

describe('To review', () => {
  it('joins, pairs and unpairs only what To review offers', async () => {
    const desk = await spendingDesk(used)
    const typedRow = desk.ref('transaction', EXAMPLE_RECORDS['transaction']!)
    expect((await desk.propose([{ op: 'join-rows', input: { row: typedRow } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'pair-rows', input: { row: typedRow } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'unpair-rows', input: { row: typedRow } }])).isError).toBe(true)

    await desk.propose([{ op: 'pair-rows', input: { row: desk.ref('transaction', EXAMPLE_RECORDS['transaction-pairable']!) } }])
    expect((await desk.accept()).kind).toBe('done')
    const paired = rowOf(desk, EXAMPLE_RECORDS['transaction-pairable']!)!
    expect(paired.pair).not.toBeNull()

    await desk.propose([{ op: 'unpair-rows', input: { row: desk.ref('transaction', paired.id) } }])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, paired.id)).toMatchObject({ pair: null, category: null, categorisedBy: 'person' })
  })

  it('joins a bank row with the typed row, which takes the bank’s amount', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([{ op: 'join-rows', input: { row: desk.ref('transaction', EXAMPLE_RECORDS['transaction-joinable']!) } }])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowOf(desk, EXAMPLE_RECORDS['transaction-joinable']!)).toBeUndefined()
    expect(bookOf(desk).transactions.find((row) => row.payee === 'Pharmacy')!.amount).toBe(-3100)
  })
})

describe('categories and accounts', () => {
  it('moves a category to another group, last there, with its colour, and up among the groups', async () => {
    const desk = await spendingDesk(used)
    const restaurants = categoryNamed(desk, 'Restaurants')
    const rent = categoryNamed(desk, 'Rent')
    await desk.propose([
      { op: 'change-category', input: { category: desk.ref('category', restaurants.id), name: null, group: desk.ref('category', rent.id), colour: '#2A78D6', hidden: null } },
      { op: 'move-category', input: { category: desk.ref('category', rent.id), direction: 'up' } },
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
    expect((await desk.propose([{ op: 'move-category', input: { category: ref('Food'), direction: 'up' } }])).isError).toBe(true)
  })

  it('keeps the currency of an account with entries, deletes only an empty one, and takes a bank and IBAN off cash', async () => {
    const desk = await spendingDesk(used)
    const current = desk.ref('account', DESK_ACCOUNTS.CURRENT.id)
    const change = (fields: Record<string, unknown>) => ({
      op: 'change-account',
      input: { account: current, name: null, kind: null, bank: null, currency: null, opening: null, openedOn: null, iban: null, closed: null, ...fields },
    })
    expect((await desk.propose([change({ currency: 'USD' })])).isError).toBe(true)
    expect((await desk.propose([{ op: 'delete-account', input: { account: current } }])).isError).toBe(true)
    await desk.propose([change({ kind: 'cash' })])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).accounts.find((account) => account.id === DESK_ACCOUNTS.CURRENT.id)).toMatchObject({ kind: 'cash', bank: null, iban: '' })
  })
})

describe('an entry’s receipt and payee', () => {
  it('takes a receipt off and keeps the entry, and refuses an entry with none', async () => {
    const desk = await spendingDesk(used)
    expect((await desk.propose([{ op: 'remove-receipt', input: { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction']!) } }])).isError).toBe(true)
    await desk.propose([{ op: 'remove-receipt', input: { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction-receipt']!) } }])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).receipts).toEqual([])
    expect(rowOf(desk, EXAMPLE_RECORDS['transaction-receipt']!)).toBeDefined()
  })

  it('flags a payee as a person, and a second flag changes nothing', async () => {
    const desk = await spendingDesk(used)
    const flag = { op: 'flag-person', input: { entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction']!) } }
    await desk.propose([flag])
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).settings.personPayees).toContain('Corner market')
    expect((await desk.propose([flag])).isError).toBe(true)
  })
})
