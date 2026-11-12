import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { words } from '../src/apps/investments/assistant/words'
import { words as pricesWords } from '../src/apps/investments/prices/presentation/words'
import { words as taxWords } from '../src/apps/investments/tax/presentation/words'
import { SURTAX_CITY_2023_KEY } from '../src/apps/investments/workbook/domain/investmentSettings'
import { words as sharedWords } from '../src/shared/app/words'
import { settingValue } from '../src/shared/storage/domain/settingRows'
import { investmentsDesk } from './fixtures/investmentsDesk'
import type { InvestmentsDesk } from './fixtures/investmentsDesk'
import { forgetCaches } from './fixtures/writeBack'
import { stepOf } from './fixtures/operationSteps'
import { INVESTMENTS_OPERATIONS } from '../src/apps/investments/assistant/operations/investmentsOperations'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const cityOf = ({ store }: InvestmentsDesk) => settingValue(store.state.workbook!.book.settings, SURTAX_CITY_2023_KEY)

function setCity(value: string) {
  return stepOf(INVESTMENTS_OPERATIONS, 'set-setting', { key: SURTAX_CITY_2023_KEY, value })
}

describe('the 2023 city', () => {
  it("sets a code of Porezna's table, named on the card by its name and rate as the Tax screen names it, and one Undo clears it", async () => {
    const desk = await investmentsDesk(used)

    expect((await desk.propose([setCity('133')])).isError).toBe(false)

    const [line] = desk.cards[0]!.groups.flatMap((group) => group.lines)
    expect(line).toEqual({
      label: taxWords.surtaxCity.title,
      fields: [{ name: taxWords.surtaxCity.field, before: null, after: taxWords.surtaxCity.summary('Grad Zagreb', '18%'), warns: false }],
      warning: null,
    })
    const result = await desk.accept()
    expect(cityOf(desk)).toBe('133')
    if (result.kind === 'done') await result.undo!()
    expect(cityOf(desk)).toBe('')
  })

  it('changes one city for another, showing the place before and after, and clears it as a removal of the card', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([setCity('429')])
    await desk.accept()

    await desk.propose([setCity('none')])
    expect(desk.cards[1]!.groups[0]!.lines[0]!.fields).toEqual([
      { name: taxWords.surtaxCity.field, before: taxWords.surtaxCity.summary('Grad Sveti Ivan Zelina', '12%'), after: taxWords.surtaxCity.unlisted, warns: false },
    ])
    await desk.accept()
    expect(cityOf(desk)).toBe('none')

    await desk.propose([setCity('')])
    expect(desk.cards[2]!.groups).toMatchObject([{ verb: 'remove', lines: [{ label: taxWords.surtaxCity.title, fields: [] }] }])
    await desk.accept()
    expect(cityOf(desk)).toBe('')
  })

  it('refuses a code the table does not hold, and writes nothing', async () => {
    const desk = await investmentsDesk(used)

    const answer = await desk.propose([setCity('999')])

    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('surtax-city-2023')
    expect(desk.cards).toHaveLength(0)
  })
})

describe("a price vendor's requests today", () => {
  it("resets the count, with the Prices settings' words before and after, and Undo puts it back", async () => {
    const desk = await investmentsDesk(used)

    expect((await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'reset-requests-today', { vendor: 'twelvedata' })])).isError).toBe(false)

    expect(desk.cards[0]!.groups[0]!.lines[0]!.fields).toEqual([{ name: words.cards.requestsToday, before: pricesWords.usedToday(7, 800), after: pricesWords.usedToday(0, 800), warns: false }])
    const result = await desk.accept()
    expect(desk.requests.get('twelvedata')).toBe(0)
    if (result.kind === 'done') expect(await result.undo!()).toEqual({ kind: 'undone' })
    expect(desk.requests.get('twelvedata')).toBe(7)
  })

  it('refuses a vendor this browser asked nothing today', async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'reset-requests-today', { vendor: 'finnhub' })])
    expect(answer.isError).toBe(true)
    expect(desk.cards).toHaveLength(0)
  })

  it('refuses Accept once the vendor was asked again, and Undo once it was asked after Accept', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'reset-requests-today', { vendor: 'twelvedata' })])
    desk.requests.set('twelvedata', 8)
    expect(await desk.accept()).toEqual({ kind: 'refused', reason: words.cards.countChanged })
    expect(desk.requests.get('twelvedata')).toBe(8)

    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'reset-requests-today', { vendor: 'twelvedata' })])
    const result = await desk.accept()
    desk.requests.set('twelvedata', 1)
    if (result.kind === 'done') expect(await result.undo!()).toEqual({ kind: 'refused', reason: sharedWords.proposalUndoEnded })
    expect(desk.requests.get('twelvedata')).toBe(1)
  })
})
