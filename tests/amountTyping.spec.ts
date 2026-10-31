import { describe, expect, it, vi } from 'vitest'

import { amountShown, amountTyped, finishedAmount } from '../src/shared/money/amountTyping'
import type { AmountEdit } from '../src/shared/money/amountTyping'
import { typedAmount } from '../src/shared/money/typedAmount'

type Typing = typeof amountTyped

/** Types each key at the caret, as a keyboard does, from an empty field or the edit given. */
function keys(typing: Typing, sequence: string, from: AmountEdit = { text: '', caret: 0 }): AmountEdit {
  return [...sequence].reduce((field, key) => typing(field.text, `${field.text.slice(0, field.caret)}${key}${field.text.slice(field.caret)}`, field.caret + 1), from)
}

function backspace(typing: Typing, field: AmountEdit): AmountEdit {
  return typing(field.text, `${field.text.slice(0, field.caret - 1)}${field.text.slice(field.caret)}`, field.caret - 1)
}

function forwardDelete(typing: Typing, field: AmountEdit): AmountEdit {
  return typing(field.text, `${field.text.slice(0, field.caret)}${field.text.slice(field.caret + 1)}`, field.caret, true)
}

/** Pastes over the whole field, as after select all. */
function paste(typing: Typing, text: string): string {
  return typing('', text, text.length).text
}

