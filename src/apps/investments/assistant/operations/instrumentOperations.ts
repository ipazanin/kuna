import { INSTRUMENT_WRITES } from '../../holdings/application/holdingWrites'
import { FUND_MIX_WRITES, replaceRows } from '../../holdings/application/mixWrites'
import { fundMixChanges, fundMixFaults, fundMixTexts, mixLineTexts } from '../../holdings/domain/fundMixDraft'
import type { FundMix, FundMixTexts } from '../../holdings/domain/fundMixDraft'
import { instrumentFaults, instrumentOfTexts, instrumentTexts, withQuoting } from '../../holdings/domain/instrumentDraft'
import type { InstrumentTexts } from '../../holdings/domain/instrumentDraft'
import { fundMixErrors, instrumentErrors } from '../../holdings/presentation/words'
import { FUND_DISTRIBUTIONS, INSTRUMENT_CLASSES, INSTRUMENT_TYPES, NEW_INSTRUMENT_DEFAULTS, PRICE_SOURCES, QUOTING_KINDS } from '../../workbook/domain/instrument'
import type { Instrument } from '../../workbook/domain/instrument'
import { INSTRUMENT_RECORDS } from '../../workbook/domain/investmentKinds'
import { FUND_MIXES, REGIONS, SECTORS } from '../../workbook/domain/mixGroup'
import { TEXT, TEXT_OR_NULL, choiceOf, found, inputOf } from '../../../../shared/app/operationInput'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { decimalShown } from '../../../../shared/money/decimal'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { countryOfStep, decimalOf, unchanged } from './investmentSteps'
import type { CardBooks, InvestmentSteps, StepWritten } from './investmentSteps'

function choices(values: readonly string[], blank: string): StrictSchema {
  return { type: ['string', 'null'], enum: [...values, '', null], description: `One of these, ${blank}` }
}

/** One fund's lines of a mix, each a group and its percent of the fund. */
const MIX_LINES = (groups: string): StrictSchema => ({
  type: 'array',
  items: inputOf({ group: { type: 'string', description: groups }, percent: { type: 'string', description: 'Its percent of the fund with a point, such as 62.5.' } }),
  description: 'Lines that add up to 100, or an empty list for none.',
})

/** Whether a change sets the fund's mixes to the lists given or leaves them. A list cannot be null, so this says it. */
const MIX: StrictSchema = { type: 'string', enum: ['keep', 'replace'], description: 'keep leaves both mixes as they are, and replace sets both to the lists given.' }

/** The fields of an instrument a step sets. Null leaves a field as the dialog shows it, and "" clears one that may be blank. */
const INSTRUMENT_FIELDS: Readonly<Record<string, StrictSchema>> = {
  name: TEXT_OR_NULL,
  symbol: { type: ['string', 'null'], description: 'Its ticker as the broker shows it.' },
  quoted: choices(
    QUOTING_KINDS,
    'how its price reads: percent for a bond priced in percent of its nominal, which needs coupon and maturity and takes the type bond, gram for gold weighed in grams, or null to leave it.',
  ),
  coupon: { type: ['string', 'null'], description: 'A bond\'s yearly coupon in percent with a point, such as 3.5, "" for none, or null to leave it.' },
  maturity: { type: ['string', 'null'], description: 'A bond\'s maturity as YYYY-MM-DD, "" for none, or null to leave it.' },
  type: choices(INSTRUMENT_TYPES, '"" for not typed, or null to leave it.'),
  class: choices(INSTRUMENT_CLASSES, 'which only a fund or an instrument with no type takes, or null to leave it.'),
  isin: { type: ['string', 'null'], description: 'Twelve letters and digits, "" for none, or null to leave it.' },
  exchange: { type: ['string', 'null'], description: 'A market identifier code such as XETR, "" for none, or null to leave it.' },
  currency: { type: ['string', 'null'], description: 'Its quote currency such as USD, or null to leave it.' },
  prices: choices(PRICE_SOURCES, 'where its daily closes come from, manual for prices typed by hand, or null to leave it.'),
  sourceSymbol: { type: ['string', 'null'], description: 'Its symbol at the price source, "" for the ticker, or null to leave it.' },
  sector: choices(SECTORS, '"" for none, or null to leave it.'),
  country: { type: ['string', 'null'], description: `A country code such as US, or a region: ${REGIONS.join(', ')}. "" for none, or null to leave it.` },
  ter: { type: ['string', 'null'], description: 'A fund\'s yearly cost in percent with a point, such as 0.2, "" for none, or null to leave it.' },
  distribution: choices(FUND_DISTRIBUTIONS, 'for a fund only, "" for none, or null to leave it.'),
  note: TEXT_OR_NULL,
  sectors: MIX_LINES(`A sector: ${SECTORS.join(', ')}.`),
  countries: MIX_LINES(`A country code such as US, or a region: ${REGIONS.join(', ')}.`),
}

