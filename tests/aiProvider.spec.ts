// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { costWords, resultLine } from '../src/shared/ai/presentation/aiProvider'
import { hr } from '../src/shared/ai/presentation/words'

describe('the lines a chat turn shows', () => {
  it('words a refusal with no explanation as a whole sentence', () => {
    expect(resultLine({ kind: 'refused', reason: '', usage: null }, 'Anthropic')).toBe('The model declined this request.')
    expect(resultLine({ kind: 'refused', reason: 'Not this.', usage: null }, 'Anthropic')).toBe('The model declined this request: Not this.')
  })

  it('words a request the guard stopped without saying what it found', () => {
    expect(resultLine({ kind: 'holds-secret', reason: '', usage: null }, 'Anthropic')).toBe('This request holds a key or a token, so Kuna did not send it.')
  })

  it("says the account is out of credit and the key refused in plain words, never in the provider's own", () => {
    expect(resultLine({ kind: 'out-of-credit', reason: 'Your credit balance is too low to access the Anthropic API.', usage: null }, 'Anthropic')).toBe(
      'Your Anthropic account is out of credit. Add credit there, then try again. Nothing here was lost.',
    )
    expect(resultLine({ kind: 'key-refused', reason: 'invalid x-api-key', usage: null }, 'OpenAI')).toBe('OpenAI refused your key. Make a new key there and paste it in Kuna settings.')
    expect(hr.result.keyRefused('OpenAI')).toBe('Tvrtka OpenAI odbila je vaš ključ. Ondje napravite novi ključ i zalijepite ga u postavkama Kune.')
    expect(hr.result.outOfCredit('Anthropic')).toBe('Na vašem računu kod tvrtke Anthropic nema više uplaćenih sredstava. Uplatite ih ondje pa pokušajte ponovno. Ovdje se ništa nije izgubilo.')
  })

  it('gives what was spent, under a cent instead of rounding a small cost up, and price unknown for a model with none', () => {
    expect(costWords(0.32)).toBe('about $0.32')
    expect(costWords(0.001)).toBe('under $0.01')
    expect(costWords(null)).toBe('price unknown')
    expect(hr.usage.priceUnknown).toBe('cijena nepoznata')
  })
})
