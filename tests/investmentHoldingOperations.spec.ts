import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { words as assistantWords } from '../src/apps/investments/assistant/words'
import { words as cardWords } from '../src/shared/app/words'
import { words as holdingsWords } from '../src/apps/investments/holdings/presentation/words'
import { words as settingsWords } from '../src/apps/investments/settings/presentation/words'
import { decimalText } from '../src/shared/money/decimal'
import { DESK, investmentsDesk } from './fixtures/investmentsDesk'
import type { InvestmentsDesk } from './fixtures/investmentsDesk'
import { forgetCaches } from './fixtures/writeBack'
import { stepOf } from './fixtures/operationSteps'
import { INVESTMENTS_OPERATIONS } from '../src/apps/investments/assistant/operations/investmentsOperations'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: InvestmentsDesk) => store.state.workbook!.book

function setTargets(mix: string, targets: readonly { readonly group?: string | null; readonly account?: string | null; readonly percent: string }[]) {
  return stepOf(INVESTMENTS_OPERATIONS, 'set-targets', { mix, targets: targets.map((target) => ({ group: target.group ?? null, account: target.account ?? null, percent: target.percent })) })
}

describe('targets', () => {
  it('replaces every target with those of one mix, and one Undo puts the old ones back', async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([
      setTargets('account', [
        { account: desk.ref('investment-account', DESK.ONE.id), percent: '60' },
        { account: desk.ref('investment-account', DESK.TWO.id), percent: '40' },
      ]),
    ])

    expect(answer.isError).toBe(false)
    const result = await desk.accept()
    expect(bookOf(desk).targets.map((target) => [target.slice.mix, target.slice.group, decimalText(target.percent)])).toEqual([
      ['account', DESK.ONE.id, '60'],
      ['account', DESK.TWO.id, '40'],
    ])
    if (result.kind === 'done') await result.undo!()
    expect(bookOf(desk).targets.map((target) => target.slice.group)).toEqual(['stocks', 'cash'])
  })

  it("names each target by its group on the card, in the dialog's words", async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([setTargets('sector', [{ group: 'financials', percent: '100' }])])
    const labels = desk.cards[0]!.groups.flatMap((group) => group.lines.map((line) => line.label))
    expect(labels).toContain(holdingsWords.sectors.financials)
  })

  it.each([
    ['a sum other than 100', [{ group: 'stocks', percent: '50' }], holdingsWords.targets.dialog.whole],
    [
      'a percent of 0',
      [
        { group: 'stocks', percent: '100' },
        { group: 'cash', percent: '0' },
      ],
      holdingsWords.targets.dialog.percentError,
    ],
    ['a percent over 100', [{ group: 'stocks', percent: '120' }], holdingsWords.targets.dialog.percentError],
    [
      'a group twice',
      [
        { group: 'stocks', percent: '50' },
        { group: 'stocks', percent: '50' },
      ],
      'Each group has one target.',
    ],
    ['a class Kuna does not have', [{ group: 'art', percent: '100' }], 'targets.0.group is one of'],
  ])('refuses %s, as the dialog does, and writes nothing', async (_case, targets, refusal) => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([setTargets('class', targets)])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain(refusal)
    expect(desk.cards).toHaveLength(0)
  })

  it('takes a currency or a country by its code, and the account mix only by a ref', async () => {
    const desk = await investmentsDesk(used)
    expect((await desk.propose([setTargets('currency', [{ group: 'USD', percent: '100' }])])).isError).toBe(false)
    expect((await desk.propose([setTargets('country', [{ group: 'world', percent: '100' }])])).isError).toBe(false)
    expect((await desk.propose([setTargets('currency', [{ group: 'dollars', percent: '100' }])])).text).toContain('currency code')
    expect((await desk.propose([setTargets('account', [{ group: 'Broker One', percent: '100' }])])).text).toContain('names an account by its ref')
  })

  it('clears the targets, and refuses to clear what is not there', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([{ op: 'clear-targets', input: {} }])
    await desk.accept()
    expect(bookOf(desk).targets).toEqual([])
    const again = await desk.propose([{ op: 'clear-targets', input: {} }])
    expect(again.text).toContain('holds no targets')
  })
})

describe('checks', () => {
  it('leaves a new setting switched on off its card, and shows a switch the step sets', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-check', { check: 'cash', threshold: '15' })])
    expect(desk.cards[0]!.groups[0]!.lines[0]!.fields.map((field) => field.name)).not.toContain(assistantWords.proposals.fields.off)
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-check', { check: 'cash', on: 'no' })])
    const switched = desk.cards[1]!.groups[0]!.lines[0]!.fields.find((field) => field.name === assistantWords.proposals.fields.off)
    expect(switched?.after).toBe(cardWords.yes)
  })

  it('keeps a record only while a check differs from its default, as the Checks tab does', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-check', { check: 'cash', threshold: '15', on: 'no' })])
    await desk.accept()
    expect(bookOf(desk).checks.map((setting) => [setting.check, setting.threshold === null ? null : decimalText(setting.threshold), setting.off])).toEqual([['cash', '15', true]])

    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-check', { check: 'cash', threshold: '10', on: 'yes' })])
    await desk.accept()
    expect(bookOf(desk).checks).toEqual([])
  })

  it("refuses a threshold the tab would mark, in the tab's words", async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-check', { check: 'holding', threshold: '101' })])
    expect(answer.text).toContain(`threshold: ${settingsWords.checks.error}`)
  })
})

