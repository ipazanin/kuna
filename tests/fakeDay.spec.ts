// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { today } from '../src/shared/calendar/civilDate'
import { fakeDayHere } from '../src/shared/calendar/infrastructure/fake/fakeDay'

function openAt(search: string): void {
  window.history.replaceState(null, '', `/${search}`)
}

describe('fakeDayHere', () => {
  afterEach(() => {
    openAt('')
  })

  it('takes today when the address names no day', () => {
    openAt('?spending=sample')

    expect(fakeDayHere()).toBe(today())
  })

  it('takes the day the address names', () => {
    openAt('?spending=sample&day=2027-03-31')

    expect(fakeDayHere()).toBe('2027-03-31')
  })

  it.each(['2026-02-30', 'soon', ''])('takes today when the address names %j, which is no day', (day) => {
    openAt(`?day=${day}`)

    expect(fakeDayHere()).toBe(today())
  })
})
