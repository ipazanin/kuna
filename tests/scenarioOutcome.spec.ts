import { describe, expect, it } from 'vitest'

import type { Grant } from '../src/packs/hr-doo/domain/grants/grants'
import type { OwnerPayScenario, ScenarioComponent } from '../src/packs/hr-doo/domain/scenarios/ownerPayScenarios'
import type { CarriedLoss } from '../src/packs/hr-doo/domain/cit/taxBase'
import type { EmployeeFacts } from '../src/packs/hr-doo/domain/payroll/incomeTax'
import { tracedFigure } from '../src/packs/hr-doo/domain/payroll/payrollArithmetic'
import { marginalEuro } from '../src/packs/hr-doo/domain/scenarios/marginalEuro'
import { scenarioCompany } from '../src/packs/hr-doo/domain/scenarios/scenarioCompany'
import type { ScenarioCompany } from '../src/packs/hr-doo/domain/scenarios/scenarioCompany'
import { scenarioOutcome } from '../src/packs/hr-doo/domain/scenarios/scenarioOutcome'
import type { ScenarioOutcome, ScenarioWarning } from '../src/packs/hr-doo/domain/scenarios/scenarioOutcome'
import { startingScenarios } from '../src/packs/hr-doo/domain/scenarios/startingScenarios'
import type { Rate } from '../src/packs/hr-doo/ruleset/schema'
import type { TracedFigure } from '../src/packs/hr-doo/ruleset/tracedFigure'
import { addMoney, subtractMoney, sumMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { STEADY_GRANT, steadyStudio } from './fixtures/steadyStudio'
import { ZAGREB_RESIDENT } from './fixtures/zagrebResident'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { SCENARIO_RECORDS } from '../src/packs/hr-doo/domain/hrDooKinds'

function figure(label: string, amount: number): TracedFigure {
  return tracedFigure(label, euros(amount), 'ledger', [])
}

const NO_LOSSES: readonly CarriedLoss[] = []

/**
 * A synthetic company that earns 60,000.00 before owner pay: 100,000.00 of revenue less 40,000.00
 * of other costs, with nothing the corporate tax adds back. It holds 50,000.00 of cash before the
 * owner pay and the corporate tax, and the owner owes it 5,000.00.
 */
function company(changes: Partial<ScenarioCompany> = {}): ScenarioCompany {
  return {
    takenFrom: 2026,
    registered: civil('2025-01-02'),
    taxBaseInput: {
      year: 2026,
      revenue: figure('PD line 1, revenue', 100_000),
      expenses: figure('PD line 2, expenses without owner pay', 40_000),
      representation: figure('Representation', 0),
      personalTransport: figure('Personal transport', 0),
      nonDeductible: figure('Non-deductible', 0),
      depreciationAboveAllowed: figure('Depreciation above allowed', 0),
      relatedPartyInterestShortfall: figure('Related-party interest', 0),
      lossesBroughtForward: NO_LOSSES,
    },
    ownerPayInForecast: figure('Owner pay in the forecast', 0),
    profitBeforeOwnerPay: figure('Profit before owner pay', 60_000),
    cashBeforeOwnerPay: figure('Cash before owner pay', 50_000),
    owedByOwner: figure('Owed by the owner', 5000),
    retainedBroughtIn: figure('Retained', 0),
    reserves: figure('Reserves', 0),
    shareCapital: figure('Share capital', 2500),
    grants: [],
    ...changes,
  }
}

type Draft = ScenarioComponent extends infer Each ? (Each extends ScenarioComponent ? Omit<Each, 'id' | 'from' | 'to'> & { from?: string; to?: string } : never) : never

function scenario(year: number, drafts: readonly Draft[]): OwnerPayScenario {
  const components = drafts.map((draft, index) => ({ ...draft, from: draft.from === undefined ? null : civil(draft.from), to: draft.to === undefined ? null : civil(draft.to), id: recordIdOf(SCENARIO_RECORDS, `row-${index + 2}`) }) as ScenarioComponent)
  return { slug: 'test', label: 'Test', year, components }
}

function outcome(drafts: readonly Draft[], changes: Partial<ScenarioCompany> = {}, facts: EmployeeFacts = ZAGREB_RESIDENT, year = 2026): ScenarioOutcome {
  return scenarioOutcome(scenario(year, drafts), company(changes), facts)
}

/** Net to the owner, pillar II, the state and what the company keeps add up to the profit before owner pay. */
function splitOf(result: ScenarioOutcome) {
  return addMoney(addMoney(result.netToOwner.amount, result.taxes.pensionPillarTwo.amount), addMoney(result.stateTake.amount, result.keptInCompany.amount))
}

function kinds(warnings: readonly ScenarioWarning[]): string[] {
  return warnings.map((warning) => warning.kind)
}

const FLOOR: Draft = { component: 'salary_gross', gross: 'floor' }
const MAX_DIVIDEND: Draft = { component: 'dividend', amount: 'max' }

describe('scenarioOutcome, the floor salary all year and the rest as a dividend', () => {
  // A 2026 month at the floor in Zagreb, as payrollMonth.spec works it out: gross 1,295.45, pillar I
  // 193.98, pillar II 64.77, income 1,036.70, tax 23% x 436.70 = 100.44, net 936.26, health 213.75,
  // gross II 1,509.20.
  const result = outcome([FLOOR, MAX_DIVIDEND])

  it('runs twelve months of payroll and the annual settlement', () => {
    expect(result.payroll).toHaveLength(12)
    expect(result.netSalary.amount).toBe(euros(11_235.12))
    expect(result.grossTwo.amount).toBe(euros(18_110.4))
    expect(result.taxes.pensionPillarOne.amount).toBe(euros(2327.76))
    expect(result.taxes.pensionPillarTwo.amount).toBe(euros(777.24))
    expect(result.taxes.health.amount).toBe(euros(2565))
    expect(result.taxes.incomeTaxWithheld.amount).toBe(euros(1205.28))
    // Income 12 x 1,036.70 = 12,440.40 less 7,200.00 of allowance is 5,240.40. 23% of it is
    // 1,205.292, so 1,205.29, a cent more than the months withheld.
    expect(result.settlementRefund.amount).toBe(euros(-0.01))
    expect(result.taxes.settlementChange.amount).toBe(euros(0.01))
  })

  it('takes the corporate tax with the salary deducted and without it', () => {
    // Without: 10% x 60,000.00. With: 10% x (60,000.00 - 18,110.40) = 4,188.96.
    expect(result.corporateTaxWithoutOwnerPay.amount).toBe(euros(6000))
    expect(result.taxes.corporateTax.amount).toBe(euros(4188.96))
    expect(result.corporateTaxSaved.amount).toBe(euros(1811.04))
    expect(result.profitAfterTax.amount).toBe(euros(37_700.64))
  })

  it('pays out the rest as a dividend, set off first against what the owner owes', () => {
    expect(result.dividend.gross.amount).toBe(euros(37_700.64))
    // 12% x 37,700.64 = 4,524.0768.
    expect(result.dividend.tax.amount).toBe(euros(4524.08))
    expect(result.dividend.net.amount).toBe(euros(33_176.56))
    expect(result.dividend.setOff.amount).toBe(euros(5000))
    expect(result.dividend.cashOut.amount).toBe(euros(32_700.64))
    expect(result.dividend.netAssetsAfter.amount).toBe(euros(2500))
  })

  it('splits the profit before owner pay into net to the owner, pillar II, the state and what is kept', () => {
    // 11,235.12 + 33,176.56 - 0.01.
    expect(result.netToOwner.amount).toBe(euros(44_411.67))
    expect(result.companyCost.amount).toBe(euros(60_000))
    expect(result.keptInCompany.amount).toBe(euros(0))
    // 2,327.76 + 2,565.00 + 1,205.28 + 0.01 + 4,524.08 + 4,188.96.
    expect(result.stateTake.amount).toBe(euros(14_811.09))
    expect(splitOf(result)).toBe(euros(60_000))
    // 44,411.67 / 60,000.00 x 100 = 74.0195.
    expect(result.netPerHundred?.amount).toBe(euros(74.02))
  })

  it('warns when the cash does not cover the year', () => {
    // 50,000.00 - 18,110.40 - 4,188.96 - 32,700.64.
    expect(result.cashAfter.amount).toBe(euros(-5000))
    expect(kinds(result.warnings)).toEqual(['cash-short'])
    expect(kinds(outcome([FLOOR, MAX_DIVIDEND], { cashBeforeOwnerPay: figure('Cash', 60_000) }).warnings)).toEqual([])
  })

  it('cites the rules behind each figure and marks no estimate in 2026', () => {
    const cited = new Set(result.taxes.corporateTax.rules.map((citation) => citation.ruleId))
    expect(cited.has('hr.cit.rate')).toBe(true)
    expect(result.dividend.tax.rules.map((citation) => citation.ruleId)).toEqual(['hr.pit.dividend'])
    expect(result.watched).toEqual([])
  })
})

describe('scenarioOutcome, the floor until June and then a board member only', () => {
  // Six months at the floor as above. From July the director is insured on 1,993.00, the 2026
  // board member base, and pays 15% + 5% + 16.5% of it himself: 298.95 + 99.65 + 328.85 = 727.45.
  const grant: Grant = { ...STEADY_GRANT, received: civil('2025-06-01'), employmentRequiredUntil: civil('2026-09-30') }
  const result = outcome([{ ...FLOOR, to: '2026-06-30' }, { component: 'director_basis', basis: 'board-only', from: '2026-07-01' }, MAX_DIVIDEND], {
    grants: [grant],
    cashBeforeOwnerPay: figure('Cash', 80_000),
  })

  it('charges the contributions a board member pays personally to the owner', () => {
    expect(result.payroll).toHaveLength(6)
    expect(result.ownContributions.amount).toBe(euros(-4364.7))
    expect(result.taxes.pensionPillarOne.amount).toBe(euros(1163.88 + 1793.7))
    expect(result.taxes.pensionPillarTwo.amount).toBe(euros(388.62 + 597.9))
    expect(result.taxes.health.amount).toBe(euros(1282.5 + 1973.1))
  })

  it('refunds the tax of the salary months, as twelve allowances cover the year', () => {
    // Income 6 x 1,036.70 = 6,220.20 is below 7,200.00, so the year owes nothing.
    expect(result.settlement?.annualTax.amount).toBe(euros(0))
    expect(result.settlementRefund.amount).toBe(euros(602.64))
  })

  it('pays out more as a dividend, and the split still adds up', () => {
    // 10% x (60,000.00 - 9,055.20) = 5,094.48, leaving 45,850.32. 12% of it is 5,502.0384.
    expect(result.taxes.corporateTax.amount).toBe(euros(5094.48))
    expect(result.dividend.gross.amount).toBe(euros(45_850.32))
    expect(result.dividend.net.amount).toBe(euros(40_348.28))
    // 5,617.56 + 40,348.28 + 602.64 - 4,364.70.
    expect(result.netToOwner.amount).toBe(euros(42_203.78))
    expect(splitOf(result)).toBe(euros(60_000))
  })

  it('warns that the salary stops before the grant no longer requires the employment', () => {
    const dropped = result.warnings.find((warning) => warning.kind === 'salary-dropped')
    expect(dropped).toMatchObject({ grant: 'example-grant', from: '2026-07-01', requiredUntil: '2026-09-30' })
    // In the second year of the grant period the second-year terms apply: 500.00.
    expect(dropped?.kind === 'salary-dropped' ? dropped.atRisk?.amount : null).toBe(euros(500))
    expect(result.notes.map((note) => note.kind)).toEqual(['board-only'])
  })
})

describe('scenarioOutcome, the salary around the grant employment date', () => {
  const grant: Grant = { ...STEADY_GRANT, received: civil('2025-06-01'), employmentRequiredUntil: civil('2026-09-30') }
  const stoppingAfter = (lastDay: string, firstDayOff: string) =>
    outcome([{ ...FLOOR, to: lastDay }, { component: 'director_basis', basis: 'board-only', from: firstDayOff }, MAX_DIVIDEND], { grants: [grant], cashBeforeOwnerPay: figure('Cash', 80_000) })

  it('does not warn when the salary runs to the employment date itself', () => {
    expect(kinds(stoppingAfter('2026-09-30', '2026-10-01').warnings)).toEqual([])
  })

  it('warns from the employment date when the salary stops the day before it', () => {
    expect(stoppingAfter('2026-09-29', '2026-09-30').warnings).toMatchObject([{ kind: 'salary-dropped', from: '2026-09-30', requiredUntil: '2026-09-30' }])
  })
})

describe('scenarioOutcome, a dividend at the share capital floor', () => {
  const rich = { cashBeforeOwnerPay: figure('Cash', 90_000) }

  it('does not warn for a dividend of exactly the distributable amount, which leaves the share capital covered', () => {
    // The distributable amount is the 37,700.64 profit after tax of the floor salary scenario.
    const result = outcome([FLOOR, { component: 'dividend', amount: euros(37_700.64) }], rich)
    expect(result.dividend.netAssetsAfter.amount).toBe(euros(2500))
    expect(kinds(result.warnings)).toEqual([])
  })

  it('warns for a cent more', () => {
    const result = outcome([FLOOR, { component: 'dividend', amount: euros(37_700.65) }], rich)
    expect(result.dividend.netAssetsAfter.amount).toBe(euros(2499.99))
    expect(kinds(result.warnings)).toEqual(['dividend-above-capacity', 'net-assets-below-capital'])
  })
})

describe('scenarioOutcome, a job elsewhere after June', () => {
  it('owes no contributions and leaves the other employer the allowance of those months', () => {
    const result = outcome([{ ...FLOOR, to: '2026-06-30' }, { component: 'director_basis', basis: 'insured-elsewhere', from: '2026-07-01' }, MAX_DIVIDEND])
    expect(result.ownContributions.amount).toBe(euros(0))
    // 6,220.20 less six allowances of 600.00 is 2,620.20. 23% of it is 602.646, so 602.65.
    expect(result.settlement?.allowance.amount).toBe(euros(3600))
    expect(result.settlementRefund.amount).toBe(euros(-0.01))
    expect(result.notes.map((note) => note.kind)).toEqual(['insured-elsewhere'])
    expect(splitOf(result)).toBe(euros(60_000))
  })
})

describe('scenarioOutcome, tax-free items, rent and a salary below the floor', () => {
  const result = outcome(
    [
      { component: 'salary_gross', gross: euros(1000) },
      { component: 'nontaxable', item: 'results-bonus', amount: euros(1200) },
      { component: 'nontaxable', item: 'occasional-gift', amount: euros(900), from: '2026-03-01' },
      { component: 'rent_monthly', amount: euros(300), from: '2026-07-01' },
      MAX_DIVIDEND,
    ],
    { cashBeforeOwnerPay: figure('Cash', 80_000) },
  )

  it('pays the floor and says the agreed salary is below it', () => {
    const below = result.warnings.find((warning) => warning.kind === 'below-floor')
    expect(below).toMatchObject({ agreed: euros(1000) })
    expect(below?.kind === 'below-floor' ? below.floor.amount : null).toBe(euros(1295.45))
    expect(result.payroll[0]?.gross.amount).toBe(euros(1295.45))
  })

  it('taxes the part of a tax-free item over its cap as salary in the month it is paid', () => {
    const over = result.warnings.find((warning) => warning.kind === 'cap-exceeded')
    expect(over).toMatchObject({ item: 'occasional-gift' })
    expect(over?.kind === 'cap-exceeded' ? [over.cap.amount, over.excess.amount] : null).toEqual([euros(700), euros(200)])
    // March: 1,295.45 + 200.00 = 1,495.45, above 1,300.00, so no relief. Pillar I 15% = 224.3175,
    // pillar II 5% = 74.7725, income 1,196.36, taxable 596.36, tax 23% = 137.1628, net 1,059.20.
    const march = result.payroll[2]
    expect(march?.gross.amount).toBe(euros(1495.45))
    expect(march?.pensionRelief.amount).toBe(euros(0))
    expect(march?.incomeTax.amount).toBe(euros(137.16))
    expect(march?.net.amount).toBe(euros(1059.2))
    expect(march?.nontaxablePayments.amount).toBe(euros(700))
    expect(result.payroll[0]?.nontaxablePayments.amount).toBe(euros(1200))
    expect(result.taxFree.amount).toBe(euros(1900))
  })

  it('pays the rent from July, less 8.4% rent tax the owner pays', () => {
    // 300.00 less 30% flat expenses is 210.00, taxed at 12%: 25.20 a month.
    expect(result.rent.amount).toBe(euros(1800))
    expect(result.taxes.rentTax.amount).toBe(euros(151.2))
    expect(result.rentAfterTax.amount).toBe(euros(1648.8))
    expect(result.deductibleOwnerPay.amount).toBe(sumMoney([result.grossTwo.amount, euros(1900), euros(1800)]))
    expect(result.notes.map((note) => note.kind)).toEqual(['tax-free-basis', 'tax-free-basis', 'rent-basis'])
    expect(splitOf(result)).toBe(euros(60_000))
  })
})

describe('scenarioOutcome, a dividend the year cannot pay', () => {
  it('warns that it is above the capacity and leaves net assets below the share capital', () => {
    const result = outcome([FLOOR, { component: 'dividend', amount: euros(50_000) }], { cashBeforeOwnerPay: figure('Cash', 90_000) })
    expect(result.dividend.distributable.amount).toBe(euros(37_700.64))
    // 2,500.00 + 37,700.64 - 50,000.00.
    expect(result.dividend.netAssetsAfter.amount).toBe(euros(-9799.36))
    expect(kinds(result.warnings)).toEqual(['dividend-above-capacity', 'net-assets-below-capital'])
    // What the company pays beyond the year's profit comes out of what it held.
    expect(result.keptInCompany.amount).toBe(euros(-12_299.36))
    expect(splitOf(result)).toBe(euros(60_000))
  })

  it('pays no dividend when the scenario names none, and keeps the rest', () => {
    const result = outcome([FLOOR], { cashBeforeOwnerPay: figure('Cash', 90_000) })
    expect(result.dividend.gross.amount).toBe(euros(0))
    expect(result.keptInCompany.amount).toBe(euros(37_700.64))
  })
})

describe('scenarioOutcome on a year the ruleset only estimates', () => {
  it('lists the estimated, pending and unconfirmed rules behind the figures, such as the 2027 director floor', () => {
    const result = outcome([FLOOR, MAX_DIVIDEND], { taxBaseInput: { ...company().taxBaseInput, year: 2027 } }, ZAGREB_RESIDENT, 2027)
    const marks = new Map(result.watched.map((citation) => [citation.ruleId, citation.confidence]))
    expect(marks.get('hr.contrib.director-floor')).toBe('estimate')
    expect(marks.get('hr.contrib.rates')).toBe('pending')
    expect([...marks.values()].every((confidence) => ['estimate', 'pending', 'unconfirmed'].includes(confidence))).toBe(true)
    expect(result.payroll[0]?.gross.amount).toBe(euros(1413.75))
  })
})

describe('scenarioOutcome refuses what a guard stops', () => {
  it('names the rows', () => {
    expect(() => outcome([FLOOR, { ...FLOOR, from: '2026-06-01' }])).toThrow('The floor salary and the floor salary from 2026-06-01 both set the salary on 2026-06-01.')
  })
})

describe('marginalEuro, the next 100.00 of company money in 2026', () => {
  const rate = { label: 'PD line 43', basisPoints: 1000 as Rate, rules: [] }

  it('recomputes the owner-pay lane table from the rules, for a Zagreb resident', () => {
    const routes = marginalEuro(2026, ZAGREB_RESIDENT, rate)
    // Salary: gross 100.00 / 1.165 = 85.84. Pillar I 12.88, pillar II 4.29, income 68.67.
    // 23% of it is 15.7941, so 52.88 net. At 33%, 22.6611, so 46.01.
    expect(routes.map((route) => [route.id, route.net.amount])).toEqual([
      ['tax-free', euros(100)],
      ['rent', euros(91.6)],
      ['dividend', euros(79.2)],
      ['salary', euros(52.88)],
      ['salary-higher-rate', euros(46.01)],
    ])
  })

  it('adds the youth relief route for a birth year in a band', () => {
    // Born 1998, in the 50% band of 2026: half of 15.79 back, 7.895, so 7.90.
    const routes = marginalEuro(2026, { ...ZAGREB_RESIDENT, birthYear: 1998 }, rate)
    expect(routes.find((route) => route.id === 'salary-youth-relief')?.net.amount).toBe(euros(60.78))
  })
})

describe('startingScenarios', () => {
  it('seeds four scenarios with the caps of the year and the switch after the grant', () => {
    const { drafts, switchOn } = startingScenarios(2027, [STEADY_GRANT], euros(250))
    expect(switchOn).toBe('2027-06-01')
    expect(drafts.map((draft) => draft.slug)).toEqual(['floor-salary-2027', 'floor-salary-extras-2027', 'floor-then-board-2027', 'floor-then-elsewhere-2027'])
    expect(drafts[1]?.components).toEqual([
      { component: 'salary_gross', gross: 'floor', from: null, to: null },
      { component: 'nontaxable', item: 'results-bonus', amount: euros(1200), from: null, to: null },
      { component: 'nontaxable', item: 'occasional-gift', amount: euros(700), from: null, to: null },
      { component: 'nontaxable', item: 'meal-allowance-flat', amount: euros(1200), from: null, to: null },
      { component: 'rent_monthly', amount: euros(250), from: null, to: null },
      { component: 'dividend', amount: 'max', from: null, to: null },
    ])
    expect(drafts[2]?.components).toEqual([
      { component: 'salary_gross', gross: 'floor', from: null, to: '2027-05-31' },
      { component: 'director_basis', basis: 'board-only', from: '2027-06-01', to: null },
      { component: 'dividend', amount: 'max', from: null, to: null },
    ])
  })

  it('leaves out rent without one, and the two that stop the salary when the year cannot', () => {
    const { drafts, switchOn } = startingScenarios(2026, [STEADY_GRANT], null)
    expect(switchOn).toBeNull()
    expect(drafts.map((draft) => draft.label)).toEqual(['Floor salary all year', 'Floor salary and tax-free items'])
  })

  it('stops the salary from the first day of a year no grant binds', () => {
    const { drafts } = startingScenarios(2028, [STEADY_GRANT], null)
    expect(drafts[2]?.components).toEqual([
      { component: 'director_basis', basis: 'board-only', from: null, to: null },
      { component: 'dividend', amount: 'max', from: null, to: null },
    ])
  })
})

describe('scenarioCompany', () => {
  const workbook = steadyStudio()

  it('takes the owner pay the forecast counts back out of its profit', () => {
    const inputs = scenarioCompany(workbook, 2026, civil('2026-10-10'))
    // Salary 1,000.00 and payroll tax 200.00 for each month of 2026.
    expect(inputs.ownerPayInForecast.amount).toBe(euros(14_400))
    expect(inputs.takenFrom).toBe(2026)
    expect(inputs.profitBeforeOwnerPay.amount).toBe(subtractMoney(inputs.taxBaseInput.revenue.amount, inputs.taxBaseInput.expenses.amount))
    expect(inputs.shareCapital.amount).toBe(euros(2500))
  })

  it('takes the year after the newest booking from its own forecast, and a later year from that one', () => {
    expect(scenarioCompany(workbook, 2027, civil('2026-10-10')).takenFrom).toBe(2027)
    expect(scenarioCompany(workbook, 2028, civil('2026-10-10')).takenFrom).toBe(2027)
  })
})
