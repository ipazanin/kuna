import { describe, expect, it, vi } from 'vitest'

import { readFactsheetCountries } from '../src/apps/investments/holdings/domain/factsheetCountries'
import { decimalText } from '../src/shared/money/decimal'
import { countryCodeOfName } from '../src/shared/text/countryName'

/** Each line's group and percent as text, so a table reads as plain rows. */
function rows(paste: string): [string | null, string | null][] {
  return readFactsheetCountries(paste).map((line) => [line.group, line.percent === null ? null : decimalText(line.percent)])
}

describe('readFactsheetCountries', () => {
  it('reads an English table copied from a factsheet, with its header and its Other line unknown', () => {
    const paste = [
      'Country\tWeight (%)',
      'United States\t62.10%',
      'Japan\t5.40%',
      'United Kingdom\t3.20%',
      'Canada\t2.90%',
      'France\t2.60%',
      'Switzerland\t2.40%',
      'Germany\t2.10%',
      'Australia\t1.80%',
      'Other\t17.50%',
    ].join('\n')

    expect(rows(paste)).toEqual([
      [null, null],
      ['US', '62.1'],
      ['JP', '5.4'],
      ['GB', '3.2'],
      ['CA', '2.9'],
      ['FR', '2.6'],
      ['CH', '2.4'],
      ['DE', '2.1'],
      ['AU', '1.8'],
      [null, '17.5'],
    ])
  })

  it('reads a Croatian table with decimal commas, a region line and an Ostalo line', () => {
    const paste = ['Zemlja\tUdio', 'Sjedinjene Američke Države\t58,3 %', 'Ujedinjeno Kraljevstvo 3,2%', 'Njemačka\t4,15%', 'Tržišta u razvoju\t10,0 %', 'Ostalo\t24,35 %'].join('\r\n')

    expect(rows(paste)).toEqual([
      [null, null],
      ['US', '58.3'],
      ['GB', '3.2'],
      ['DE', '4.15'],
      ['emerging-markets', '10'],
      [null, '24.35'],
    ])
  })

  it('keeps each line as pasted, trimmed, and skips blank lines', () => {
    expect(readFactsheetCountries('\n  France  2.10 %  \n\n\t\n').map((line) => line.text)).toEqual(['France  2.10 %'])
  })

  it('reads ISO codes, with or without a percent sign and with a semicolon between', () => {
    expect(rows('US 62.1\nDE;4.5%\njp\t3')).toEqual([
      ['US', '62.1'],
      ['DE', '4.5'],
      ['JP', '3'],
    ])
  })

  it('reads a percent before the name, a name in quotes and a leading or trailing bullet', () => {
    expect(rows('62.1% United States\n"Japan", 5,4%\n• France 2.6%\n- Spain 1.1%\nItaly 0.9% •')).toEqual([
      ['US', '62.1'],
      ['JP', '5.4'],
      ['FR', '2.6'],
      ['ES', '1.1'],
      ['IT', '0.9'],
    ])
  })

  it('reads the region names in English and Croatian, with or without diacritics', () => {
    expect(rows('World 100%\nEuropa 40%\nNorth America 30%\nAzija i Pacifik 20%\nTrzista u nastajanju 10%\nAsia Pacific 5%').map(([group]) => group)).toEqual([
      'world',
      'europe',
      'north-america',
      'asia-pacific',
      'emerging-markets',
      'asia-pacific',
    ])
  })

  it('keeps the percent of a line whose name it does not know, and flags the name with a null group', () => {
    expect(rows('Cash 1.5%\nAtlantis 2%\nXK 1%')).toEqual([
      [null, '1.5'],
      [null, '2'],
      [null, '1'],
    ])
  })

  it('gives no percent for zero, a negative share, more than a hundred or no figure at all', () => {
    expect(rows('France 0%\nGermany -1.2%\nJapan 100.5%\nItaly\nSpain 100%')).toEqual([
      ['FR', null],
      ['DE', null],
      ['JP', null],
      ['IT', null],
      ['ES', '100'],
    ])
  })

  it('keeps duplicate lines and shares that do not add up to a hundred', () => {
    expect(rows('Japan 5%\nJapan 5%')).toEqual([
      ['JP', '5'],
      ['JP', '5'],
    ])
  })
})

describe('countryCodeOfName', () => {
  it('reads English names in any case and spacing', () => {
    expect(countryCodeOfName('Germany')).toBe('DE')
    expect(countryCodeOfName('  united   KINGDOM ')).toBe('GB')
    expect(countryCodeOfName("Cote d'Ivoire")).toBe('CI')
    expect(countryCodeOfName('Bosnia and Herzegovina')).toBe('BA')
  })

  it('reads Croatian names with and without diacritics', () => {
    expect(countryCodeOfName('Njemačka')).toBe('DE')
    expect(countryCodeOfName('Njemacka')).toBe('DE')
    expect(countryCodeOfName('Južna Koreja')).toBe('KR')
    expect(countryCodeOfName('Juzna Koreja')).toBe('KR')
    expect(countryCodeOfName('Hrvatska')).toBe('HR')
  })

  it('reads the spellings factsheets use that Intl does not give', () => {
    expect(['USA', 'U.S.', 'US', 'United States of America', 'SAD', 'Amerika'].map(countryCodeOfName)).toEqual(['US', 'US', 'US', 'US', 'US', 'US'])
    expect(['UK', 'U.K.', 'Great Britain', 'Britain', 'Velika Britanija'].map(countryCodeOfName)).toEqual(['GB', 'GB', 'GB', 'GB', 'GB'])
    expect(countryCodeOfName('Hong Kong')).toBe('HK')
    expect(countryCodeOfName('Korea')).toBe('KR')
    expect(countryCodeOfName('Koreja')).toBe('KR')
    expect(countryCodeOfName('Czech Republic')).toBe('CZ')
    expect(countryCodeOfName('Ceska Republika')).toBe('CZ')
    expect(countryCodeOfName('Macau')).toBe('MO')
    expect(countryCodeOfName('Viet Nam')).toBe('VN')
    expect(countryCodeOfName('Turkey')).toBe('TR')
    expect(countryCodeOfName('Türkiye')).toBe('TR')
    expect(countryCodeOfName('Holland')).toBe('NL')
    expect(countryCodeOfName('Russian Federation')).toBe('RU')
  })

  it('reads Croatian and English names alike when Croatian is on screen', async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ intlLocale: 'hr-HR' }))
    const { countryCodeOfName: codeOnCroatianScreen } = await import('../src/shared/text/countryName')
    expect(['Nizozemska', 'Netherlands', 'Rusija', 'Russia', 'Tajvan', 'Taiwan'].map(codeOnCroatianScreen)).toEqual(['NL', 'NL', 'RU', 'RU', 'TW', 'TW'])
    vi.doUnmock('../src/shared/text/language')
  })

  it('gives null for a name it does not know', () => {
    expect(countryCodeOfName('Atlantis')).toBeNull()
    expect(countryCodeOfName('')).toBeNull()
  })
})
