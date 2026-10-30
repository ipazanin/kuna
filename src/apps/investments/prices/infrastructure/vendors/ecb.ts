import { words } from './words'
import { answerOf, statusFailure } from './vendorAnswers'
import { ECB_SOURCE, isCloseText, isDay } from '../../domain/pricesFile'
import type { CloseRow } from '../../domain/pricesFile'
import type { Fetched, PriceVendor, VendorCloses, VendorFetch } from '../../application/priceVendor'

/** The fields of one CSV line, with quoted fields that hold commas or doubled quotes. */
function csvFields(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let quoted = false
  for (let place = 0; place < line.length; place += 1) {
    const character = line[place]!
    if (quoted && character === '"' && line[place + 1] === '"') {
      field += '"'
      place += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      fields.push(field)
      field = ''
    } else {
      field += character
    }
  }
  fields.push(field)
  return fields
}

/** The ECB's daily euro reference rates of a currency from the day on, in units of it per euro. A currency the ECB does not publish answers 404. */
async function ecbRates(fetch: VendorFetch, _key: string | null, currency: string, from: string): Promise<Fetched<VendorCloses>> {
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${encodeURIComponent(currency)}.EUR.SP00.A?startPeriod=${from}&format=csvdata&detail=dataonly`
  const fetched = await answerOf(fetch, url)
  if (fetched.kind === 'failed') {
    return fetched
  }
  if (fetched.answer.status !== 200) {
    return { kind: 'failed', reason: statusFailure(fetched.answer.status) }
  }
  const [header, ...lines] = fetched.answer.text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (header === undefined) {
    return { kind: 'closes', closes: [], splits: [], earlierFailure: null }
  }
  const names = csvFields(header)
  const column = { day: names.indexOf('TIME_PERIOD'), rate: names.indexOf('OBS_VALUE') }
  if (column.day < 0 || column.rate < 0) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const closes: CloseRow[] = []
  for (const line of lines) {
    const fields = csvFields(line)
    const [day, rate] = [fields[column.day] ?? '', fields[column.rate] ?? '']
    if (isDay(day) && isCloseText(rate)) {
      closes.push([day, rate])
    }
  }
  return { kind: 'closes', closes: closes.sort(([earlier], [later]) => (earlier < later ? -1 : 1)), splits: [], earlierFailure: null }
}

export const ecb: PriceVendor = {
  id: ECB_SOURCE,
  name: words.ecb.name,
  covers: words.ecb.covers,
  prices: 'rates',
  needsKey: false,
  keyAddress: null,
  limits: { perMinute: null, perDay: null, gapMilliseconds: null },
  closes: ecbRates,
}
