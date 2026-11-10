import type { ChatAttachment } from '../ai/domain/chatAttachments'
import type { StrictSchema } from '../ai/domain/strictSchema'
import { StepRefused } from './proposedWrites'
import { parseCivilDate } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'

export const TEXT: StrictSchema = { type: 'string' }
export const TEXT_OR_NULL: StrictSchema = { type: ['string', 'null'] }
export const NUMBER: StrictSchema = { type: 'number' }
export const NUMBER_OR_NULL: StrictSchema = { type: ['number', 'null'] }
export const FLAG_OR_NULL: StrictSchema = { type: ['string', 'null'], enum: ['yes', 'no', null], description: '"yes", "no", or null to leave it.' }

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

/** Why an import that names an attached file gives no rows of it: the AI reads the file and copies its rows, whatever its format. */
export const COPY_THE_FILE = 'Read the file with read_attachment and copy every row into rows as written, with file naming it.'

/** Whether a step's field holds a file attached to the chat, as an `attachment` ref resolves to. */
export function isAttachment(value: unknown): value is ChatAttachment {
  return typeof value === 'object' && value !== null && 'kind' in value && 'bytes' in value && 'original' in value
}
