import { describe, expect, it } from 'vitest'

import { recipeStatement } from '../src/apps/spending/statements/domain/recipeStatement'
import { REVOLUT_STATEMENT } from '../src/apps/spending/statements/domain/revolutRecipe'
import { en } from '../src/apps/spending/statements/domain/words'
import { en as screenEnglish, hr as screenCroatian } from '../src/apps/spending/statements/presentation/words'
import { dayLabel } from '../src/shared/calendar/dayLabel'
import { ACCOUNTS, CATEGORIES, REVOLUT_EUR } from './fixtures/spending'
import { civil } from './fixtures/ledger'

const HEADER = ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Currency', 'State', 'Balance']

function line(started: string, amount: string, currency = 'EUR', product = 'Current', state = 'COMPLETED'): string[] {
  return ['CARD_PAYMENT', product, `${started} 10:00:00`, `${started} 10:00:00`, 'Shop', amount, '0.00', currency, state, '']
}

describe('what a statement file holds', () => {
  it('counts the rows of each product and currency with their first and last day and the account they go to, current first', () => {
    const reading = recipeStatement(
      REVOLUT_STATEMENT,
      [
        HEADER,
        line('2026-10-03', '5.00', 'EUR', 'Savings'),
        line('2026-10-05', '-2.00'),
        line('2026-10-01', '-3.00'),
        line('2026-10-04', '-1.00', 'EUR', 'Current', 'PENDING'),
        line('2026-10-02', '-9.00', 'EUR', 'Deposit'),
        line('2026-10-02', '-9.00', 'EUR', 'Current', 'REVERTED'),
      ],
      'export.csv',
      { accounts: ACCOUNTS, categories: CATEGORIES },
      en.feeOn,
    )

    expect(reading.holdings).toEqual([
      { savings: false, currency: 'EUR', rows: 3, first: civil('2026-10-01'), last: civil('2026-10-05'), account: REVOLUT_EUR.id },
      { savings: true, currency: 'EUR', rows: 1, first: civil('2026-10-03'), last: civil('2026-10-03'), account: null },
    ])
  })

  it('still says what a file refused for its missing accounts holds', () => {
    const reading = recipeStatement(
      REVOLUT_STATEMENT,
      [HEADER, line('2026-10-02', '-4.00', 'GBP'), line('2026-10-01', '-1.00')],
      'export.csv',
      { accounts: ACCOUNTS, categories: CATEGORIES },
      en.feeOn,
    )

    expect('refused' in reading && reading.refused).toEqual({ kind: 'missing-accounts' })
    expect(reading.holdings.map((holding) => [holding.currency, holding.rows, holding.account])).toEqual([
      ['GBP', 1, null],
      ['EUR', 1, REVOLUT_EUR.id],
    ])
  })

  it('names one day alone when every row of a product falls on it, whatever the count', () => {
    const day = civil('2026-11-19')

    expect(screenEnglish.import.holdings.rows(2, day, day).other).toBe(`2 rows on ${dayLabel(day)}`)
    expect(screenCroatian.import.holdings.rows(2, day, day).few).toBe(`2 retka, ${dayLabel(day)}`)
    expect(screenEnglish.import.holdings.rows(2, day, civil('2026-11-20')).other).toBe(`2 rows from ${dayLabel(day)} to ${dayLabel(civil('2026-11-20'))}`)
  })
})
