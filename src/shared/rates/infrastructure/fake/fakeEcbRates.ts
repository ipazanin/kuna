import { addDays, parseCivilDate, today, weekdaysBetween } from '../../../calendar/civilDate'
import type { RatesFetch } from '../ecbRates'

/** The fake build's rates start no earlier than this, however far back a request asks. */
const EARLIEST = '2023-01-02'

/** A made-up rate for a currency on a day, near 1.1, that wanders a little from day to day. */
function madeUpRate(currency: string, day: string): string {
  const seed = [...`${currency}${day}`].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 1000, 7)
  const cents = 1000 + seed
  return `1.${Math.floor(cents / 100)}${String(cents % 100).padStart(2, '0')}`
}

/** The fake build's ECB: a made-up rate on every weekday from the day asked to today, so no request leaves the page. */
export const fakeEcbFetch: RatesFetch = async (url) => {
  if (!url.startsWith('https://data-api.ecb.europa.eu/service/data/EXR/D.')) {
    return { status: 404, text: '' }
  }
  const currency = url.split('/EXR/D.')[1]?.split('.EUR.')[0] ?? ''
  const asked = new URL(url).searchParams.get('startPeriod') ?? EARLIEST
  const lines: string[] = []
  for (let day = parseCivilDate(asked > EARLIEST ? asked : EARLIEST)!; day <= today(); day = addDays(day, 1)) {
    if (weekdaysBetween(day, day) === 1) {
      lines.push(`EXR.D.${currency}.EUR.SP00.A,${day},${madeUpRate(currency, day)}`)
    }
  }
  return { status: 200, text: ['KEY,TIME_PERIOD,OBS_VALUE', ...lines].join('\r\n') }
}
