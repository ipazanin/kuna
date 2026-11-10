import { expect } from 'vitest'

import type { CheckedProposal } from '../../src/shared/app/assistantOperations'
import type { RuledChange } from '../../src/shared/storage/application/recordWrites'

/**
 * Expects the card's groups to count what it writes: every group at most as many lines as the changes of its verb and kind, since a
 * change that shows nothing stays off, and the lines together as many as the card's change count, so a note never counts as a record.
 */
export function expectCountsOfChanges(card: CheckedProposal): void {
  expect(card.groups.reduce((sum, group) => sum + group.lines.length, 0)).toBe(card.count)
  const changes = (card.held as { readonly changes?: readonly RuledChange[] }).changes
  if (changes === undefined) return
  for (const group of card.groups) {
    const ofGroup = changes.filter(({ change }) => {
      const verb = change.verb === 'repair' ? 'change' : change.verb === 'discard' ? 'remove' : change.verb
      return verb === group.verb && change.kind.noun === group.noun
    })
    expect(group.lines.length).toBeLessThanOrEqual(ofGroup.length)
  }
}
