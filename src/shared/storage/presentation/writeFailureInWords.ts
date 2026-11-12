import { GoogleApiError, GoogleTimedOut } from '../../google/googleApi'
import { words } from './words'

/** A refusal from Drive, a request that never reached it or one it did not answer in time, whose own text is no use to a person. */
export function failedOnDrive(failure: unknown): boolean {
  return failure instanceof GoogleApiError || failure instanceof TypeError || failure instanceof GoogleTimedOut
}

/** Why a write or an undo did not go, in words a person can act on: a Drive failure as one plain sentence, and anything else by its own text. */
export function writeFailureInWords(failure: unknown): string {
  if (failedOnDrive(failure)) return words.driveFailed
  return failure instanceof Error ? failure.message : String(failure)
}