const MIX_FIELDS: Readonly<Record<FundMix, string>> = { sector: 'sectors', country: 'countries' }

/** The dialog's fields with the step's values in place of those it names. */
function textsOfStep(before: Instrument | null, field: Readonly<Record<string, unknown>>): InstrumentTexts {
  const held = instrumentTexts(before)
  const text = (name: keyof InstrumentTexts): string | null => (field[name] as string | null) ?? null
  const pick = <T extends string>(name: keyof InstrumentTexts, values: readonly T[]): T | '' | null => {
    const value = text(name)
    return value === '' ? '' : choiceOf(values, value, name)
  }
  const quoted = (pick('quoted', QUOTING_KINDS) || null) ?? held.quoted
  const texts = quoted === held.quoted ? held : withQuoting(held, quoted, before?.type ?? '')
  const ter = text('ter')
  const coupon = text('coupon')
  return {
    quoted,
    coupon: coupon === null ? texts.coupon : coupon === '' ? '' : decimalShown(decimalOf(coupon, 'coupon')),
    maturity: text('maturity') ?? texts.maturity,
    name: text('name') ?? texts.name,
    symbol: text('symbol') ?? texts.symbol,
    type: pick('type', INSTRUMENT_TYPES) ?? texts.type,
    class: (pick('class', INSTRUMENT_CLASSES) || null) ?? texts.class,
    isin: text('isin') ?? texts.isin,
    exchange: text('exchange') ?? texts.exchange,
    currency: text('currency') ?? texts.currency,
    prices: (pick('prices', PRICE_SOURCES) || null) ?? texts.prices,
    sourceSymbol: text('sourceSymbol') ?? texts.sourceSymbol,
    sector: pick('sector', SECTORS) ?? texts.sector,
    country: countryText(text('country')) ?? texts.country,
    ter: ter === null ? texts.ter : ter === '' ? '' : decimalShown(decimalOf(ter, 'ter')),
    distribution: pick('distribution', FUND_DISTRIBUTIONS) ?? texts.distribution,
    note: text('note') ?? texts.note,
  }
}

/** A country a step sets, refused when it is no country code or region, "" for none, or null to keep it. */
function countryText(text: string | null): string | null {
  return text === null || text.trim() === '' ? text : countryOfStep(text, 'country')
}

/** A mix line's group, a sector of the list or a country or region, refused with the accepted values, as the dialog's menus offer only those. A blank one is left to the dialog's own check. */
function mixGroupOf(mix: FundMix, group: string, field: string): string {
  if (group === '') return group
  return mix === 'sector' ? choiceOf(SECTORS, group, field)! : countryOfStep(group, field)
}

/** The mix lines of the dialog, or the step's lists in their place. */
function mixTextsOfStep(held: FundMixTexts, field: Readonly<Record<string, unknown>>): FundMixTexts {
  if (field['mix'] === 'keep') return held
  const of = (mix: FundMix) => {
    const lines = field[MIX_FIELDS[mix]] as readonly { readonly group: string; readonly percent: string }[]
    return lines.map((line, at) => mixLineTexts(mixGroupOf(mix, line.group.trim(), `${MIX_FIELDS[mix]}.${at}.group`), decimalShown(decimalOf(line.percent, `${MIX_FIELDS[mix]}.percent`))))
  }
  return { sector: of('sector'), country: of('country') }
}

/** Each field the dialog would mark, in the words it marks it with, named by the step's field. */
function refusals(texts: InstrumentTexts, mixTexts: FundMixTexts, others: readonly Instrument[]): string[] {
  const fields = Object.entries(instrumentErrors(instrumentFaults(texts, others))).flatMap(([name, error]) => (error === null ? [] : [`${name}: ${error}`]))
  const mixErrors = fundMixErrors(fundMixFaults(mixTexts))
  const mixes = FUND_MIXES.flatMap((mix) => {
    const lines = mixErrors.lines[mix].flatMap((line, at) => [line.group, line.percent].flatMap((error) => (error === null ? [] : [`${MIX_FIELDS[mix]}.${at}: ${error}`])))
    return mixErrors.whole[mix] === null ? lines : [...lines, `${MIX_FIELDS[mix]}: ${mixErrors.whole[mix]}`]
  })
  return [...fields, ...mixes]
}

