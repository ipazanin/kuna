import type { PricesFile } from '../../prices/domain/pricesFile'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { AcceptResult, AssistantOperation, CardNote, CheckedProposal, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { decimalOfText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RateBook } from '../../../../shared/money/rateBook'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import { REGIONS, countryOf } from '../../workbook/domain/mixGroup'
import type { Country } from '../../workbook/domain/mixGroup'

/** A decimal as the model writes it: text with a point and no grouping, so 1.234 never reads as a thousand in Croatian. */
export const DECIMAL: StrictSchema = { type: 'string', description: 'An exact decimal with a point and no grouping, such as 12.5.' }
export const DECIMAL_OR_NULL: StrictSchema = { type: ['string', 'null'], description: 'An exact decimal with a point and no grouping, such as 12.5, "" for none, or null to leave it.' }

/** The decimal a step names, or a refusal that says how to write one. */
/** The country or region a step names, refused with the regions when it is neither. */
export function countryOfStep(text: string, field: string): Country {
  const country = countryOf(text)
  if (country === null) throw new StepRefused(`${field} is a country code such as US, or a region: ${REGIONS.join(', ')}.`)
  return country
}

export function decimalOf(text: string, field: string): Decimal {
  const value = decimalOfText(text.trim())
  if (value === null) throw new StepRefused(`${field} is a decimal with a point and no grouping, such as 12.5.`)
  return value
}

/** The books a step of a card is planned on: the file as the card's earlier steps leave it, and the rates the dialog fills a rate from. */
export interface CardBooks {
  readonly book: InvestmentBook
  /** The ECB's rates as the prices file holds them, or null before it is read. */
  readonly rates: RateBook | null
  /** This browser's copy of the prices file, or null before it is read. */
  readonly pricesFile: PricesFile | null
  /** The settings rows as stored, a value the reader refused among them, so a step changes or clears it. */
  readonly storedSettings: readonly SettingRow[]
  /** The id a step's field names: a `$` name of an earlier step's record, or the id the ref stood for. */
  idOf(value: unknown): string
}

/** What a step leaves for the steps after it, and the holding whose prices Accept fetches. */
export interface StepWritten {
  readonly book: InvestmentBook
  /** The id of the record it made, which a later step names by the step's `$` name, or null. */
  readonly made: string | null
  /** The priced holdings the step adds or reprices, by name, whose closes Accept fetches as the holding dialog and the import do. */
  readonly fetchesPricesOf: readonly string[]
  /** Notes the card shows beside the changes, such as rows an import leaves waiting. */
  readonly notes: readonly CardNote[]
  /** What the step holds back from the write, each a sentence for the model. */
  readonly heldBack: readonly string[]
}

/** A part of the operations and how it writes one of its steps into the card's one write, through the screens' own write functions. */
export interface InvestmentSteps {
  readonly operations: readonly AssistantOperation[]
  write(unit: UnitOfWork, card: CardBooks, step: ProposalStep): StepWritten
}

/** A step that leaves the books as they were for the steps after it. */
export function unchanged(card: CardBooks): StepWritten {
  return { book: card.book, made: null, fetchesPricesOf: [], notes: [], heldBack: [] }
}

/** Operations whose card writes nothing to the books, such as an answer this device keeps or a run of the prices file. Each goes alone on its card. */
export interface SideCards {
  readonly operations: readonly AssistantOperation[]
  /** The card of the one step, on the books as read, or null while no file is open. */
  check(title: string, step: ProposalStep, book: InvestmentBook | null): Promise<CheckedProposal | { readonly refused: readonly string[] }>
  /** Accepts a card of its own, or null for any other card. */
  acceptOwn(proposal: CheckedProposal): Promise<AcceptResult> | null
}
