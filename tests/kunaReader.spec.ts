import { describe, expect, it } from 'vitest'

import type { AppContribution, CountedHubPart, HubState } from '../src/shared/app/appContribution'
import type { ReportFigure } from '../src/shared/app/assistantReader'
import { today } from '../src/shared/calendar/civilDate'
import { kunaReader } from '../src/shell/assistant/kunaReader'
import { installApp } from '../src/shell/routing/appRegistry'
import { euros } from './fixtures/ledger'

let loansFigures: HubState<CountedHubPart> = 'opening'

/** An app as Net worth reads it: its id, name, currency and figures. */
function appOf(id: string, figures: () => HubState<CountedHubPart>): AppContribution {
  return {
    id,
    name: id,
    install: async () => {},
    firstRun: () => false,
    moneyFormat: () => ({ currency: 'EUR', locale: 'en-GB' }),
    hub: { counts: true, figures },
  } as unknown as AppContribution
}

function part(key: string, label: string, cents: number, side: CountedHubPart['side']): CountedHubPart {
  return { key, label, cents: euros(cents), side, caption: null, to: '/' }
}

await installApp(appOf('loans', () => loansFigures))
await installApp(appOf('investments', () => ({ parts: [part('investments value', 'Investments value', 40_000, 'has')], notes: ['1 holding without a price'] })))

const report = kunaReader().reports.find((candidate) => candidate.id === 'net_worth')!

function amounts(figures: readonly ReportFigure[]): Record<string, number> {
  return Object.fromEntries(figures.flatMap((figure) => ('cents' in figure ? [[figure.label, figure.cents]] : [])))
}

describe("the chat's reading of Net worth", () => {
  it('waits while an app is still opening', () => {
    loansFigures = 'opening'

    expect(kunaReader().status()).toBe('opening')
  })

  it('reads the sum, each side and each part by its app and key, never by the name a person gave a loan', () => {
    loansFigures = { parts: [part('bank loan from Example Bank paid out 2021-03-01', 'Our flat', 95_000, 'owes'), part('owed to you', 'Owed to you', 500, 'has')], notes: [] }
    const figures = report.figures(null)

    expect(kunaReader().status()).toBe('open')
    expect(amounts(figures)).toEqual({
      // 40,000.00 + 500.00 − 95,000.00.
      'what you have less what you owe': euros(-54_500),
      'what you have': euros(40_500),
      'what you owe': euros(95_000),
      'what you have, investments: investments value': euros(40_000),
      'what you have, loans: owed to you': euros(500),
      'what you owe, loans: bank loan from Example Bank paid out 2021-03-01': euros(95_000),
    })
    expect(figures).toContainEqual({ label: 'left out: 1 holding without a price', count: 1 })
    expect(JSON.stringify(figures)).not.toContain('Our flat')
  })

  it('says why there is no sum when an app failed to open', () => {
    loansFigures = 'failed'

    expect(report.figures(null)).toContainEqual({ label: 'no sum, as loans did not open', count: 1 })
  })

  it('reads today and refuses any other day', () => {
    loansFigures = { parts: [], notes: [] }

    expect(report.figures(today())).toEqual(report.figures(null))
    expect(() => report.figures('2020-01-01')).toThrow(RangeError)
  })
})
