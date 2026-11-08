import { beforeEach, describe, expect, it } from 'vitest'

import { spendingAssistant } from '../src/apps/spending/assistant/spendingAssistant'
import { REVIEW_ASKED, waitingRowAsked } from '../src/apps/spending/statements/presentation/reviewAsks'
import { chatElement, closeChat, removeChatElement, useChatElement } from '../src/shared/ai/presentation/chatDock'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { CHAT_READING } from './fixtures/chatBook'

const ROW = { id: recordIdOf(TRANSACTION_RECORDS, 'made-up-waiting'), date: parseCivilDate('2026-11-03')!, payee: 'Ana Horvat', amount: -4250 }

beforeEach(() => {
  closeChat()
  removeChatElement()
})

describe("asking the chat from Spending's To review", () => {
  it('asks about the queue as a place the chat can link', () => {
    const places = spendingAssistant(CHAT_READING).places.map((place) => place.route)

    expect(REVIEW_ASKED.about).toMatchObject({ kind: 'place', app: 'spending' })
    expect(places).toContain(REVIEW_ASKED.about.kind === 'place' ? REVIEW_ASKED.about.route : null)
  })

  it('asks about a waiting row as its record, named by day and account, never by its payee or amount', () => {
    const asked = waitingRowAsked(ROW, { name: 'Current' })

    expect(asked.about).toEqual({ kind: 'record', app: 'spending', recordKind: TRANSACTION_RECORDS.name, id: ROW.id })
    expect(asked.label).toContain('Current')
    expect(asked.label).not.toContain('Ana')
    expect(asked.label).not.toMatch(/42/)
  })

  it('marks only the row asked about with the row shape, and the queue with the card shape', () => {
    const queue = useChatElement(REVIEW_ASKED, 'card')
    const row = useChatElement(waitingRowAsked(ROW, { name: 'Current' }), 'row')
    const other = useChatElement(waitingRowAsked({ ...ROW, id: recordIdOf(TRANSACTION_RECORDS, 'made-up-other') }, { name: 'Current' }), 'row')

    row.ask()
    expect([queue.marked.value, row.marked.value, other.marked.value]).toEqual([{}, { 'data-chat-tagged': 'row' }, {}])
    queue.ask()
    expect([queue.marked.value, row.marked.value]).toEqual([{ 'data-chat-tagged': 'card' }, {}])
    expect(chatElement.value?.key).toBe(REVIEW_ASKED.key)
  })
})
