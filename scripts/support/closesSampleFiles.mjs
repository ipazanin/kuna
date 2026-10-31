/**
 * Writes made-up CSV files of daily closes to a folder, so the visual and touch checks drop them on the Prices tab's
 * import as a person picks files: one named after the sample's Xetra ETF with Date and Close, one named after a US share
 * as Yahoo's history download lays it out, and one named after no holding, which waits for a pick.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The weekdays of December 2022, before the fake prices file's first close, each with a made-up close. */
function decemberCloses(base) {
  const rows = []
  for (let day = 1; day <= 30; day += 1) {
    const date = new Date(Date.UTC(2022, 11, day))
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) rows.push([date.toISOString().slice(0, 10), (base + day / 10).toFixed(2)])
  }
  return rows
}

export function writeClosesSamples(folder) {
  const etf = join(folder, 'XYZ.DEX.csv')
  writeFileSync(etf, ['Date,Close', ...decemberCloses(96).map(([day, close]) => `${day},${close}`)].join('\n'))
  const share = join(folder, 'DEF.csv')
  writeFileSync(share, ['Date,Open,High,Low,Close,Adj Close,Volume', ...decemberCloses(47).map(([day, close]) => `${day},${close},${close},${close},${close},1.00,1000`)].join('\n'))
  const unknown = join(folder, 'ZZZ.csv')
  writeFileSync(unknown, ['Date,Close', ...decemberCloses(140).map(([day, close]) => `${day},${close}`)].join('\n'))
  return [etf, share, unknown]
}
