import type { StrictSchema } from '../ai/domain/strictSchema'
import { StepRefused } from './proposedWrites'
import { parseCivilDate } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'

export const TEXT: StrictSchema = { type: 'string' }
export const TEXT_OR_NULL: StrictSchema = { type: ['string', 'null'] }
export const NUMBER: StrictSchema = { type: 'number' }
export const NUMBER_OR_NULL: StrictSchema = { type: ['number', 'null'] }
export const FLAG_OR_NULL: StrictSchema = { type: ['string', 'null'], description: '"yes", "no", or null to leave it.' }

/** An operation's input: an object with every field required, where null leaves a field as it is. */
export function inputOf(properties: Readonly<Record<string, StrictSchema>>): StrictSchema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
}

export function dayOf(text: string): CivilDate {
  const day = parseCivilDate(text)
  if (day === null) throw new StepRefused(`${text} does not read as a day such as 2026-10-31.`)
  return day
}

/** The choice a step names, or null to keep the field, refused when it is not one of the list. */
export function choiceOf<T extends string>(choices: readonly T[], text: string | null, what: string): T | null {
  if (text === null) return null
  const choice = choices.find((candidate) => candidate === text)
  if (choice === undefined) throw new StepRefused(`${what} is one of ${choices.join(', ')}.`)
  return choice
}

/** The record by its id, as the proposal has left the books so far. */
export function found<R extends { readonly id: string }>(records: readonly R[], id: string, what: string): R {
  const record = records.find((candidate) => candidate.id === id)
  if (record === undefined) throw new StepRefused(`That ${what} is no longer in the file.`)
  return record
}

/** Why an import reads no statement off an attached photo or PDF: the model reads it and transcribes the rows. */
export const NOT_READ_OFF_A_PAGE = 'Kuna reads no statement off a photo or a PDF. Read it yourself and transcribe its rows as printed, with file null.'
