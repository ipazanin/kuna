import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'

import { fiscalQr } from '../src/apps/spending/receipts/domain/fiscalQr'
import { sampleFiscalQrText, sampleQrModules } from '../src/apps/spending/receipts/infrastructure/fake/sampleReceiptPhoto'
import { civil, euros } from './fixtures/ledger'

const MADE_UP_JIR = '1a2b3c4d-0000-4000-8000-1234567890ab'
const MADE_UP_ZKI = '0123456789abcdef0123456789abcdef'

function address(query: string): string {
  return `https://porezna.gov.hr/rn?${query}`
}

describe('a fiscal QR code', () => {
  it('reads the made-up izn=2349 as €23.49, with its JIR, day and time', () => {
    expect(fiscalQr(address(`jir=${MADE_UP_JIR}&datv=20261103_1842&izn=2349`))).toEqual({ jir: MADE_UP_JIR, zki: '', issuedOn: civil('2026-11-03'), issuedTime: '18:42', total: euros(23.49) })
  })

  it('reads a ZKI in place of a JIR', () => {
    expect(fiscalQr(address(`zki=${MADE_UP_ZKI}&datv=20261103_0905&izn=2349`))).toMatchObject({ jir: '', zki: MADE_UP_ZKI, issuedTime: '09:05' })
  })

  it.each([
    ['23,49', 23.49],
    ['23.49', 23.49],
    ['23,4', 23.4],
    ['1234,50', 1234.5],
    ['00002349', 23.49],
  ])('reads a total of %s as %d', (izn, amount) => {
    expect(fiscalQr(address(`jir=${MADE_UP_JIR}&datv=20261103_1842&izn=${izn}`))?.total).toEqual(euros(amount))
  })

  it('takes extra parameters, since the rule says at least these four', () => {
    expect(fiscalQr(address(`jir=${MADE_UP_JIR}&datv=20261103_1842&izn=2349&extra=1`))?.total).toEqual(euros(23.49))
  })

  it.each([
    ['another address', `https://example.com/rn?jir=${MADE_UP_JIR}&datv=20261103_1842&izn=2349`],
    ['a lookalike host', `https://porezna.gov.hr.example.com/rn?jir=${MADE_UP_JIR}&datv=20261103_1842&izn=2349`],
    ['another path', `https://porezna.gov.hr/other?jir=${MADE_UP_JIR}&datv=20261103_1842&izn=2349`],
    ['plain text', 'Thank you for shopping'],
    ['no JIR or ZKI', address('datv=20261103_1842&izn=2349')],
    ['a malformed JIR', address('jir=abc&datv=20261103_1842&izn=2349')],
    ['no date', address(`jir=${MADE_UP_JIR}&izn=2349`)],
    ['a date that is no day', address(`jir=${MADE_UP_JIR}&datv=20261331_1842&izn=2349`)],
    ['a time past midnight', address(`jir=${MADE_UP_JIR}&datv=20261103_2460&izn=2349`)],
    ['no total', address(`jir=${MADE_UP_JIR}&datv=20261103_1842`)],
    ['a zero total', address(`jir=${MADE_UP_JIR}&datv=20261103_1842&izn=0`)],
    ['a total below zero', address(`jir=${MADE_UP_JIR}&datv=20261103_1842&izn=-2349`)],
  ])('refuses %s', (_name, text) => {
    expect(fiscalQr(text)).toBeNull()
  })

  it("reads the checks' sample code back through jsQR, as the page does", () => {
    const text = sampleFiscalQrText(civil('2026-11-03'), 2349)
    const modules = sampleQrModules(text)
    const scale = 4
    const quiet = 4
    const side = (modules.length + quiet * 2) * scale
    const pixels = new Uint8ClampedArray(side * side * 4).fill(255)
    modules.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (!dark) return
        for (let down = 0; down < scale; down += 1) {
          for (let across = 0; across < scale; across += 1) {
            const at = ((y + quiet) * scale + down) * side + (x + quiet) * scale + across
            pixels.fill(0, at * 4, at * 4 + 3)
          }
        }
      })
    })

    expect(jsQR(pixels, side, side)?.data).toBe(text)
    expect(fiscalQr(text)).toMatchObject({ issuedOn: civil('2026-11-03'), total: euros(23.49) })
  })
})
