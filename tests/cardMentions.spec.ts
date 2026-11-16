import { describe, expect, it } from 'vitest'

import { cardsNamedIn } from '../src/apps/spending/pairing/domain/cardMentions'
import { cardsOfText } from '../src/apps/spending/workbook/domain/account'

describe('the cards a statement row names', () => {
  it.each([
    ['Top-Up by *3670', ['3670']],
    ['REVOLUT**3670*', ['3670']],
    ['Card XXXX3670 Revolut', ['3670']],
    ['xxxx 3670', ['3670']],
    ['XXXX XXXX XXXX 3670', ['3670']],
    ['5355 **** **** 3670', ['3670']],
    ['535511******3670', ['3670']],
    ['Kartica •••• 3670', ['3670']],
    ['Card ...3670', ['3670']],
    ['Card …3670', ['3670']],
    ['*3670 and *1234', ['3670', '1234']],
  ])('reads %s', (text, cards) => {
    expect([...cardsNamedIn(text)]).toEqual(cards)
  })

  it.each([['Corner market 3670'], ['Order 2026-10-14'], ['Paid 3670.00'], ['*36701'], ['*367'], ['BOX3670'], ['TAXX3670']])('reads no card in %s', (text) => {
    expect(cardsNamedIn(text).size).toBe(0)
  })
})

describe("an account's cards as typed or stored", () => {
  it('reads four digits each, separated by commas or spaces, each once', () => {
    expect(cardsOfText('3670, 1234 3670')).toEqual(['3670', '1234'])
    expect(cardsOfText('  ')).toEqual([])
  })

  it('refuses an entry that is not four digits', () => {
    expect(cardsOfText('367')).toBeNull()
    expect(cardsOfText('*3670')).toBeNull()
    expect(cardsOfText('3670, 12345')).toBeNull()
  })
})
