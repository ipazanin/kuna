import { describe, expect, it } from 'vitest'

import { textHolds } from '../scripts/support/flowText.mjs'

describe("a flow's text check", () => {
  it('matches the whole text it is given, last word included', () => {
    expect(textHolds('Linked until 3 May 2027', 'Linked until')).toBe(true)
    expect(textHolds('Linked until 3 May 2027', 'Linked until 4 May')).toBe(false)
    expect(textHolds('Povezano do 3. svibnja', 'Povezano od')).toBe(false)
  })

  it('reads non-breaking spaces and runs of whitespace as one space', () => {
    expect(textHolds('Total  2,32 €', 'Total 2,32 €')).toBe(true)
    expect(textHolds('Keep these\n  days as they are', 'Keep these days')).toBe(true)
  })

  it('ignores whitespace around the text it is given', () => {
    expect(textHolds('The QR code says 1234', 'The QR code says ')).toBe(true)
  })

  it('runs on its own, so a flow can send it into the page', () => {
    const inPage = new Function(`return (${textHolds.toString()})`)() as typeof textHolds
    expect(inPage('Not booked yet', 'Not booked yet')).toBe(true)
  })
})
