import { isCloseText, isDay } from '../domain/pricesFile'
import type { CloseRow } from '../domain/pricesFile'
import { fetchedText } from './priceJobPorts'
import type { Fetched, PriceJobPorts } from './priceJobPorts'

export interface EcbRates {
  readonly kind: 'rates'
  /** Units of each currency per euro by day, oldest first. A currency the ECB does not publish is missing. */
  readonly rates: ReadonlyMap<string, readonly CloseRow[]>
}

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

/** The ECB's daily euro reference rates of the currencies from the day on, in one request with no key. */
export function ecbRates(ports: PriceJobPorts, currencies: readonly string[], from: string): Fetched<EcbRates> {
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currencies.join('+')}.EUR.SP00.A?startPeriod=${from}&format=csvdata&detail=dataonly`
  const answer = fetchedText(ports, url)
  if (answer.kind === 'failed') {
    return answer
  }
  const [header, ...lines] = answer.text.split(/\r?\n/).filter((line) => line.trim() !== '')
  const names = header === undefined ? [] : csvFields(header)
  const column = { currency: names.indexOf('CURRENCY'), key: names.indexOf('KEY'), day: names.indexOf('TIME_PERIOD'), rate: names.indexOf('OBS_VALUE') }
  if ((column.currency < 0 && column.key < 0) || column.day < 0 || column.rate < 0) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const rates = new Map<string, CloseRow[]>()
  for (const line of lines) {
    const fields = csvFields(line)
    // A series key such as EXR.D.USD.EUR.SP00.A names the currency third.
    const currency = (column.currency >= 0 ? fields[column.currency] : fields[column.key]?.split('.')[2]) ?? ''
    const [day, rate] = [fields[column.day] ?? '', fields[column.rate] ?? '']
    if (!currencies.includes(currency) || !isDay(day) || !isCloseText(rate)) {
      continue
    }
    const rows = rates.get(currency)
    if (rows === undefined) {
      rates.set(currency, [[day, rate]])
    } else {
      rows.push([day, rate])
    }
  }
  for (const rows of rates.values()) {
    rows.sort(([earlier], [later]) => (earlier < later ? -1 : 1))
  }
  return { kind: 'rates', rates }
}