describe('amountTyped', () => {
  it('groups thousands with commas while the amount is typed', () => {
    expect(keys(amountTyped, '1500')).toEqual({ text: '1,500', caret: 5 })
    expect(keys(amountTyped, '1234567.8')).toEqual({ text: '1,234,567.8', caret: 11 })
    expect(keys(amountTyped, '999')).toEqual({ text: '999', caret: 3 })
  })

  it('takes a point as the decimal mark', () => {
    expect(keys(amountTyped, '12.5').text).toBe('12.5')
    expect(keys(amountTyped, '12.50').text).toBe('12.50')
  })

  it('shows a comma typed after a number as typed and reads it as a group mark once a third digit follows it', () => {
    expect(keys(amountTyped, '1,5')).toEqual({ text: '1,5', caret: 3 })
    expect(keys(amountTyped, '1,50').text).toBe('1,50')
    expect(keys(amountTyped, '1,500').text).toBe('1,500')
    expect(keys(amountTyped, '1,234,567').text).toBe('1,234,567')
    expect(keys(amountTyped, '1234,500').text).toBe('1,234,500')
    expect(typedAmount(keys(amountTyped, '1,5').text)).toBe(150)
  })

  it('refuses a third digit after the decimal mark, as typedAmount refuses 12.345', () => {
    expect(keys(amountTyped, '1.500').text).toBe('1.50')
    expect(keys(amountTyped, '7', { text: '1,234.56', caret: 8 })).toEqual({ text: '1,234.56', caret: 8 })
    expect(keys(amountTyped, '7', { text: '1,234.56', caret: 7 })).toEqual({ text: '1,234.56', caret: 7 })
    expect(keys(amountTyped, '.', { text: '12,345', caret: 2 })).toEqual({ text: '12,345', caret: 2 })
  })

  it('reads a k after a decimal mark with two digits at most', () => {
    expect(keys(amountTyped, '1.255m').text).toBe('1,250,000')
    expect(keys(amountTyped, '2.375k').text).toBe('2,370')
    expect(keys(amountTyped, '1,255m').text).toBe('1,255,000,000')
  })

  it('expands a k or an m typed after a number at once, with the caret at the end', () => {
    expect(keys(amountTyped, '3k')).toEqual({ text: '3,000', caret: 5 })
    expect(keys(amountTyped, '3m')).toEqual({ text: '3,000,000', caret: 9 })
    expect(keys(amountTyped, '0.2k').text).toBe('200')
    expect(keys(amountTyped, '1.5k').text).toBe('1,500')
    expect(keys(amountTyped, '1,5k').text).toBe('1,500')
    expect(keys(amountTyped, '0.05k').text).toBe('50')
    expect(keys(amountTyped, '12.k').text).toBe('12,000')
    expect(keys(amountTyped, '3K').text).toBe('3,000')
    expect(keys(amountTyped, '1.5M').text).toBe('1,500,000')
  })

  it('multiplies again for a second k', () => {
    expect(keys(amountTyped, '3kk').text).toBe('3,000,000')
    expect(keys(amountTyped, '2km').text).toBe('2,000,000,000')
  })

  it('multiplies the whole amount when a k is typed inside it', () => {
    expect(keys(amountTyped, 'k', { text: '1,234', caret: 2 })).toEqual({ text: '1,234,000', caret: 9 })
  })

  it('drops a k or an m with no number before it', () => {
    expect(keys(amountTyped, 'k')).toEqual({ text: '', caret: 0 })
    expect(keys(amountTyped, 'mk5').text).toBe('5')
  })

  it('drops a minus, a plus, spaces and letters, since the field holds zero or more', () => {
    expect(keys(amountTyped, '-12').text).toBe('12')
    expect(keys(amountTyped, '+1 2a').text).toBe('12')
    expect(keys(amountTyped, '1', { text: '12', caret: 0 })).toEqual({ text: '112', caret: 1 })
    expect(keys(amountTyped, 'x', { text: '1,234', caret: 2 })).toEqual({ text: '1,234', caret: 1 })
  })

  it('keeps one decimal mark, so a second one typed is dropped', () => {
    expect(keys(amountTyped, '1.5.').text).toBe('1.5')
    expect(keys(amountTyped, '1.5,2').text).toBe('1.52')
    expect(keys(amountTyped, '1,5.2').text).toBe('1,52')
  })

  it('writes a zero before a decimal mark typed first and drops leading zeros', () => {
    expect(keys(amountTyped, '.5').text).toBe('0.5')
    expect(keys(amountTyped, '007').text).toBe('7')
    expect(keys(amountTyped, '0.05').text).toBe('0.05')
    expect(keys(amountTyped, '0').text).toBe('0')
  })

  it('keeps the caret beside the same digit when typing inside the amount regroups it', () => {
    expect(keys(amountTyped, '5', { text: '1,234', caret: 1 })).toEqual({ text: '15,234', caret: 2 })
    expect(keys(amountTyped, '9', { text: '123,456', caret: 3 })).toEqual({ text: '1,239,456', caret: 5 })
    expect(keys(amountTyped, '3', { text: '12.50', caret: 2 })).toEqual({ text: '123.50', caret: 3 })
  })

  it('regroups after a backspace and keeps the caret beside the same digit', () => {
    expect(backspace(amountTyped, { text: '1,234', caret: 5 })).toEqual({ text: '123', caret: 3 })
    expect(backspace(amountTyped, { text: '12,345', caret: 4 })).toEqual({ text: '1,245', caret: 3 })
    expect(backspace(amountTyped, { text: '1.5', caret: 3 })).toEqual({ text: '1.', caret: 2 })
    expect(backspace(amountTyped, { text: '7', caret: 1 })).toEqual({ text: '', caret: 0 })
  })

  it('takes the digit beside a group mark that Backspace or Delete would take alone', () => {
    expect(backspace(amountTyped, { text: '1,234', caret: 2 })).toEqual({ text: '234', caret: 0 })
    expect(backspace(amountTyped, { text: '12,345', caret: 3 })).toEqual({ text: '1,345', caret: 1 })
    expect(forwardDelete(amountTyped, { text: '1,234', caret: 1 })).toEqual({ text: '134', caret: 1 })
  })

  it('deletes a comma still read as the decimal mark on its own', () => {
    expect(backspace(amountTyped, { text: '1,5', caret: 2 })).toEqual({ text: '15', caret: 1 })
    expect(forwardDelete(amountTyped, { text: '1,234,5', caret: 5 })).toEqual({ text: '12,345', caret: 5 })
  })

  it('keeps a comma read as the decimal mark while digits are typed before it', () => {
    expect(keys(amountTyped, '2', { text: '1,5', caret: 1 })).toEqual({ text: '12,5', caret: 2 })
    expect(keys(amountTyped, '0', { text: '1,234,5', caret: 5 })).toEqual({ text: '12,340,5', caret: 6 })
  })

  it('reads a pasted amount grouped either way, the last mark being the decimal mark when it is the only one of its kind', () => {
    expect(paste(amountTyped, '1.234,56')).toBe('1,234.56')
    expect(paste(amountTyped, '1,234.56')).toBe('1,234.56')
    expect(paste(amountTyped, '€ 1 234,56')).toBe('1,234.56')
    expect(paste(amountTyped, '1.234.567')).toBe('1,234,567')
    expect(paste(amountTyped, '1.234')).toBe('1,234')
    expect(paste(amountTyped, '12,5')).toBe('12.5')
    expect(paste(amountTyped, '1.5k')).toBe('1,500')
    expect(paste(amountTyped, '2 M')).toBe('2,000,000')
  })

  it('leaves the field as it was for a paste that does not read as one amount', () => {
    for (const text of ['-1,234.56', '1e5', '1.234.56', '1,234.567', '3k5', '3kk', 'twelve', '1.234,5.6']) {
      expect(amountTyped('12', `12${text}`, 2 + text.length)).toEqual({ text: '12', caret: 2 })
    }
  })

  it('refuses a pasted decimal mark when the field already holds one', () => {
    expect(amountTyped('12.5', '12.,35', 5)).toEqual({ text: '12.5', caret: 3 })
  })

  it('refuses a key that would take the amount past thirteen whole digits', () => {
    const full = keys(amountTyped, '1234567890123')
    expect(full.text).toBe('1,234,567,890,123')
    expect(keys(amountTyped, '4', full)).toEqual(full)
    expect(keys(amountTyped, 'k', keys(amountTyped, '12345678901'))).toEqual({ text: '12,345,678,901', caret: 14 })
  })

  it('shows text that typedAmount reads as the amount typed', () => {
    expect(typedAmount(keys(amountTyped, '1234567.89').text)).toBe(123456789)
    expect(typedAmount(keys(amountTyped, '0.2k').text)).toBe(20000)
    expect(typedAmount(paste(amountTyped, '1.234,56'))).toBe(123456)
  })
})

