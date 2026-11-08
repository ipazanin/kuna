import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { ASSETS_OPERATIONS } from '../src/apps/assets/assistant/operations/assetsOperations'
import { FIELD_NAMES, KEPT_BY_KUNA } from '../src/apps/assets/assistant/operations/proposalLines'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import { CAR_LOAN_KEY, EXAMPLE_RECORDS, HOME_LOAN_KEY, assetsDesk } from './fixtures/assetsDesk'
import type { AssetsDesk } from './fixtures/assetsDesk'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: AssetsDesk) => store.state.workbook!

/** The file's records of each kind, in the order of their ids, since an Undo may put them back in another order. */
function recordsOf({ store }: AssetsDesk): string {
  return JSON.stringify(Object.entries(store.state.records!).map(([part, read]) => [part, read.records.map((stored: { readonly record: unknown }) => JSON.stringify(stored.record)).sort()]))
}

/** The example's input with each record it names as a ref the chat handed out. */
function exampleInput(desk: AssetsDesk, operation: (typeof ASSETS_OPERATIONS)[number]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(operation.example).map(([field, value]) => {
      const kind = operation.refs[field]
      return [field, kind !== undefined && typeof value === 'string' ? desk.ref(kind, EXAMPLE_RECORDS[value]!) : value]
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
  return altered.filter((field) => said(after[field]) !== null || said(before?.[field]) !== null).map((field) => FIELD_NAMES[field] ?? field)
}

function operation(name: string) {
  return ASSETS_OPERATIONS.find((candidate) => candidate.name === name)!
}

describe('every Assets operation', () => {
  it.each(ASSETS_OPERATIONS.map((candidate) => [candidate.name, candidate] as const))(
    'has an example that passes the checks of the file, a card with a line for every record it writes, and one Undo: %s',
    async (_name, candidate) => {
      expect(Object.keys(candidate.input.type === 'object' ? candidate.input.properties : {}).filter((field) => KEPT_BY_KUNA.has(field))).toEqual([])
      const desk = await assetsDesk(used)
      const before = recordsOf(desk)

      const answer = await desk.propose([{ op: candidate.name, input: exampleInput(desk, candidate) }])

      expect(answer.text).toContain('The card shows')
      expect(answer.isError).toBe(false)
      const [card] = desk.cards
      const { changes } = card!.held as { readonly changes: readonly RuledChange[] }
      const linesTaken = new Map<string, number>()
      for (const { change } of changes) {
        if (change.verb === 'repair' || change.verb === 'discard') continue
        const group = card!.groups.find((candidate) => candidate.verb === change.verb && candidate.noun === change.kind.noun)!
        const at = linesTaken.get(`${change.verb}/${change.kind.name}`) ?? 0
        linesTaken.set(`${change.verb}/${change.kind.name}`, at + 1)
        if (change.verb === 'remove') continue
        const was = change.verb === 'change' ? (change.before as Readonly<Record<string, unknown>>) : null
        expect(group.lines[at]!.fields.map((field) => field.name)).toEqual(expect.arrayContaining(namesSet(was, change.after as Readonly<Record<string, unknown>>)))
      }
      expect(card!.undoable).toBe(true)
      const result = await desk.accept()
      expect(result.kind).toBe('done')
      if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
      expect(recordsOf(desk)).toBe(before)
    },
  )
})

describe('an asset the screens would refuse', () => {
  it('refuses a price without the day it was bought, a region on a car and a first registration on a flat', async () => {
    const desk = await assetsDesk(used)
    const add = operation('add-asset').example
    expect((await desk.propose([{ op: 'add-asset', input: { ...add, bought: null } }])).text).toContain('Give the day it was bought')
    expect((await desk.propose([{ op: 'add-asset', input: { ...add, region: 'zagreb' } }])).text).toContain('A region is for a home')
    expect((await desk.propose([{ op: 'add-asset', input: { ...add, kind: 'home', region: 'zagreb', firstRegistration: '2024-05-10' } }])).text).toContain('A first registration is for a car')
    expect((await desk.propose([{ op: 'add-asset', input: { ...add, name: ' ' } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'add-asset', input: { ...add, price: 0 } }])).isError).toBe(true)
  })

  it('refuses a loan two steps give to different assets, and lets one asset hand a loan on within the card', async () => {
    const desk = await assetsDesk(used)
    const flat = desk.ref('asset', EXAMPLE_RECORDS['asset-home']!)
    const boat = desk.ref('asset', EXAMPLE_RECORDS['asset-boat']!)
    const change = { ...operation('change-asset').example, kind: null, bought: null, price: null, region: null, firstRegistration: null, name: null, note: null }
    const giveCarLoan = (asset: string) => ({ op: 'change-asset', input: { ...change, asset, loan: 'Car loan' } })
    const twice = await desk.propose([giveCarLoan(flat), giveCarLoan(boat)])
    expect(twice.isError).toBe(true)
    expect(twice.text).toContain('no other asset names')
    const handedOn = await desk.propose([
      { op: 'change-asset', input: { ...change, asset: flat, loan: 'none' } },
      { op: 'change-asset', input: { ...change, asset: boat, loan: 'Home loan' } },
    ])
    expect(handedOn.isError).toBe(false)
  })

  it('refuses to change an asset added on the same card', async () => {
    const desk = await assetsDesk(used)
    const change = { ...operation('change-asset').example, asset: '$car', loan: null }
    const answer = await desk.propose([
      { op: 'add-asset', input: { ...operation('add-asset').example, loan: null }, as: '$car' },
      { op: 'change-asset', input: change },
    ])
    expect(answer.text).toContain('Change an asset added on this card on a later card.')
  })

  it('trims the note of a changed valuation', async () => {
    const desk = await assetsDesk(used)
    await desk.propose([{ op: 'change-valuation', input: { valuation: desk.ref('valuation', EXAMPLE_RECORDS['valuation']!), date: null, value: null, note: '  checked  ' } }])
    await desk.accept()
    expect(bookOf(desk).assets.find(({ asset }) => asset.id === EXAMPLE_RECORDS['asset-boat'])!.valuations[0]!.note).toBe('checked')
  })

  it('refuses a loan another asset names, one Loans does not list, and any loan while Loans is not open', async () => {
    const desk = await assetsDesk(used)
    const add = operation('add-asset').example
    expect((await desk.propose([{ op: 'add-asset', input: { ...add, loan: 'Home loan' } }])).text).toContain('no other asset names')
    expect((await desk.propose([{ op: 'add-asset', input: { ...add, loan: 'Boat loan' } }])).isError).toBe(true)
    const waiting = await assetsDesk(used, () => 'opening')
    expect((await waiting.propose([{ op: 'add-asset', input: add }])).text).toContain('Loans is still opening')
    expect((await waiting.propose([{ op: 'add-asset', input: { ...add, loan: null } }])).isError).toBe(false)
  })

  it('links a free loan by its name and takes it off with none', async () => {
    const desk = await assetsDesk(used)
    await desk.propose([{ op: 'add-asset', input: operation('add-asset').example, as: '$car' }])
    await desk.accept()
    const car = bookOf(desk).assets.find(({ asset }) => asset.name === 'Car')!.asset
    expect(car.loan).toBe(CAR_LOAN_KEY)
    const change = { ...exampleInput(desk, operation('change-asset')), asset: desk.ref('asset', car.id), loan: 'none', region: null, name: null, note: null }
    await desk.propose([{ op: 'change-asset', input: change }])
    await desk.accept()
    expect(bookOf(desk).assets.find(({ asset }) => asset.id === car.id)!.asset.loan).toBeNull()
    expect(bookOf(desk).assets.find(({ asset }) => asset.id === EXAMPLE_RECORDS['asset-home'])!.asset.loan).toBe(HOME_LOAN_KEY)
  })

  it('keeps what a step leaves null, drops a region a car does not take, and takes a day off with none', async () => {
    const desk = await assetsDesk(used)
    const input = {
      ...operation('change-asset').example,
      asset: desk.ref('asset', EXAMPLE_RECORDS['asset-home']!),
      name: null,
      kind: 'car',
      region: null,
      loan: null,
      note: null,
      price: 0,
      bought: 'none',
      firstRegistration: '2025-03-15',
    }
    expect((await desk.propose([{ op: 'change-asset', input }])).isError).toBe(false)
    await desk.accept()
    expect(bookOf(desk).assets.find(({ asset }) => asset.name === 'Flat in Zagreb')!.asset).toMatchObject({
      kind: 'car',
      region: null,
      bought: null,
      price: null,
      loan: HOME_LOAN_KEY,
      firstRegistration: '2025-03-15',
    })
  })
})

describe('a valuation the screens would refuse', () => {
  it('refuses a day before the asset was bought, a day another valuation has, and a value below zero', async () => {
    const desk = await assetsDesk(used)
    const asset = desk.ref('asset', EXAMPLE_RECORDS['asset-boat']!)
    expect((await desk.propose([{ op: 'add-valuation', input: { asset, date: '2022-05-31', value: 100, note: '' } }])).text).toContain('Not before the day it was bought')
    expect((await desk.propose([{ op: 'add-valuation', input: { asset, date: '2026-05-01', value: 100, note: '' } }])).text).toContain('Another valuation is on this day')
    expect((await desk.propose([{ op: 'add-valuation', input: { asset, date: '2026-06-01', value: -1, note: '' } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'add-valuation', input: { asset, date: '2026-06-01', value: 0, note: '' } }])).isError).toBe(false)
  })

  it('lets a valuation keep its own day when it changes only the value', async () => {
    const desk = await assetsDesk(used)
    await desk.propose([{ op: 'change-valuation', input: { valuation: desk.ref('valuation', EXAMPLE_RECORDS['valuation']!), date: null, value: 16_000, note: null } }])
    await desk.accept()
    expect(bookOf(desk).assets.find(({ asset }) => asset.id === EXAMPLE_RECORDS['asset-boat'])!.valuations).toMatchObject([{ date: '2026-05-01', value: 1_600_000 }])
  })
})

describe('one write, one Undo', () => {
  it('deletes an asset with its valuations and puts all back', async () => {
    const desk = await assetsDesk(used)
    const before = recordsOf(desk)
    await desk.propose([{ op: 'delete-asset', input: { asset: desk.ref('asset', EXAMPLE_RECORDS['asset-boat']!) } }])
    const result = await desk.accept()
    expect(bookOf(desk).assets.map(({ asset }) => asset.name)).toEqual(['Flat in Zagreb'])
    expect(bookOf(desk).readings.valuations.facts).toEqual([])
    if (result.kind === 'done') await result.undo!()
    expect(recordsOf(desk)).toBe(before)
  })

  it('adds an asset and a valuation of it by its $ name, on one card', async () => {
    const desk = await assetsDesk(used)
    const answer = await desk.propose([
      { op: 'add-asset', input: { ...operation('add-asset').example, loan: null }, as: '$car' },
      { op: 'add-valuation', input: { asset: '$car', date: '2024-06-01', value: 19_000, note: '' } },
      { op: 'add-valuation', input: { asset: '$car', date: '2024-06-01', value: 18_000, note: '' } },
    ])
    expect(answer.text).toContain('Another valuation is on this day')
    expect(
      (
        await desk.propose([
          { op: 'add-asset', input: { ...operation('add-asset').example, loan: null }, as: '$car' },
          { op: 'add-valuation', input: { asset: '$car', date: '2024-06-01', value: 19_000, note: '' } },
        ])
      ).isError,
    ).toBe(false)
    await desk.accept()
    expect(bookOf(desk).assets.find(({ asset }) => asset.name === 'Car')!.valuations).toMatchObject([{ date: '2024-06-01', value: 1_900_000 }])
  })
})
