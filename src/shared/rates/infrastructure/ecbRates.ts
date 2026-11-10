import { parseCivilDate } from '../../calendar/civilDate'
import type { DatedRate } from '../../money/rateBook'
import type { RatesUpdatePorts } from '../application/ratesPorts'

/** What a server answered: its HTTP status and the body as text. */
export interface RatesAnswer {
  readonly status: number
  readonly text: string
}

/** A plain GET. It throws when no answer comes at all. */
export type RatesFetch = (url: string) => Promise<RatesAnswer>

/** The ECB's rates oldest first, or why there are none: no answer, a status other than 200, or a body without its columns. */
export type EcbRates =
  { readonly kind: 'rates'; readonly rates: readonly DatedRate[] } | { readonly kind: 'no-answer' } | { readonly kind: 'status'; readonly status: number } | { readonly kind: 'unreadable' }

const RATE = /^\d+(\.\d{1,12})?$/

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
export async function ecbRates(fetch: RatesFetch, currency: string, from: string): Promise<EcbRates> {
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${encodeURIComponent(currency)}.EUR.SP00.A?startPeriod=${from}&format=csvdata&detail=dataonly`
  let answer: RatesAnswer
  try {
    answer = await fetch(url)
  } catch {
    return { kind: 'no-answer' }
  }
  if (answer.status !== 200) {
    return { kind: 'status', status: answer.status }
  }
  const [header, ...lines] = answer.text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (header === undefined) {
    return { kind: 'rates', rates: [] }
  }
  const names = csvFields(header)
  const column = { day: names.indexOf('TIME_PERIOD'), rate: names.indexOf('OBS_VALUE') }
  if (column.day < 0 || column.rate < 0) {
    return { kind: 'unreadable' }
  }
  const rates: DatedRate[] = []
  for (const line of lines) {
    const fields = csvFields(line)
    const [day, rate] = [fields[column.day] ?? '', fields[column.rate] ?? '']
    if (parseCivilDate(day) !== null && RATE.test(rate)) {
      rates.push([day, rate])
    }
  }
  return { kind: 'rates', rates: rates.sort(([earlier], [later]) => (earlier < later ? -1 : 1)) }
}

/** The ECB's rates as the rates update asks for them, any failure read as none. */
export function ecbAnswers(fetch: RatesFetch): RatesUpdatePorts['ecbRates'] {
  return async (currency, from) => {
    const answer = await ecbRates(fetch, currency, from)
    return answer.kind === 'rates' ? answer : { kind: 'failed' }
  }
}
