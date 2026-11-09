import type { CheckedProposal } from './assistantOperations'

export const MAKE_FILE = 'make-file'
export const REMOVE_FILE = 'remove-file'

/** What a file card holds for Accept: which of the two file steps it is. */
export interface HeldFileStep {
  readonly browserFile: typeof MAKE_FILE | typeof REMOVE_FILE
}

/** The file step a card holds, or null for any other card. */
export function heldFileStep(proposal: CheckedProposal): HeldFileStep | null {
  return 'browserFile' in proposal.held ? (proposal.held as HeldFileStep) : null
}

/** Whether the card removes the file make-file made, after which the setup does not go on by itself. */
export function removesFile(proposal: CheckedProposal): boolean {
  return heldFileStep(proposal)?.browserFile === REMOVE_FILE
}
