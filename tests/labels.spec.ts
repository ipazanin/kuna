import { describe, expect, it } from 'vitest'

import { carriedLabels, labelCalled, labelNameProblem, labelOrder, labelsOf, withLabel, withoutLabel } from '../src/shared/categorising/domain/labels'
import type { Label } from '../src/shared/categorising/domain/labels'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { LABEL_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

const PRAGUE: Label = { id: recordIdOf(LABEL_RECORDS, 'prague'), name: 'Prague' }
const FLAT: Label = { id: recordIdOf(LABEL_RECORDS, 'flat'), name: 'New flat' }

describe("a label's name", () => {
  it('is not blank and no other label has it once folded, so Prague and prague are one label', () => {
    expect(labelNameProblem('  ', [PRAGUE], null)).toBe('blank')
    expect(labelNameProblem(' prague ', [PRAGUE], null)).toBe('taken')
    expect(labelNameProblem('Prague', [PRAGUE], PRAGUE.id)).toBeNull()
    expect(labelNameProblem('Praha', [PRAGUE], null)).toBeNull()
  })

  it('typed again names the label it already is once folded, and a blank or new name names none', () => {
    expect(labelCalled(' PRAGUE ', [PRAGUE])).toBe(PRAGUE)
    expect(labelCalled('Praha', [PRAGUE])).toBeNull()
    expect(labelCalled('  ', [PRAGUE])).toBeNull()
  })
})

describe('labels on parts', () => {
  const parts = [
    { id: 'a', amount: -60, labels: [PRAGUE.id] },
    { id: 'b', amount: -40, labels: [] },
  ]

  it('go on every part that lacks them and come off every part that has them', () => {
    expect(withLabel(parts, PRAGUE.id).map((part) => part.labels)).toEqual([[PRAGUE.id], [PRAGUE.id]])
    expect(withLabel(parts, PRAGUE.id)[0]).toBe(parts[0])
    expect(withoutLabel(parts, PRAGUE.id).map((part) => part.labels)).toEqual([[], []])
  })

  it('are listed once each, in the order the parts first carry them', () => {
    expect(labelsOf([{ labels: [FLAT.id] }, { labels: [PRAGUE.id, FLAT.id] }])).toEqual([FLAT.id, PRAGUE.id])
  })

  it('carry to a new part or one that grew from the parts it took money from, and a part that kept its money keeps its own', () => {
    const left = [
      { id: 'a', amount: -30, labels: [] },
      { id: 'b', amount: -40, labels: [FLAT.id] },
      { id: 'c', amount: -30, labels: [] },
    ]
    // a gave 30 to c, so c takes a's Prague. b kept its 40, so it keeps only its own.
    expect(carriedLabels(parts, left).map((part) => part.labels)).toEqual([[], [FLAT.id], [PRAGUE.id]])
    expect(carriedLabels(parts, parts)).toBe(parts)
  })
})

describe('the order of a list of labels', () => {
  it('puts the labels nothing carries first, then the newest, then by name within a day', () => {
    const day = (text: string) => parseCivilDate(text)!
    const listed = [
      { label: FLAT, latest: day('2026-03-01') },
      { label: PRAGUE, latest: day('2026-05-01') },
      { label: { ...FLAT, name: 'Garden' }, latest: day('2026-03-01') },
      { label: { ...PRAGUE, name: 'Unused' }, latest: null },
    ]
    expect([...listed].sort(labelOrder).map((held) => held.label.name)).toEqual(['Unused', 'Prague', 'Garden', 'New flat'])
  })
})
