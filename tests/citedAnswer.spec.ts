import { describe, expect, it } from 'vitest'

import { checkCitedAnswer, figuresIn, hasStrayFigure } from '../src/shared/ai/domain/citedAnswer'
import type { CitedInput } from '../src/shared/ai/domain/citedAnswer'
import { moneyFromCents } from '../src/shared/money/money'

const SENT: CitedInput = {
  sources: new Set(['hr.cit.rate', 'hr.vat.rates']),
  figures: new Map([
    ['f', moneyFromCents(422400)],
    ['f.0', moneyFromCents(-50000)],
  ]),
  amounts: new Set([100000]),
  rates: new Set([1200, 2500]),
}

const answer = (parts: readonly { text: string; sources?: string[]; figures?: string[] }[], ownKnowledge: string | null = null) => ({
  parts: parts.map((part) => ({ text: part.text, sources: part.sources ?? [], figures: part.figures ?? [] })),
  ownKnowledge,
})

describe('the check of a cited answer', () => {
  it('keeps a part whose sources and figures Kuna sent, with the amounts as Kuna holds them', () => {
    const checked = checkCitedAnswer(answer([{ text: 'Profit tax is taken first.', sources: ['hr.cit.rate'], figures: ['f', 'f.0'] }]), SENT, { answers: [] })
    expect(checked).toEqual({
      parts: [
        {
          text: 'Profit tax is taken first.',
          sources: ['hr.cit.rate'],
          figures: [
            { ref: 'f', cents: 422400 },
            { ref: 'f.0', cents: -50000 },
          ],
          strayFigure: false,
        },
      ],
      ownKnowledge: null,
      partlyUnchecked: false,
    })
  })

  it('drops a part that names a source or a figure ref it was not given, and marks the answer partly unchecked', () => {
    const checked = checkCitedAnswer(
      answer([
        { text: 'Kept.', sources: ['hr.vat.rates'] },
        { text: 'Dropped.', sources: ['hr.made.up'] },
        { text: 'Dropped too.', figures: ['f.9'] },
      ]),
      SENT,
      { answers: [] },
    )
    expect(checked.parts.map((part) => part.text)).toEqual(['Kept.'])
    expect(checked.partlyUnchecked).toBe(true)
  })

  it('takes a source and a figure a tool returned in this run', () => {
    const checked = checkCitedAnswer(answer([{ text: 'From the lookup, 3.000,00 EUR.', sources: ['hr.pit.local-rates'], figures: ['t.0'] }]), SENT, {
      answers: [{ text: '', sources: ['hr.pit.local-rates'], figures: [{ ref: 't.0', cents: moneyFromCents(300000) }] }],
    })
    expect(checked.parts).toHaveLength(1)
    expect(checked.parts[0]!.strayFigure).toBe(false)
  })

  it('passes €4,224.00 and 4.224,00 € when a ref holds that amount, and an amount below zero by its size', () => {
    for (const text of ['It comes to €4,224.00.', 'Iznosi 4.224,00 €.', 'It comes to 4224.00 EUR.', 'Less 500.00 paid earlier.', 'A cap of 1,000.00.']) {
      expect(checkCitedAnswer(answer([{ text }]), SENT, { answers: [] }).parts[0]!.strayFigure, text).toBe(false)
    }
  })

  it('flags €4,300.00, which no ref holds, and never corrects it', () => {
    const checked = checkCitedAnswer(answer([{ text: 'Paid later it would be €4,300.00.' }]), SENT, { answers: [] })
    expect(checked.parts[0]).toMatchObject({ text: 'Paid later it would be €4,300.00.', strayFigure: true })
    expect(hasStrayFigure(checked)).toBe(true)
  })

  it('passes 12% when a sent term holds 1,200 basis points, and flags 13%', () => {
    expect(checkCitedAnswer(answer([{ text: 'The rate is 12%.' }]), SENT, { answers: [] }).parts[0]!.strayFigure).toBe(false)
    expect(checkCitedAnswer(answer([{ text: 'Stopa je 12 %.' }]), SENT, { answers: [] }).parts[0]!.strayFigure).toBe(false)
    expect(checkCitedAnswer(answer([{ text: 'The rate is 13%.' }]), SENT, { answers: [] }).parts[0]!.strayFigure).toBe(true)
  })

  it('leaves years, days, dates and counts alone', () => {
    expect(figuresIn('In 2026, by 30.10.2026. or 2026-10-30, for 12 months and 3 employees.')).toEqual([])
  })

  it("keeps the model's own knowledge apart, with its amounts flagged the same way", () => {
    const checked = checkCitedAnswer(answer([{ text: 'Kept.', sources: ['hr.cit.rate'] }], 'Many companies pay about €2,000.00 a year for this.'), SENT, { answers: [] })
    expect(checked.ownKnowledge).toEqual({ text: 'Many companies pay about €2,000.00 a year for this.', strayFigure: true })
    expect(checked.parts[0]!.strayFigure).toBe(false)
    expect(checkCitedAnswer(answer([], '  '), SENT, { answers: [] }).ownKnowledge).toBeNull()
  })

  it.each(['4300 euros', '4300 euro', '4300 Eura', '4300 eure', '4300 eurima', 'EUR 4300', '4300 kn', '4300 USD', 'CHF 4300', '13 posto', '13 posto.', '13 percent', '13 per cent'])(
    'flags the invented %s',
    (text) => {
      expect(checkCitedAnswer(answer([{ text: `Ukupno ${text} za to.` }]), SENT, { answers: [] }).parts[0]!.strayFigure).toBe(true)
    },
  )

  it.each(['4224 euros', 'EUR 4224', '4224 Eura', '12 posto', '12 percent'])('passes %s, which Kuna sent', (text) => {
    expect(checkCitedAnswer(answer([{ text }]), SENT, { answers: [] }).parts[0]!.strayFigure).toBe(false)
  })

  it('reads no currency in an ordinary lower-case word beside a count', () => {
    expect(figuresIn('in all 12 months, try 3 times')).toEqual([])
  })

  it('reads a day and a month as neither an amount nor a figure, unless a currency says so', () => {
    expect(figuresIn('do 31.12. treba platiti, a rok je 15.01.')).toEqual([])
    expect(figuresIn('It comes to 15.01 EUR.')).toEqual([{ kind: 'amount', cents: [1501] }])
    expect(checkCitedAnswer(answer([{ text: 'It comes to 45.50.' }]), SENT, { answers: [] }).parts[0]!.strayFigure).toBe(true)
  })

  it('reads a space or a no-break space as a thousands separator', () => {
    for (const text of ['4 224,00 €', '4 224,00 €', '4 224.00 EUR']) {
      expect(checkCitedAnswer(answer([{ text }]), SENT, { answers: [] }).parts[0]!.strayFigure, text).toBe(false)
    }
    const small: CitedInput = { ...SENT, amounts: new Set([22400]) }
    expect(checkCitedAnswer(answer([{ text: '9 224,00 €' }]), small, { answers: [] }).parts[0]!.strayFigure).toBe(true)
  })

  it('reads nothing in a figure ref', () => {
    expect(figuresIn('See f.0.12 and f.1.23 for it.')).toEqual([])
  })

  it('marks a part with no source as partly unchecked when Kuna gave sources, and keeps it', () => {
    const checked = checkCitedAnswer(answer([{ text: 'This is deductible under article 58.' }]), SENT, { answers: [] })
    expect(checked.parts.map((part) => part.text)).toEqual(['This is deductible under article 58.'])
    expect(checked.partlyUnchecked).toBe(true)
  })

  it('leaves a part with no source alone when the figure rests on no rule', () => {
    const noRules: CitedInput = { ...SENT, sources: new Set() }
    expect(checkCitedAnswer(answer([{ text: 'It adds up the months.' }]), noRules, { answers: [] }).partlyUnchecked).toBe(false)
  })
})