describe('finishedAmount', () => {
  it('adds the cents once the field is left', () => {
    expect(finishedAmount('1,500')).toBe('1,500.00')
    expect(finishedAmount('12.')).toBe('12.00')
    expect(finishedAmount('0.5')).toBe('0.50')
    expect(finishedAmount('1,234.56')).toBe('1,234.56')
  })

  it('reads a comma still read as the decimal mark as the decimal mark', () => {
    expect(finishedAmount('1,5')).toBe('1.50')
    expect(finishedAmount('12,')).toBe('12.00')
    expect(finishedAmount('1,234,5')).toBe('1,234.50')
  })

  it('leaves a blank field blank and text that is not an amount as it is', () => {
    expect(finishedAmount('')).toBe('')
    expect(finishedAmount('12345678901234.00x')).toBe('12345678901234.00x')
  })
})

describe('amountShown', () => {
  it('shows an amount given from outside the field grouped and with its cents', () => {
    expect(amountShown('1500.00')).toBe('1,500.00')
    expect(amountShown('10000.5')).toBe('10,000.50')
    expect(amountShown('')).toBe('')
  })

  it('shows an amount past what can be typed rather than blanking it', () => {
    expect(amountShown('12345678901234.00')).toBe('12,345,678,901,234.00')
  })

  it('reads stored text as decimal text, never as thousands, and keeps more than two decimals as they are', () => {
    expect(amountShown('1.234')).toBe('1.234')
    expect(amountShown('12.345')).toBe('12.345')
    expect(amountShown('1234.5')).toBe('1,234.50')
    expect(amountShown('1,234.50')).toBe('1,234.50')
  })

  it('shows text that is not an amount as it is', () => {
    expect(amountShown('-5.00')).toBe('-5.00')
  })
})

describe('amount typing in Croatian', () => {
  async function croatian(): Promise<typeof import('../src/shared/money/amountTyping')> {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
    const typing = await import('../src/shared/money/amountTyping')
    vi.doUnmock('../src/shared/text/language')
    return typing
  }

  it('groups thousands with dots and shows a decimal comma', async () => {
    const { amountTyped: typing } = await croatian()
    expect(keys(typing, '1234567,8').text).toBe('1.234.567,8')
    expect(keys(typing, '12,5').text).toBe('12,5')
  })

  it('reads 1.500 typed as fifteen hundred and 12.5 as twelve fifty, as typedAmount reads them in Croatian', async () => {
    const { amountTyped: typing, finishedAmount: finished } = await croatian()
    expect(keys(typing, '1.500').text).toBe('1.500')
    expect(keys(typing, '1.234,56').text).toBe('1.234,56')
    expect(keys(typing, '12.5').text).toBe('12.5')
    expect(finished('12.5')).toBe('12,50')
  })

  it('refuses a third digit after the decimal comma', async () => {
    const { amountTyped: typing } = await croatian()
    expect(keys(typing, '1,500').text).toBe('1,50')
    expect(keys(typing, '1,255m').text).toBe('1.250.000')
    expect(keys(typing, '1.255m').text).toBe('1.255.000.000')
  })

  it('expands a k or an m the same way', async () => {
    const { amountTyped: typing } = await croatian()
    expect(keys(typing, '3k').text).toBe('3.000')
    expect(keys(typing, '0,2k').text).toBe('200')
    expect(keys(typing, '1,5m').text).toBe('1.500.000')
  })

  it('reads a pasted amount grouped either way', async () => {
    const { amountTyped: typing } = await croatian()
    expect(paste(typing, '1,234.56')).toBe('1.234,56')
    expect(paste(typing, '1.234,56')).toBe('1.234,56')
  })

  it('adds the cents once the field is left and shows an amount from outside the field', async () => {
    const { finishedAmount: finished, amountShown: shown } = await croatian()
    expect(finished('1.500')).toBe('1.500,00')
    expect(shown('1500.00')).toBe('1.500,00')
  })

  it('shows stored text with three decimals with a decimal comma, never as thousands', async () => {
    const { amountShown: shown } = await croatian()
    expect(shown('1.234')).toBe('1,234')
    expect(shown('1,234')).toBe('1,234')
    expect(shown('1.234,50')).toBe('1.234,50')
  })
})
