import type { VendorAnswer, VendorFetch } from '../../application/priceVendor'
import { isWeekday } from './fakePrices'
import { addDays, parseCivilDate, today } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'

/** The fake build's answers start no earlier than this, however far back a request asks. */
const EARLIEST = '2023-01-02'

function json(status: number, body: unknown): VendorAnswer {
  return { status, text: JSON.stringify(body) }
}

/** The weekdays from the day to today, both included. */
function weekdaysFrom(from: string): CivilDate[] {
  const days: CivilDate[] = []
  const last = today()
  for (let day = parseCivilDate(from > EARLIEST ? from : EARLIEST)!; day <= last; day = addDays(day, 1)) {
    if (isWeekday(day)) {
      days.push(day)
    }
  }
  return days
}

/** A made-up close for a symbol on a day, with two places, that wanders a little from day to day. */
function madeUpClose(symbol: string, day: string, base: number): string {
  const seed = [...`${symbol}${day}`].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 1000, 7)
  const cents = base * 100 + seed
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

function twelveData(query: URLSearchParams): VendorAnswer {
  const symbol = query.get('symbol') ?? ''
  const through = query.get('end_date') ?? '9999-12-31'
  const days = weekdaysFrom(query.get('start_date') ?? EARLIEST).filter((day) => day <= through)
  if (days.length === 0) {
    return json(400, { code: 400, message: 'No data is available on the specified dates.', status: 'error' })
  }
  return json(200, { meta: { symbol }, values: days.map((day) => ({ datetime: day, close: madeUpClose(symbol, day, 100) })), status: 'ok' })
}

/** The splits the fake Alpha Vantage lists, the made-up workbook's split among them. */
const FAKE_SPLITS: Readonly<Record<string, readonly { readonly effective_date: string; readonly split_factor: string }[]>> = {
  ABC: [{ effective_date: '2025-06-10', split_factor: '2.0000' }],
}

function alphaVantage(query: URLSearchParams): VendorAnswer {
  const symbol = query.get('symbol') ?? ''
  if (query.get('function') === 'SPLITS') {
    return json(200, { symbol, data: FAKE_SPLITS[symbol] ?? [] })
  }
  const days = weekdaysFrom(EARLIEST)
  const rows = (picked: readonly CivilDate[]): Record<string, Record<string, string>> => Object.fromEntries(picked.map((day) => [day, { '4. close': madeUpClose(symbol, day, 90) }]))
  if (query.get('function') === 'TIME_SERIES_DAILY') {
    return json(200, { 'Meta Data': { '2. Symbol': symbol }, 'Time Series (Daily)': rows(days.slice(-100)) })
  }
  const monthEnds = days.filter((day, place) => days[place + 1]?.slice(0, 7) !== day.slice(0, 7))
  return json(200, { 'Meta Data': { '2. Symbol': symbol }, 'Monthly Time Series': rows(monthEnds) })
}

function ecb(url: string, query: URLSearchParams): VendorAnswer {
  const currency = url.split('/EXR/D.')[1]?.split('.EUR.')[0] ?? ''
  const lines = weekdaysFrom(query.get('startPeriod') ?? EARLIEST).map((day) => `EXR.D.${currency}.EUR.SP00.A,${day},1.${madeUpClose(currency, day, 10).replace('.', '')}`)
  return { status: 200, text: ['KEY,TIME_PERIOD,OBS_VALUE', ...lines].join('\r\n') }
}

/** The fake build's vendors: made-up closes for any symbol and any key, so no request leaves the page. */
export const fakeVendorFetch: VendorFetch = async (url) => {
  const query = new URL(url).searchParams
  if (url.startsWith('https://api.twelvedata.com/time_series?')) {
    return twelveData(query)
  }
  if (url.startsWith('https://www.alphavantage.co/query?')) {
    return alphaVantage(query)
  }
  if (url.startsWith('https://data-api.ecb.europa.eu/service/data/EXR/D.')) {
    return ecb(url, query)
  }
  return json(404, { message: 'The fake build knows no such vendor address.' })
}
