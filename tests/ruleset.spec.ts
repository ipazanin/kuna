import { describe, expect, it } from 'vitest'

import { addDays, parseCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { ASSET_GROUPS } from '../src/features/workbook/domain/assets'
import { ACTS } from '../src/packs/hr-doo/ruleset/acts'
import { accountingOpenItems, accountingRules } from '../src/packs/hr-doo/ruleset/rules/accounting'
import { companyLawOpenItems, companyLawRules } from '../src/packs/hr-doo/ruleset/rules/company-law'
import { ownerPayOpenItems, ownerPayRules } from '../src/packs/hr-doo/ruleset/rules/owner-pay'
import { profitTaxOpenItems, profitTaxRules } from '../src/packs/hr-doo/ruleset/rules/profit-tax'
import { vatOpenItems, vatRules } from '../src/packs/hr-doo/ruleset/rules/vat'
import {
  OPEN_ITEMS,
  RULES,
  RULESET_CHECKED_ON,
  RULESET_FIRST_DAY,
  citationOf,
  ruleValue,
  rulesFor,
  versionOn,
  watchItems,
} from '../src/packs/hr-doo/ruleset/ruleset'
import type { RuleId } from '../src/packs/hr-doo/ruleset/ruleset'
import { basisPoints, cents, count, day, flag, isWatchedConfidence, table, text } from '../src/packs/hr-doo/ruleset/schema'
import type { GeneralRule, LegalSource, OpenItem, RuleArea, RuleTerms, RuleVersion, ScalarTerm, Term } from '../src/packs/hr-doo/ruleset/schema'

const AREA_FILES: readonly { readonly area: RuleArea; readonly rules: readonly GeneralRule[]; readonly openItems: readonly OpenItem[] }[] = [
  { area: 'profit-tax', rules: profitTaxRules, openItems: profitTaxOpenItems },
  { area: 'owner-pay', rules: ownerPayRules, openItems: ownerPayOpenItems },
  { area: 'accounting', rules: accountingRules, openItems: accountingOpenItems },
  { area: 'vat', rules: vatRules, openItems: vatOpenItems },
  { area: 'company-law', rules: companyLawRules, openItems: companyLawOpenItems },
]

const AREA_BY_ID_PREFIX: readonly (readonly [string, RuleArea])[] = [
  ['hr.cit.', 'profit-tax'],
  ['hr.pit.', 'owner-pay'],
  ['hr.contrib.', 'owner-pay'],
  ['hr.minwage', 'owner-pay'],
  ['hr.acc.', 'accounting'],
  ['hr.vat.', 'vat'],
  ['hr.ztd.', 'company-law'],
  ['hr.levy.', 'company-law'],
]

const rules: readonly GeneralRule[] = RULES

const RULE_ID_PATTERN = /^hr\.[a-z]+(\.[a-z0-9]+(-[a-z0-9]+)*)?$/
const NN_ISSUE_PATTERN = /^(\d{1,3})\/(\d{2})$/

/** An income tax or contribution rule may cite ZPD only for the corporate tax rate or the add-back of private costs. */
const ZPD_CROSS_REFERENCES = new Set(['28', '7(1)(13)'])

/** The rules the year-end estimate, the forecast, the payroll and the pay scenarios read for 2025 and 2026. */
const FORECAST_RULE_IDS: readonly string[] = [
  'hr.cit.base',
  'hr.cit.pd-lines',
  'hr.cit.rate',
  'hr.cit.rate-test-revenue',
  'hr.cit.representation-add-back',
  'hr.cit.personal-transport-add-back',
  'hr.cit.depreciation-rates',
  'hr.cit.depreciation-start',
  'hr.cit.asset-threshold',
  'hr.cit.fines-add-back',
  'hr.cit.donation-cap',
  'hr.cit.sponsorship-decrease',
  'hr.cit.private-cost-add-back',
  'hr.cit.grant-revenue',
  'hr.cit.loss-carry-forward',
  'hr.cit.related-party-scope',
  'hr.cit.related-party-report',
  'hr.cit.balance-due',
  'hr.cit.monthly-advance',
  'hr.cit.advance-change',
  'hr.cit.profit-advance-shortfall',
  'hr.cit.filing',
  'hr.contrib.average-wage',
  'hr.contrib.director-floor',
  'hr.contrib.board-only-base',
  'hr.contrib.insurance-basis',
  'hr.contrib.rates',
  'hr.contrib.max-base',
  'hr.contrib.low-pay-relief',
  'hr.pit.allowance',
  'hr.pit.brackets',
  'hr.pit.local-rates',
  'hr.pit.monthly-advance',
  'hr.pit.annual-settlement',
  'hr.pit.youth-relief',
  'hr.pit.nontaxable-caps',
  'hr.pit.foreign-per-diem',
  'hr.pit.loan-benefit',
  'hr.pit.rent',
  'hr.pit.dividend',
  'hr.pit.hidden-distribution',
  'hr.vat.rates',
  'hr.vat.input-deduction',
  'hr.vat.deadlines',
  'hr.vat.credit',
  'hr.acc.accrual-basis',
  'hr.acc.capitalisation',
  'hr.acc.grant-recognition',
  'hr.ztd.min-share-capital',
  'hr.ztd.reserves',
  'hr.ztd.distributable-profit',
  'hr.ztd.withhold-on-deterioration',
  'hr.ztd.capital-protection',
  'hr.ztd.members-decision-deadline',
  'hr.ztd.asset-purchase-decision',
  'hr.ztd.sole-member-deals',
]

const exampleSource: LegalSource = {
  act: 'ZPD',
  nn: ['114/23'],
  article: '28',
  url: 'https://www.zakon.hr/z/99/zakon-o-porezu-na-dobit',
  loadedOn: day('2026-10-18'),
}

const earlyVersion: RuleVersion<RuleTerms> = {
  validFrom: day('2025-01-01'),
  validTo: day('2025-02-28'),
  value: { rate: basisPoints(1000) },
  sources: [exampleSource],
  confidence: 'confirmed-nn',
}

const changedVersion: RuleVersion<RuleTerms> = {
  validFrom: day('2025-03-01'),
  validTo: day('2026-12-31'),
  value: { rate: basisPoints(1200) },
  sources: [exampleSource],
  confidence: 'confirmed-consolidated',
}

const estimateVersion: RuleVersion<RuleTerms> = {
  validFrom: day('2027-01-01'),
  validTo: day('2027-12-31'),
  value: { rate: basisPoints(1250) },
  sources: [exampleSource],
  confidence: 'estimate',
  note: 'Until the 2027 decision is published in December 2026.',
}

const exampleRule: GeneralRule = {
  id: 'hr.cit.example-rate',
  area: 'profit-tax',
  title: 'Example rate',
  appliesBy: 'tax-period',
  versions: [earlyVersion, changedVersion, estimateVersion],
}

const exampleOpenItem: OpenItem = {
  id: 'hr.cit.example-draft',
  area: 'profit-tax',
  title: 'Example draft',
  status: 'pending',
  note: 'A draft in consultation, recheck when it is enacted.',
  url: null,
}

function areaOfId(id: string): RuleArea | null {
  return AREA_BY_ID_PREFIX.find(([prefix]) => id.startsWith(prefix))?.[1] ?? null
}

function isCivilDate(candidate: string): boolean {
  return parseCivilDate(candidate) === candidate
}

/** Orders NN issues: `151/25` is issue 151 of 2025, and years from 90 are in the 1900s. */
function issueOrder(issue: string): number {
  const match = NN_ISSUE_PATTERN.exec(issue)
  if (match === null) {
    return Number.NaN
  }
  const shortYear = Number(match[2])
  const year = shortYear >= 90 ? 1900 + shortYear : 2000 + shortYear
  return year * 1000 + Number(match[1])
}

function daysOf(firstDay: CivilDate, lastDay: CivilDate): CivilDate[] {
  const days: CivilDate[] = []
  for (let current = firstDay; current <= lastDay; current = addDays(current, 1)) {
    days.push(current)
  }
  return days
}

function scalarProblems(where: string, term: ScalarTerm): string[] {
  switch (term.kind) {
    case 'rate':
      return Number.isInteger(term.basisPoints) && term.basisPoints >= 0 ? [] : [`${where}: ${term.basisPoints} is not whole basis points`]
    case 'money':
      return Number.isInteger(term.cents) ? [] : [`${where}: ${term.cents} is not whole cents`]
    case 'count':
      return Number.isInteger(term.count) ? [] : [`${where}: ${term.count} is not a whole number`]
    case 'flag':
      return typeof term.holds === 'boolean' ? [] : [`${where}: a flag that is not true or false`]
    case 'text':
      return typeof term.text === 'string' && term.text.trim() !== '' ? [] : [`${where}: empty text`]
    default:
      return [`${where}: unknown term ${JSON.stringify(term)}`]
  }
}

function termProblems(where: string, term: Term): string[] {
  if (term.kind !== 'table') {
    return scalarProblems(where, term)
  }
  if (term.rows.length === 0) {
    return [`${where}: a table without rows`]
  }
  return term.rows.flatMap((row, rowIndex) => {
    const cells = Object.entries(row)
    if (cells.length === 0) {
      return [`${where} row ${rowIndex + 1}: no cells`]
    }
    return cells.flatMap(([column, cell]) => scalarProblems(`${where} row ${rowIndex + 1} ${column}`, cell))
  })
}

function sourceProblems(where: string, source: LegalSource): string[] {
  const problems: string[] = []
  if (!Object.hasOwn(ACTS, source.act)) {
    return [`${where}: act ${source.act} is not in the registry`]
  }
  const act = ACTS[source.act]
  if (source.nn.length === 0) {
    problems.push(`${where}: no NN issue`)
  }
  for (const issue of source.nn) {
    if (!NN_ISSUE_PATTERN.test(issue)) {
      problems.push(`${where}: NN issue ${issue} is not written as number/yy`)
    } else if (act.nnComplete && !act.nn.includes(issue)) {
      problems.push(`${where}: ${source.act} has no NN issue ${issue}`)
    } else if (!act.nnComplete) {
      const first = act.nn[0]
      const last = act.nn[act.nn.length - 1]
      if (first === undefined || last === undefined) {
        problems.push(`${where}: ${source.act} was never loaded, so it cannot be a source`)
      } else if (issueOrder(issue) < issueOrder(first) || issueOrder(issue) > issueOrder(last)) {
        problems.push(`${where}: NN issue ${issue} is outside the listed history of ${source.act}`)
      }
    }
  }
  if (source.article.trim() === '') {
    problems.push(`${where}: no article`)
  } else if (source.article.startsWith('Art')) {
    problems.push(`${where}: write the article without the Art. prefix`)
  }
  if (source.ofAmendingAct === true && source.nn.length !== 1) {
    problems.push(`${where}: an article of an amending act names that one NN issue`)
  }
  if (!source.url.startsWith('https://')) {
    problems.push(`${where}: the URL ${source.url} is not an https page`)
  }
  if (!isCivilDate(source.loadedOn)) {
    problems.push(`${where}: load date ${source.loadedOn} is not a date`)
  } else if (source.loadedOn > RULESET_CHECKED_ON) {
    problems.push(`${where}: loaded on ${source.loadedOn}, after the ruleset was checked`)
  }
  if (source.quote !== undefined && source.quote.trim() === '') {
    problems.push(`${where}: an empty quote`)
  }
  return problems
}

describe('the act registry', () => {
  it('keys every act by its own id, with a title and NN issues in order', () => {
    const problems: string[] = []
    for (const [key, act] of Object.entries(ACTS)) {
      if (act.id !== key) {
        problems.push(`${key}: carries the id ${act.id}`)
      }
      if (act.title.trim() === '') {
        problems.push(`${key}: no title`)
      }
      if (act.nn.length === 0 && act.nnComplete) {
        problems.push(`${key}: an empty history cannot be complete`)
      }
      if (act.textUrl !== null && !act.textUrl.startsWith('https://')) {
        problems.push(`${key}: the text URL is not an https page`)
      }
      act.nn.forEach((issue, index) => {
        if (!NN_ISSUE_PATTERN.test(issue)) {
          problems.push(`${key}: NN issue ${issue} is not written as number/yy`)
        }
        const previous = act.nn[index - 1]
        if (previous !== undefined && issueOrder(previous) >= issueOrder(issue)) {
          problems.push(`${key}: ${previous} is listed before ${issue}`)
        }
      })
    }
    expect(problems).toEqual([])
  })
})

describe('the ruleset data', () => {
  it('composes every area file', () => {
    expect(rules).toEqual(AREA_FILES.flatMap((file) => file.rules))
    expect(OPEN_ITEMS).toEqual(AREA_FILES.flatMap((file) => file.openItems))
  })

  it('gives every rule and open item a unique id', () => {
    const ids = [...rules.map((rule) => rule.id), ...OPEN_ITEMS.map((item) => item.id)]
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index)
    expect(repeated).toEqual([])
  })

  it('keeps every id in the file of its area', () => {
    const problems: string[] = []
    for (const file of AREA_FILES) {
      for (const entry of [...file.rules, ...file.openItems]) {
        if (!RULE_ID_PATTERN.test(entry.id)) {
          problems.push(`${entry.id}: not written as hr.<area>.<name>`)
        }
        if (entry.area !== file.area) {
          problems.push(`${entry.id}: area ${entry.area} in the ${file.area} file`)
        }
        if (areaOfId(entry.id) !== file.area) {
          problems.push(`${entry.id}: its prefix does not belong in the ${file.area} file`)
        }
        if (entry.title.trim() === '') {
          problems.push(`${entry.id}: no title`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('runs every rule as contiguous versions with no overlap, from the first day the ruleset models', () => {
    const problems: string[] = []
    for (const rule of rules) {
      if (rule.versions.length === 0) {
        problems.push(`${rule.id}: no version`)
      }
      rule.versions.forEach((version, index) => {
        const where = `${rule.id} version ${index + 1}`
        if (!isCivilDate(version.validFrom)) {
          problems.push(`${where}: valid from ${version.validFrom} is not a date`)
        }
        if (version.validTo !== null && !isCivilDate(version.validTo)) {
          problems.push(`${where}: valid to ${version.validTo} is not a date`)
        }
        if (version.validTo !== null && version.validTo < version.validFrom) {
          problems.push(`${where}: ends before it starts`)
        }
        if (index === 0 && version.validFrom < RULESET_FIRST_DAY) {
          problems.push(`${where}: starts before ${RULESET_FIRST_DAY}`)
        }
        const previous = rule.versions[index - 1]
        if (previous !== undefined) {
          if (previous.validTo === null) {
            problems.push(`${where}: follows an open-ended version`)
          } else if (version.validFrom !== addDays(previous.validTo, 1)) {
            problems.push(`${where}: starts ${version.validFrom}, not the day after ${previous.validTo}`)
          }
        }
      })
    }
    expect(problems).toEqual([])
  })

  it('gives every version at least one complete source from the registry', () => {
    const problems: string[] = []
    for (const rule of rules) {
      rule.versions.forEach((version, index) => {
        const where = `${rule.id} version ${index + 1}`
        if (version.sources.length === 0) {
          problems.push(`${where}: no source`)
        }
        version.sources.forEach((source, sourceIndex) => {
          problems.push(...sourceProblems(`${where} source ${sourceIndex + 1}`, source))
        })
      })
    }
    expect(problems).toEqual([])
  })

  it('cites ZPD in no income tax or contribution rule, other than its cross-references', () => {
    const problems: string[] = []
    for (const rule of rules.filter((candidate) => candidate.id.startsWith('hr.pit.') || candidate.id.startsWith('hr.contrib.'))) {
      for (const version of rule.versions) {
        for (const source of version.sources) {
          if (source.act === 'ZPD' && !ZPD_CROSS_REFERENCES.has(source.article)) {
            problems.push(`${rule.id} cites ZPD Art. ${source.article}. The income tax act is ZPDoh`)
          }
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('writes every value with whole units and the same terms in every version', () => {
    const problems: string[] = []
    for (const rule of rules) {
      const firstTerms = Object.keys(rule.versions[0]?.value ?? {}).sort()
      rule.versions.forEach((version, index) => {
        const where = `${rule.id} version ${index + 1}`
        const terms = Object.entries(version.value)
        if (terms.length === 0) {
          problems.push(`${where}: no terms`)
        }
        if (JSON.stringify(terms.map(([name]) => name).sort()) !== JSON.stringify(firstTerms)) {
          problems.push(`${where}: its terms differ from the first version`)
        }
        for (const [name, term] of terms) {
          problems.push(...termProblems(`${where} ${name}`, term))
        }
      })
    }
    expect(problems).toEqual([])
  })

  it('covers every day of 2025 and 2026 for each rule the forecast reads', () => {
    const problems: string[] = []
    const forecastDays = daysOf(day('2025-01-01'), day('2026-12-31'))
    for (const id of FORECAST_RULE_IDS) {
      const area = areaOfId(id)
      const areaFile = AREA_FILES.find((file) => file.area === area)
      const rule = rules.find((candidate) => candidate.id === id)
      if (rule === undefined) {
        if (areaFile !== undefined && areaFile.rules.length > 0) {
          problems.push(`${id}: missing from the ${areaFile.area} file`)
        }
        continue
      }
      const uncovered = forecastDays.filter(
        (forecastDay) =>
          rule.versions.filter(
            (version) => version.validFrom <= forecastDay && (version.validTo === null || forecastDay <= version.validTo),
          ).length !== 1,
      )
      if (uncovered.length > 0) {
        problems.push(`${id}: ${uncovered.length} days of 2025 and 2026 without exactly one version, the first ${uncovered[0]}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('lists every estimate, pending or unconfirmed version, and every open item, as a watch item with a note', () => {
    const watched = watchItems()
    const problems: string[] = []
    for (const rule of rules) {
      rule.versions.forEach((version, index) => {
        if (!isWatchedConfidence(version.confidence)) {
          return
        }
        const where = `${rule.id} version ${index + 1}`
        if (version.note === undefined || version.note.trim() === '') {
          problems.push(`${where}: ${version.confidence} without a note saying what would settle it`)
        }
        if (!watched.some((item) => item.kind === 'version' && item.rule.id === rule.id && item.version === version)) {
          problems.push(`${where}: missing from the watch list`)
        }
      })
    }
    for (const item of OPEN_ITEMS) {
      if (item.note.trim() === '') {
        problems.push(`${item.id}: an open item without a note`)
      }
      if (item.url !== null && !item.url.startsWith('https://')) {
        problems.push(`${item.id}: the URL is not an https page`)
      }
      if (!watched.some((watchItem) => watchItem.kind === 'open' && watchItem.item === item)) {
        problems.push(`${item.id}: missing from the watch list`)
      }
    }
    expect(problems).toEqual([])
  })

  it('finds every version by ruleValue on its first and last day', () => {
    const problems: string[] = []
    for (const rule of rules) {
      for (const version of rule.versions) {
        for (const on of [version.validFrom, version.validTo ?? version.validFrom]) {
          const lookup = ruleValue(rule.id as RuleId, on)
          if (lookup.version !== version) {
            problems.push(`${rule.id} on ${on}: found another version`)
          }
        }
      }
    }
    expect(problems).toEqual([])
  })
})

describe('the values derived from other values', () => {
  const MODELLED_YEARS = [2025, 2026, 2027]

  function shareOf(amount: number, coefficient: number): number {
    return Math.round((amount * coefficient) / 10_000)
  }

  it('publishes every contribution base as its coefficient times the average wage of the year', () => {
    const problems: string[] = []
    for (const year of MODELLED_YEARS) {
      const midYear = day(`${year}-06-30`)
      const averageWage = ruleValue('hr.contrib.average-wage', midYear).value.monthlyAmount.cents
      const floor = ruleValue('hr.contrib.director-floor', midYear).value
      const boardOnly = ruleValue('hr.contrib.board-only-base', midYear).value
      const maximum = ruleValue('hr.contrib.max-base', midYear).value
      const minimum = ruleValue('hr.contrib.minimum-base', midYear).value
      const derived: readonly (readonly [string, number, number])[] = [
        ['director floor', floor.monthlyFloor.cents, shareOf(averageWage, floor.coefficient.basisPoints)],
        ['board-only base', boardOnly.monthlyBase.cents, shareOf(averageWage, boardOnly.coefficient.basisPoints)],
        ['monthly maximum', maximum.monthlyMaximum.cents, shareOf(averageWage, maximum.coefficient.basisPoints)],
        ['annual maximum', maximum.annualMaximum.cents, 12 * maximum.monthlyMaximum.cents],
        ['minimum base', minimum.monthlyBase.cents, shareOf(averageWage, minimum.coefficient.basisPoints)],
      ]
      for (const [what, stored, expected] of derived) {
        if (stored !== expected) {
          problems.push(`${year} ${what}: ${stored} cents, but the coefficient gives ${expected}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('bands the youth relief by age in the tax year: 100% up to 25, 50% from 26 to 30', () => {
    const problems: string[] = []
    for (const year of MODELLED_YEARS) {
      const bands = ruleValue('hr.pit.youth-relief', day(`${year}-12-31`)).value.bands.rows
      const full = bands.find((band) => band.reliefShare.basisPoints === 10_000)
      const half = bands.find((band) => band.reliefShare.basisPoints === 5000)
      if (bands.length !== 2 || full === undefined || half === undefined) {
        problems.push(`${year}: expected one 100% band and one 50% band`)
        continue
      }
      if (full.bornFrom.count !== year - 25 || full.bornTo !== undefined) {
        problems.push(`${year}: the 100% band starts at ${full.bornFrom.count}, not ${year - 25} and later`)
      }
      if (half.bornFrom.count !== year - 30 || half.bornTo?.count !== year - 26) {
        problems.push(`${year}: the 50% band is ${half.bornFrom.count} to ${half.bornTo?.count}, not ${year - 30} to ${year - 26}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('keeps the Split rates inside the range for a county seat once the transitional rule has run', () => {
    const localRates = rules.find((rule) => rule.id === 'hr.pit.local-rates')
    const problems: string[] = []
    for (const version of localRates?.versions ?? []) {
      if (version.validFrom < day('2025-03-01')) {
        continue
      }
      const split = ruleValue('hr.pit.local-rates', version.validFrom).value.cityRates.rows.find((row) => row.city.text === 'Split')
      const range = ruleValue('hr.pit.local-rate-ranges', version.validFrom).value.ranges.rows.find(
        (row) => row.unitType.text === 'large-town-or-county-seat',
      )
      if (split === undefined || range === undefined) {
        problems.push(`${version.validFrom}: no Split row or no county seat range`)
        continue
      }
      const lower = split.lowerRate.basisPoints
      const higher = split.higherRate.basisPoints
      if (lower < range.lowerRateFrom.basisPoints || lower > range.lowerRateTo.basisPoints) {
        problems.push(`${version.validFrom}: lower rate ${lower} is outside the range`)
      }
      if (higher < range.higherRateFrom.basisPoints || higher > range.higherRateTo.basisPoints) {
        problems.push(`${version.validFrom}: higher rate ${higher} is outside the range`)
      }
    }
    expect(localRates?.versions.length).toBeGreaterThan(1)
    expect(problems).toEqual([])
  })

  it('names the depreciation groups the way the assets tab does', () => {
    const groups = ruleValue('hr.cit.depreciation-rates', day('2025-01-01')).value.groups.rows.map((row) => row.group.text)

    expect([...groups].sort()).toEqual([...ASSET_GROUPS].sort())
  })
})

describe('ruleValue', () => {
  it('refuses an id the ruleset does not hold', () => {
    expect(() => ruleValue('hr.cit.not-a-rule' as RuleId, day('2026-01-01'))).toThrow('The ruleset has no rule hr.cit.not-a-rule.')
  })
})

describe('versionOn', () => {
  it('picks the version in force on the day, both boundaries included', () => {
    expect(versionOn(exampleRule, day('2025-02-28')).value).toEqual({ rate: basisPoints(1000) })
    expect(versionOn(exampleRule, day('2025-03-01')).value).toEqual({ rate: basisPoints(1200) })
    expect(versionOn(exampleRule, day('2027-12-31')).value).toEqual({ rate: basisPoints(1250) })
  })

  it('refuses a day before the first version or after the last one ends', () => {
    expect(() => versionOn(exampleRule, day('2024-12-31'))).toThrow('hr.cit.example-rate has no version in force on 2024-12-31.')
    expect(() => versionOn(exampleRule, day('2028-01-01'))).toThrow('hr.cit.example-rate has no version in force on 2028-01-01.')
  })

  it('keeps an open-ended version in force on any later day', () => {
    const openEnded: GeneralRule = { ...exampleRule, versions: [{ ...earlyVersion, validTo: null }] }
    expect(versionOn(openEnded, day('2040-06-30')).value).toEqual({ rate: basisPoints(1000) })
  })
})

describe('citationOf', () => {
  it('names the rule, the version dates, its sources and its confidence', () => {
    const version = versionOn(exampleRule, day('2027-06-30'))
    expect(citationOf(exampleRule, version)).toEqual({
      ruleId: 'hr.cit.example-rate',
      validFrom: day('2027-01-01'),
      validTo: day('2027-12-31'),
      sources: [exampleSource],
      confidence: 'estimate',
    })
  })
})

describe('rulesFor', () => {
  it('gives both versions of a year whose value changes during it', () => {
    const [inForce] = rulesFor(2025, [exampleRule])
    expect(inForce?.rule).toBe(exampleRule)
    expect(inForce?.versions.map((version) => version.validFrom)).toEqual([day('2025-01-01'), day('2025-03-01')])
  })

  it('gives the one version that covers a whole year', () => {
    expect(rulesFor(2027, [exampleRule])[0]?.versions.map((version) => version.validFrom)).toEqual([day('2027-01-01')])
  })

  it('leaves out a rule with no version in the year', () => {
    const laterRule: GeneralRule = { ...exampleRule, id: 'hr.cit.example-later', versions: [estimateVersion] }
    expect(rulesFor(2025, [exampleRule, laterRule]).map((inForce) => inForce.rule.id)).toEqual(['hr.cit.example-rate'])
  })

  it('refuses a year no rule reaches, and a number that is not a year', () => {
    expect(() => rulesFor(2024, [exampleRule])).toThrow('The ruleset has no rule in force in 2024.')
    expect(() => rulesFor(2025.5, [exampleRule])).toThrow('2025.5 is not a year.')
  })
})

describe('watchItems', () => {
  it('lists the watched versions, then the open items', () => {
    expect(watchItems([exampleRule], [exampleOpenItem])).toEqual([
      { kind: 'version', rule: exampleRule, version: estimateVersion },
      { kind: 'open', item: exampleOpenItem },
    ])
  })
})

describe('the term constructors', () => {
  it('build each kind of term', () => {
    expect(basisPoints(1650)).toEqual({ kind: 'rate', basisPoints: 1650 })
    expect(cents(100_000_000)).toEqual({ kind: 'money', cents: 100_000_000 })
    expect(count(12)).toEqual({ kind: 'count', count: 12 })
    expect(flag(false)).toEqual({ kind: 'flag', holds: false })
    expect(text('computers')).toEqual({ kind: 'text', text: 'computers' })
    expect(table([{ group: text('computers'), rate: basisPoints(5000) }]).rows).toHaveLength(1)
  })

  it('refuse a fraction of a unit, an empty text, an empty table and a day that does not exist', () => {
    expect(() => basisPoints(16.5)).toThrow(RangeError)
    expect(() => basisPoints(-100)).toThrow(RangeError)
    expect(() => cents(0.5)).toThrow(RangeError)
    expect(() => count(1.5)).toThrow(RangeError)
    expect(() => text(' ')).toThrow(RangeError)
    expect(() => table([])).toThrow(RangeError)
    expect(() => day('2025-02-29')).toThrow('2025-02-29 is not a calendar day.')
  })
})