describe('the benchmark', () => {
  it('marks one instrument and clears the old mark in one write, and null leaves none', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-benchmark', { instrument: desk.ref('instrument', DESK.UNHELD.id) })])
    await desk.accept()
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-benchmark', { instrument: desk.ref('instrument', DESK.FUND.id) })])
    expect(desk.cards[1]!.count).toBe(2)
    const marks = desk.cards[1]!.groups.flatMap((group) => group.lines.flatMap((line) => line.fields.filter((field) => field.name === assistantWords.proposals.fields.benchmark)))
    expect(marks.map((field) => [field.before, field.after])).toEqual(
      expect.arrayContaining([
        [cardWords.yes, cardWords.no],
        [cardWords.no, cardWords.yes],
      ]),
    )
    await desk.accept()
    expect(
      bookOf(desk)
        .instruments.filter((instrument) => instrument.benchmark)
        .map((instrument) => instrument.id),
    ).toEqual([DESK.FUND.id])

    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-benchmark')])
    await desk.accept()
    expect(bookOf(desk).instruments.some((instrument) => instrument.benchmark)).toBe(false)
    expect((await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-benchmark')])).text).toContain('no benchmark to clear')
  })

  it('sets an instrument the same card adds on a card of its own, since a card cannot change what it adds', async () => {
    const desk = await investmentsDesk(used)
    const index = {
      name: 'Example Index',
      symbol: 'EXI',
      quoted: null,
      coupon: null,
      maturity: null,
      type: null,
      class: null,
      isin: '',
      exchange: '',
      currency: 'EUR',
      prices: 'manual',
      sourceSymbol: '',
      sector: '',
      country: '',
      ter: '',
      distribution: '',
      note: '',
      sectors: [],
      countries: [],
    }
    const answer = await desk.propose([{ op: 'add-instrument', input: index, as: '$index' }, stepOf(INVESTMENTS_OPERATIONS, 'set-benchmark', { instrument: '$index' })])
    expect(answer.text).toContain('on a card after the one that adds the instrument')
  })
})

describe('an instrument', () => {
  const fund = (fields: Readonly<Record<string, unknown>>) => ({
    op: 'add-instrument',
    input: {
      name: 'Example Fund',
      symbol: 'EXF',
      quoted: null,
      coupon: null,
      maturity: null,
      type: 'fund',
      class: null,
      isin: '',
      exchange: '',
      currency: 'EUR',
      prices: 'manual',
      sourceSymbol: '',
      sector: '',
      country: '',
      ter: '',
      distribution: '',
      note: '',
      sectors: [],
      countries: [],
      ...fields,
    },
  })

  it('adds a bond priced in percent with its coupon and maturity, and says so on the card', async () => {
    const desk = await investmentsDesk(used)

    await desk.propose([fund({ name: 'Example Bond', symbol: 'EXB', type: null, quoted: 'percent', coupon: '3.5', maturity: '2030-03-02' })])
    const fields = desk.cards[0]!.groups.flatMap((group) => group.lines.flatMap((line) => line.fields.map((field) => [field.name, field.after])))
    await desk.accept()

    expect(fields).toContainEqual([assistantWords.proposals.fields.quoted, expect.stringContaining('Percent of nominal')])
    expect(bookOf(desk).instruments.find((instrument) => instrument.name === 'Example Bond')).toMatchObject({ type: 'bond', quoted: { kind: 'percent' } })
  })

  it('refuses a bond without its coupon and maturity', async () => {
    const desk = await investmentsDesk(used)

    const answer = await desk.propose([fund({ quoted: 'percent' })])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('coupon: A yearly coupon in percent such as 3.5') })
  })

  it.each([
    ['a country', { country: 'Atlantis' }, 'country is a country code such as US, or a region: world, europe'],
    ['a country line', { countries: [{ group: 'Atlantis', percent: '100' }] }, 'countries.0.group is a country code such as US, or a region: world, europe'],
    ['a sector line', { sectors: [{ group: 'shipping', percent: '100' }] }, 'sectors.0.group is one of information-technology, financials'],
  ])('refuses %s outside the list by naming what it takes', async (_what, fields, refusal) => {
    const desk = await investmentsDesk(used)

    const answer = await desk.propose([fund(fields)])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining(refusal) })
  })
})

describe('the history answer', () => {
  it('is given and taken back on this device, each a card alone with an Undo that restores it', async () => {
    const desk = await investmentsDesk(used)
    expect((await desk.propose([{ op: 'forget-history', input: {} }])).text).toContain('not confirmed')
    await desk.propose([{ op: 'confirm-history', input: {} }])
    const result = await desk.accept()
    expect(desk.history.complete).toBe(true)
    expect((await desk.propose([{ op: 'confirm-history', input: {} }])).text).toContain('answered on this device already')
    if (result.kind === 'done') await result.undo!()
    expect(desk.history.complete).toBe(false)
  })

  it('restores on Undo the answer as Accept found it, and only while the same file is on screen', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([{ op: 'confirm-history', input: {} }])
    desk.history.complete = true
    const confirmed = await desk.accept()
    if (confirmed.kind === 'done') expect(await confirmed.undo!()).toEqual({ kind: 'undone' })
    expect(desk.history.complete).toBe(true)

    await desk.propose([{ op: 'forget-history', input: {} }])
    const forgotten = await desk.accept()
    desk.history.file = 'another-file'
    if (forgotten.kind === 'done') expect((await forgotten.undo!()).kind).toBe('refused')
    expect(desk.history.complete).toBe(false)

    await desk.propose([{ op: 'confirm-history', input: {} }])
    desk.history.file = 'investments-file'
    expect((await desk.accept()).kind).toBe('refused')
    expect(desk.history.complete).toBe(false)
  })

  it('goes alone, and never rides on a card that writes the books', async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([
      { op: 'clear-targets', input: {} },
      { op: 'confirm-history', input: {} },
    ])
    expect(answer.text).toContain('confirm-history goes alone on a card')
    expect(desk.history.complete).toBe(false)
  })
})
