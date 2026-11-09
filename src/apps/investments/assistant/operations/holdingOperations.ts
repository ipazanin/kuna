import { INSTRUMENT_WRITES } from '../../holdings/application/holdingWrites'
import { TARGET_WRITES, replaceRows } from '../../holdings/application/mixWrites'
import { words as holdingsWords } from '../../holdings/presentation/words'
import { writeCheck } from '../../overview/application/checkWrites'
import { benchmarkChanges } from '../../performance/domain/benchmark'
import { words as settingsWords } from '../../settings/presentation/words'
import { CHECKS, CHECK_DEFAULTS } from '../../workbook/domain/checkSetting'
import type { CheckName } from '../../workbook/domain/checkSetting'
import { HUNDRED_PERCENT, fitsPercent } from '../../workbook/domain/investmentFields'
import { INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS } from '../../workbook/domain/investmentKinds'
import { CLASS_GROUPS, MIXES, REGIONS, SECTORS } from '../../workbook/domain/mixGroup'
import type { Mix, MixGroup } from '../../workbook/domain/mixGroup'
import type { Target } from '../../workbook/domain/target'
import { FLAG_OR_NULL, TEXT_OR_NULL, choiceOf, found, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import { sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { DECIMAL, DECIMAL_OR_NULL, countryOfStep, decimalOf, unchanged } from './investmentSteps'
import type { CardBooks, InvestmentSteps } from './investmentSteps'

/** One line of the targets as the model writes it: a group of the mix, or an account for the account mix, and its percent. */
interface TargetLine {
  readonly group: string | null
  readonly account: string | null
  readonly percent: string
}

/** The group a line names, checked against the mix: a class, a sector, a currency code, a country or region, or an account of the file. */
function groupOf(mix: Mix, line: TargetLine, card: CardBooks, at: number): MixGroup {
  const field = `targets.${at}`
  if (mix === 'account') {
    if (line.account === null) throw new StepRefused(`${field}: the account mix names an account by its ref in account, with group null.`)
    return { mix, group: found(card.book.accounts, card.idOf(line.account), 'account').id }
  }
  const text = (line.group ?? '').trim()
  switch (mix) {
    case 'class': {
      const group = choiceOf(CLASS_GROUPS, text, `${field}.group`)!
      return { mix, group }
    }
    case 'sector': {
      const group = choiceOf(SECTORS, text, `${field}.group`)!
      return { mix, group }
    }
    case 'currency': {
      const group = currencyCodeOf(text)
      if (group === null) throw new StepRefused(`${field}.group is a currency code such as USD.`)
      return { mix, group }
    }
    case 'country': {
      return { mix, group: countryOfStep(text, `${field}.group`) }
    }
  }
}

/** The targets the dialog would save, each a percent above 0 and at most 100, once for each group, adding up to 100. */
function wantedTargets(mix: Mix, lines: readonly TargetLine[], card: CardBooks): Omit<Target, 'id'>[] {
  const dialog = holdingsWords.targets.dialog
  const wanted = lines.map((line, at): Omit<Target, 'id'> => {
    const percent = decimalOf(line.percent, `targets.${at}.percent`)
    if (!fitsPercent(percent)) throw new StepRefused(`targets.${at}.percent: ${dialog.percentError}`)
    return { slice: groupOf(mix, line, card, at), percent }
  })
  const groups = wanted.map((target) => target.slice.group)
  if (new Set(groups).size !== groups.length) throw new StepRefused('Each group has one target.')
  if (sumDecimal(wanted.map((target) => target.percent)) !== HUNDRED_PERCENT) throw new StepRefused(dialog.whole)
  return wanted
}

function thresholdOf(text: string): Decimal {
  const threshold = decimalOf(text, 'threshold')
  if (!fitsPercent(threshold)) throw new StepRefused(`threshold: ${settingsWords.checks.error}`)
  return threshold
}

/** The target mix, the portfolio checks and the benchmark, as the targets dialog, the Checks tab and the benchmark card write them. */
export const HOLDING_STEPS: InvestmentSteps = {
  operations: [
    {
      name: 'set-targets',
      about: `The share of the value each group of one mix should hold, which replaces every target the file holds. mix is one of ${MIXES.join(', ')}. Each line names a group of that mix, or for the account mix an account by ref with group null, and its percent. The percents add up to 100.`,
      input: inputOf({
        mix: { type: 'string', enum: [...MIXES] },
        targets: {
          type: 'array',
          items: inputOf({
            group: {
              type: ['string', 'null'],
              description: `A class (${CLASS_GROUPS.join(', ')}), a sector (${SECTORS.join(', ')}), a currency code such as USD, or a country code such as US or a region (${REGIONS.join(', ')}). Null for the account mix.`,
            },
            account: { type: ['string', 'null'], description: 'For the account mix, the account by its ref. Null for every other mix.' },
            percent: DECIMAL,
          }),
        },
      }),
      refs: { 'targets.account': INVESTMENT_ACCOUNT_RECORDS.name },
      creates: null,
      alone: false,
      example: {
        mix: 'class',
        targets: [
          { group: 'stocks', account: null, percent: '80' },
          { group: 'cash', account: null, percent: '20' },
        ],
      },
    },
    {
      name: 'clear-targets',
      about: 'Removes every target, as Remove targets on the targets dialog does.',
      input: inputOf({}),
      refs: {},
      creates: null,
      alone: false,
      example: {},
    },
    {
      name: 'set-check',
      about: `A portfolio check's threshold, in percent of the value or in points for target-gap, and whether it is on. check is one of ${CHECKS.join(', ')}. Null leaves a field as it is. A check back at its default threshold and on keeps no record.`,
      input: inputOf({ check: { type: 'string', enum: [...CHECKS] }, threshold: DECIMAL_OR_NULL, on: FLAG_OR_NULL }),
      refs: {},
      creates: null,
      alone: false,
      example: { check: 'cash', threshold: '15', on: null },
    },
    {
      name: 'set-benchmark',
      about:
        'What Performance compares the portfolio with: an instrument by ref, held or not, or null for none. To compare with one Kuna lacks, add it with add-instrument, and once that card is accepted, set it here on a card of its own.',
      input: inputOf({ instrument: TEXT_OR_NULL }),
      refs: { instrument: INSTRUMENT_RECORDS.name },
      creates: null,
      alone: false,
      example: { instrument: 'instrument-unheld' },
    },
  ],
  write(unit, card, { operation, input }) {
    const field = input as Readonly<Record<string, unknown>>
    switch (operation) {
      case 'set-targets': {
        const mix = choiceOf(MIXES, field['mix'] as string, 'mix')!
        replaceRows(unit, TARGET_WRITES, card.book.targets, wantedTargets(mix, field['targets'] as readonly TargetLine[], card))
        return unchanged(card)
      }
      case 'clear-targets':
        if (card.book.targets.length === 0) throw new StepRefused('The file holds no targets.')
        replaceRows(unit, TARGET_WRITES, card.book.targets, [])
        return unchanged(card)
      case 'set-check': {
        const check: CheckName = choiceOf(CHECKS, field['check'] as string, 'check')!
        const held = card.book.checks.find((setting) => setting.check === check) ?? null
        const threshold = field['threshold'] === null ? (held?.threshold ?? CHECK_DEFAULTS[check]) : thresholdOf(field['threshold'] as string)
        const on = field['on'] === null ? held?.off !== true : choiceOf(['yes', 'no'], field['on'] as string, 'on') === 'yes'
        writeCheck(unit, held, check, threshold, on)
        return unchanged(card)
      }
      default: {
        if (typeof field['instrument'] === 'string' && field['instrument'].startsWith('$')) throw new StepRefused('Set the benchmark on a card after the one that adds the instrument.')
        const chosen = field['instrument'] === null ? null : found(card.book.instruments, card.idOf(field['instrument']), 'instrument').id
        const changes = benchmarkChanges(card.book.instruments, chosen)
        if (changes.length === 0) throw new StepRefused(chosen === null ? 'There is no benchmark to clear.' : 'That is the benchmark already.')
        changes.forEach((change) => unit.of(INSTRUMENT_WRITES).change(change.before, change.after))
        const after = new Map(changes.map((change) => [change.after.id, change.after]))
        return { ...unchanged(card), book: { ...card.book, instruments: card.book.instruments.map((instrument) => after.get(instrument.id) ?? instrument) } }
      }
    }
  },
}
