import { describe, expect, it } from 'vitest'

import { monthCase } from '../src/shared/calendar/monthCase'

const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(2026, index, 1)))
const MONTH_AND_YEAR = new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const DAY_AND_MONTH = new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

describe('monthCase', () => {
  it('writes every month in the genitive Intl gives a day of it', () => {
    for (const month of MONTHS) {
      const genitive = DAY_AND_MONTH.format(month).replace(/^\d+\.\s/, '')
      expect(monthCase(MONTH_AND_YEAR.format(month), 'genitive')).toBe(`${genitive} 2026.`)
    }
  })

  it('writes the accusative after za', () => {
    expect(`za ${monthCase('veljača 2027.', 'accusative')}`).toBe('za veljaču 2027.')
    expect(`za ${monthCase('listopad 2026.', 'accusative')}`).toBe('za listopad 2026.')
    expect(`za ${monthCase('studeni 2026.', 'accusative')}`).toBe('za studeni 2026.')
  })

  it('writes the genitive after od and do', () => {
    expect(`od ${monthCase('lipanj 2025.', 'genitive')}`).toBe('od lipnja 2025.')
    expect(`do ${monthCase('studeni 2026.', 'genitive')}`).toBe('do studenoga 2026.')
  })

  it('writes the locative after u', () => {
    expect(`u ${monthCase('listopad 2026.', 'locative')}`).toBe('u listopadu 2026.')
    expect(`u ${monthCase('veljača', 'locative')}`).toBe('u veljači')
    expect(`u ${monthCase('studeni 2026.', 'locative')}`).toBe('u studenome 2026.')
  })

  it('keeps a capital at the start of a sentence', () => {
    expect(monthCase('Lipanj 2025.', 'genitive')).toBe('Lipnja 2025.')
  })

  it('puts each month of a range in the case', () => {
    expect(`od ${monthCase('siječanj 2026. – ožujak 2026.', 'genitive')}`).toBe('od siječnja 2026. – ožujka 2026.')
  })

  it('leaves a numeric date and English as they are', () => {
    expect(monthCase('20. 9. 2026.', 'genitive')).toBe('20. 9. 2026.')
    expect(monthCase('Oct 2026', 'genitive')).toBe('Oct 2026')
  })
})
