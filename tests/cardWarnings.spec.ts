import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { DEVICE_SETTING, cardWarnings } from '../src/shared/app/assistantOperations'
import type { AppProposer, CheckedProposal, ProposalGroup } from '../src/shared/app/assistantOperations'
import { proposeChanges } from '../src/shared/ai/application/chatProposals'
import type { ChatReads } from '../src/shared/ai/application/chatReads'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import { newPseudonyms } from '../src/shared/privacy/domain/pseudonyms'

/** A group with one warning note, one neutral note, a line that warns as a whole and a field that says where money goes. */
const WARNED: ProposalGroup = {
  verb: 'change',
  noun: DEVICE_SETTING,
  notes: [
    { label: 'Statement', text: 'Row 9 has no date, so it is skipped.', tone: 'warning' },
    { label: 'Statement', text: '2 entries are on the ledger already.', tone: 'neutral' },
  ],
  lines: [
    { label: 'Rent', fields: [{ name: 'IBAN', before: null, after: 'HR•• ••••0160', warns: true }], warning: 'The bank printed another instalment.' },
    { label: 'Phone', fields: [{ name: 'Category', before: 'Office', after: 'Phone', warns: false }], warning: null },
  ],
}

function card(groups: readonly ProposalGroup[], undoable: boolean, heldBack: string | null = null): CheckedProposal {
  return { title: 'A title', count: 2, groups, outside: [], undoable, heldBack, held: {} }
}

const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: () => true }

async function heard(checked: CheckedProposal): Promise<string> {
  const proposer: AppProposer = {
    operations: [{ name: 'change', about: '', input: { type: 'object', properties: {}, required: [], additionalProperties: false }, refs: {}, creates: null, alone: false, example: {} }],
    readsBooks: false,
    check: () => Promise.resolve(checked),
  }
  const answer = await proposeChanges({ app: 'kuna', title: 'A title', steps: [{ op: 'change', input: '{}', as: null }], next: false }, new Map([['kuna', proposer]]), reads, [], () => undefined)
  return answer.text
}

describe("a card's warnings", () => {
  it('counts each warning note, line warning and field that says where money goes, and a missing Undo', () => {
    expect(cardWarnings(card([WARNED], true))).toBe(3)
    expect(cardWarnings(card([WARNED, WARNED], false))).toBe(7)
    expect(cardWarnings(card([], true))).toBe(0)
  })

  it('reach the model as a count beside what the app holds back, for every app', async () => {
    expect(await heard(card([WARNED], false, '1 row of the statement is on the ledger already and skipped.'))).toBe(
      'The card shows 2 changes. Nothing is written until the person accepts. The card warns of 4 things. Tell the person to read the warnings before accepting. 1 row of the statement is on the ledger already and skipped. Say so in one or two short lines and stop.',
    )
    expect(await heard(card([], true))).toBe('The card shows 2 changes. Nothing is written until the person accepts. Say so in one short line and stop.')
  })

  it('are every part of an open card the card shows in the warning tone, so a new one is counted before it ships', () => {
    const source = readFileSync('src/shared/ai/presentation/ProposalCard.vue', 'utf8')
    const warningTone = [...source.matchAll(/<(?:NoteLine|UAlert)\b[^>]*?(?:tone="warning"|:color="note\.tone")[^>]*?data-testid="([^"]+)"/gs)].map((match) => match[1])
    // The warning after Accept reports a write that went, which the model never hears of as a card.
    expect(warningTone.sort()).toEqual(['chat-proposal-done-warning', 'chat-proposal-line-warning', 'chat-proposal-no-undo-note', 'chat-proposal-note', 'chat-proposal-warning'])
  })
})