/** Writes the instrument and its mix as the holding dialog saves them, in one write. */
function savedInstrument(unit: Parameters<InvestmentSteps['write']>[0], card: CardBooks, before: Instrument | null, field: Readonly<Record<string, unknown>>): StepWritten {
  const { book } = card
  const id: RecordId = before?.id ?? recordIdOf(INSTRUMENT_RECORDS, newRecordId())
  const others = book.instruments.filter((other) => other.id !== id)
  const heldLines = book.fundMixes.filter((line) => line.instrument === id)
  const texts = textsOfStep(before, field)
  const mixTexts = mixTextsOfStep(fundMixTexts(heldLines), field)
  const refused = refusals(texts, mixTexts, others)
  if (refused.length > 0) throw new StepRefused(refused.join(' '))
  const record = instrumentOfTexts(texts, others, id, before ?? NEW_INSTRUMENT_DEFAULTS)!
  const mixes = fundMixChanges(mixTexts, heldLines, id)!
  if (before === null) unit.of(INSTRUMENT_WRITES).add(record)
  else unit.of(INSTRUMENT_WRITES).change(before, record)
  mixes.forEach((mix) => replaceRows(unit, FUND_MIX_WRITES, mix.held, mix.wanted))
  return {
    book: before === null ? { ...book, instruments: [...book.instruments, record] } : book,
    made: before === null ? id : null,
    fetchesPricesOf: startsAPriceSeries(before, record) ? [record.name] : [],
    notes: [],
    heldBack: [],
  }
}

/** Whether Accept has closes to fetch: a priced instrument that is new, or whose source or ticker changed, since the fetch adds only series it lacks. */
function startsAPriceSeries(before: Instrument | null, record: Instrument): boolean {
  if (record.prices === 'manual') return false
  return before === null || before.prices !== record.prices || before.symbol !== record.symbol || before.sourceSymbol !== record.sourceSymbol
}

/** A new instrument's fields, where the name, ticker, currency, price source and note are needed and null leaves the rest blank as the dialog starts them. */
const NEW_FIELDS: Readonly<Record<string, StrictSchema>> = {
  ...INSTRUMENT_FIELDS,
  name: TEXT,
  symbol: { type: 'string', description: 'Its ticker as the broker shows it.' },
  currency: { type: 'string', description: 'Its quote currency such as USD.' },
  prices: { type: 'string', enum: PRICE_SOURCES, description: 'Where its daily closes come from, manual for prices typed by hand.' },
  note: TEXT,
}

/** Instruments and their own mix, as the holding dialog adds, changes and deletes them. The dialog's search at a price vendor is the person's. */
export const INSTRUMENT_STEPS: InvestmentSteps = {
  operations: [
    {
      name: 'add-instrument',
      about:
        "A new instrument, which becomes a holding once a trade buys it. prices names the vendor of its daily closes, or manual. A fund's own mix by sector and by country goes in sectors and countries. Kuna fetches a priced one's closes after Accept.",
      input: inputOf(NEW_FIELDS),
      refs: {},
      creates: INSTRUMENT_RECORDS.name,
      alone: false,
      example: {
        name: 'Example World ETF',
        symbol: 'EXW',
        quoted: 'unit',
        coupon: '',
        maturity: '',
        type: 'fund',
        class: 'stocks',
        isin: '',
        exchange: 'XETR',
        currency: 'EUR',
        prices: 'manual',
        sourceSymbol: '',
        sector: '',
        country: 'world',
        ter: '0.2',
        distribution: 'accumulating',
        note: '',
        sectors: [],
        countries: [
          { group: 'US', percent: '62.5' },
          { group: 'world', percent: '37.5' },
        ],
      },
    },
    {
      name: 'change-instrument',
      about: "Changes an instrument's facts, its price source or its own mix. Null leaves a field as it is. With mix replace, the two lists replace the fund's mix.",
      input: inputOf({ instrument: TEXT, ...INSTRUMENT_FIELDS, mix: MIX }),
      refs: { instrument: INSTRUMENT_RECORDS.name },
      creates: null,
      alone: false,
      example: {
        instrument: 'instrument-fund',
        ...Object.fromEntries(Object.keys(INSTRUMENT_FIELDS).map((name) => [name, null])),
        ter: '0.12',
        sectors: [{ group: 'financials', percent: '100' }],
        countries: [],
        mix: 'replace',
      },
    },
    {
      name: 'delete-instrument',
      about: 'Deletes an instrument with its own mix. One that a trade, income, transfer, split, spin-off or hand price names keeps them, so its deletion is refused.',
      input: inputOf({ instrument: TEXT }),
      refs: { instrument: INSTRUMENT_RECORDS.name },
      creates: null,
      alone: false,
      example: { instrument: 'instrument-unheld' },
    },
  ],
  write(unit, card, { operation, input }) {
    const field = input as Readonly<Record<string, unknown>>
    if (operation === 'add-instrument') return savedInstrument(unit, card, null, field)
    const before = found(card.book.instruments, card.idOf(field['instrument']), 'instrument')
    if (operation === 'change-instrument') return savedInstrument(unit, card, before, field)
    replaceRows(
      unit,
      FUND_MIX_WRITES,
      card.book.fundMixes.filter((line) => line.instrument === before.id),
      [],
    )
    unit.of(INSTRUMENT_WRITES).remove(before)
    return unchanged(card)
  },
}
