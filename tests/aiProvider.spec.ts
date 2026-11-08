// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { costWords, resultLine } from '../src/shared/ai/presentation/aiProvider'
import { hr } from '../src/shared/ai/presentation/words'

describe('the lines a chat turn shows', () => {
  it('words a refusal with no explanation as a whole sentence', () => {
    expect(resultLine({ kind: 'refused', reason: '', usage: null })).toBe('The model declined this request.')
    expect(resultLine({ kind: 'refused', reason: 'Not this.', usage: null })).toBe('The model declined this request: Not this.')
  })

  it('words a request the guard stopped without saying what it found', () => {
    expect(resultLine({ kind: 'holds-secret', reason: '', usage: null })).toBe('This request holds a key or a token, so Kuna did not send it.')
  })

  it('gives what was spent, under a cent instead of rounding a small cost up, and price unknown for a model with none', () => {
    expect(costWords(0.32)).toBe('about $0.32')
    expect(costWords(0.001)).toBe('under $0.01')
    expect(costWords(null)).toBe('price unknown')
    expect(hr.usage.priceUnknown).toBe('cijena nepoznata')
  })
})
