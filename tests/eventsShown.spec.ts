import { describe, expect, it } from 'vitest'

import { eventStage, eventsShown } from '../src/apps/spending/events/domain/eventsShown'
import type { SpendingEvent } from '../src/apps/spending/workbook/domain/event'
import { EVENT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil } from './fixtures/ledger'

const event = (key: string, from: string, to: string): SpendingEvent => ({ id: recordIdOf(EVENT_RECORDS, key), name: key, days: { from: civil(from), to: civil(to) } })

const PRAGUE = event('Prague', '2027-07-10', '2027-07-14')
const SUMMER = event('Summer', '2027-07-01', '2027-08-31')

describe('the events Overview shows', () => {
  it('start on the first day and stay until seven days after the last', () => {
    expect(eventsShown([PRAGUE], civil('2027-07-09'))).toEqual([])
    expect(eventsShown([PRAGUE], civil('2027-07-10'))).toEqual([PRAGUE])
    expect(eventsShown([PRAGUE], civil('2027-07-14'))).toEqual([PRAGUE])
    expect(eventsShown([PRAGUE], civil('2027-07-21'))).toEqual([PRAGUE])
    expect(eventsShown([PRAGUE], civil('2027-07-22'))).toEqual([])
  })

  it('come shortest first', () => {
    expect(eventsShown([SUMMER, PRAGUE], civil('2027-07-12'))).toEqual([PRAGUE, SUMMER])
  })
})

describe('where the day falls for an event', () => {
  it('is ahead before its first day, which of its days while it runs, and how many days since after its last', () => {
    expect(eventStage(PRAGUE, civil('2027-07-09'))).toEqual({ kind: 'ahead' })
    expect(eventStage(PRAGUE, civil('2027-07-10'))).toEqual({ kind: 'running', day: 1, days: 5 })
    expect(eventStage(PRAGUE, civil('2027-07-14'))).toEqual({ kind: 'running', day: 5, days: 5 })
    expect(eventStage(PRAGUE, civil('2027-07-16'))).toEqual({ kind: 'over', daysSince: 2 })
  })
})
