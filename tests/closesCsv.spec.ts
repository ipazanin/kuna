import { describe, expect, it } from 'vitest'

import { readClosesCsv } from '../src/apps/investments/prices/domain/closesCsv'
import type { ClosesCsvRefusal } from '../src/apps/investments/prices/domain/closesCsv'
import { isCloseText } from '../src/apps/investments/prices/domain/pricesFile'
import type { CloseRow } from '../src/apps/investments/prices/domain/pricesFile'

function closesOf(text: string): readonly CloseRow[] {
  const reading = readClosesCsv(text)
  if (reading.kind !== 'read') {
    throw new Error(`Refused: ${JSON.stringify(reading.refusal)}`)
  }
  return reading.closes
}

function refusalOf(text: string): ClosesCsvRefusal {
  const reading = readClosesCsv(text)
  if (reading.kind !== 'refused') {
    throw new Error(`Read: ${JSON.stringify(reading.closes)}`)
  }
  return reading.refusal
}

describe('reading closes from a CSV file', () => {
  it('reads a plain Date and Close file as plain decimal closes', () => {
    const closes = closesOf('Date,Close\n2026-03-02,41.20\n2026-03-03,41.075\n2026-03-04,40\n')
    expect(closes).toEqual([
      ['2026-03-02', '41.2'],
      ['2026-03-03', '41.075'],
      ['2026-03-04', '40'],
    ])
    expect(closes.every(([, close]) => isCloseText(close))).toBe(true)
  })

  it('takes Close and not Adj Close from a Yahoo history download', () => {
    const yahoo = ['Date,Open,High,Low,Close,Adj Close,Volume', '2026-05-11,88.10,89.40,87.95,89.00,86.512345,120400', '2026-05-12,89.05,90.20,88.70,90.15,87.630001,98300'].join('\n')
    expect(closesOf(yahoo)).toEqual([
      ['2026-05-11', '89'],
      ['2026-05-12', '90.15'],
    ])
  })

  it('reads a semicolon file with comma decimals and day-first dotted dates, the Croatian trailing dot included', () => {
    const european = 'Datum;Date;Close\nponedjeljak;2.3.2026.;1234,56\nutorak;03.03.2026;1240,5\n'
    expect(closesOf(european)).toEqual([
      ['2026-03-02', '1234.56'],
      ['2026-03-03', '1240.5'],
    ])
  })

  it('reads slash dates month-first when one date reads only that way', () => {
    const text = 'Date,Close\n4/7/2026,12.5\n4/8/2026,12.75\n4/21/2026,13\n'
    expect(closesOf(text)).toEqual([
      ['2026-04-07', '12.5'],
      ['2026-04-08', '12.75'],
      ['2026-04-21', '13'],
    ])
  })

  it('reads slash dates day-first when one date reads only that way, and refuses a date that then does not read', () => {
    expect(closesOf('Date,Close\n4/7/2026,12.5\n21/4/2026,13\n')).toEqual([
      ['2026-04-21', '13'],
      ['2026-07-04', '12.5'],
    ])
    expect(refusalOf('Date,Close\n21/4/2026,13\n4/22/2026,12.5\n')).toEqual({ kind: 'unreadable', line: 3, text: '4/22/2026,12.5' })
  })

  it('refuses a file whose slash dates read both ways with different days', () => {
    expect(refusalOf('Date,Close\n4/7/2026,12.5\n5/7/2026,12.75\n')).toEqual({ kind: 'ambiguous-dates' })
  })

  it('reads slash dates that give the same day either way', () => {
    expect(closesOf('Date,Close\n6/6/2026,7.1\n')).toEqual([['2026-06-06', '7.1']])
  })

  it('takes the day of an ISO date with a time after it', () => {
    expect(closesOf('Date,Close\n2026-08-14 00:00:00-04:00,55.3\n2026-08-17T00:00:00Z,55.9\n')).toEqual([
      ['2026-08-14', '55.3'],
      ['2026-08-17', '55.9'],
    ])
  })

  it('skips the rows Yahoo marks null on days with no trade', () => {
    const text = 'Date,Open,High,Low,Close,Adj Close,Volume\n2026-12-24,20,21,19,20.5,20.5,1000\n2026-12-25,null,null,null,null,null,null\n2026-12-28,20.5,21,20,20.75,20.75,900\n'
    expect(closesOf(text)).toEqual([
      ['2026-12-24', '20.5'],
      ['2026-12-28', '20.75'],
    ])
  })

  it('reads a file that starts with a byte order mark, with blank lines and quoted fields', () => {
    const text = '﻿\r\n "Date" ,"Note",CLOSE\r\n2026-02-02,"bought, then sold",9.5\r\n\r\n2026-02-03,"said ""hold""",9.625\r\n'
    expect(closesOf(text)).toEqual([
      ['2026-02-02', '9.5'],
      ['2026-02-03', '9.625'],
    ])
  })

  it('refuses a close that is zero, signed, in thousands, longer than twelve places, or a comma decimal in a comma file, with its line', () => {
    expect(refusalOf('Date,Close\n2026-03-02,41.2\n2026-03-03,0\n')).toEqual({ kind: 'unreadable', line: 3, text: '2026-03-03,0' })
    expect(refusalOf('Date,Close\n2026-03-02,-41.2\n')).toEqual({ kind: 'unreadable', line: 2, text: '2026-03-02,-41.2' })
    expect(refusalOf('Date,Close\n2026-03-02,"1,234.50"\n')).toEqual({ kind: 'unreadable', line: 2, text: '2026-03-02,"1,234.50"' })
    expect(refusalOf('Date,Close\n2026-03-02,1.0000000000001\n')).toEqual({ kind: 'unreadable', line: 2, text: '2026-03-02,1.0000000000001' })
    expect(refusalOf('Date,Close\n2026-03-02,41,2\n')).toEqual({ kind: 'unreadable', line: 2, text: '2026-03-02,41,2' })
  })

  it('counts the line of a refused close from the top of the file, blank lines included', () => {
    expect(refusalOf('Date,Close\n\n2026-03-02,41.2\n2026-03-03,n/a\n')).toEqual({ kind: 'unreadable', line: 4, text: '2026-03-03,n/a' })
  })

  it('refuses a date that is no calendar day', () => {
    expect(refusalOf('Date,Close\n2026-02-30,41.2\n')).toEqual({ kind: 'unreadable', line: 2, text: '2026-02-30,41.2' })
    expect(refusalOf('Date,Close\n31.4.2026.,41.2\n')).toEqual({ kind: 'unreadable', line: 2, text: '31.4.2026.,41.2' })
  })

  it('refuses the same day twice', () => {
    expect(refusalOf('Date,Close\n2026-03-02,41.2\n2026-03-03,41.5\n2026-03-02,41.3\n')).toEqual({ kind: 'repeated-day', day: '2026-03-02' })
  })

  it('refuses a file without a Close column, or with only an Adj Close one', () => {
    expect(refusalOf('Date,Open,High\n2026-03-02,1,2\n')).toEqual({ kind: 'no-columns' })
    expect(refusalOf('Date,Adj Close\n2026-03-02,41.2\n')).toEqual({ kind: 'no-columns' })
    expect(refusalOf('Day,Close\n2026-03-02,41.2\n')).toEqual({ kind: 'no-columns' })
  })

  it('refuses an empty file, a header alone, and a file of null rows alone as empty', () => {
    expect(refusalOf('')).toEqual({ kind: 'empty' })
    expect(refusalOf('﻿\n\n')).toEqual({ kind: 'empty' })
    expect(refusalOf('Date,Close\n')).toEqual({ kind: 'empty' })
    expect(refusalOf('Date,Close\n2026-12-25,null\n')).toEqual({ kind: 'empty' })
  })

  it('gives rows out of order oldest first', () => {
    expect(closesOf('Date,Close\n2026-03-04,40\n2026-03-02,41.2\n2026-03-03,41.075\n')).toEqual([
      ['2026-03-02', '41.2'],
      ['2026-03-03', '41.075'],
      ['2026-03-04', '40'],
    ])
  })
})
