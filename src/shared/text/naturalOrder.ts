import { intlLocale } from './language'

const COLLATOR = new Intl.Collator(intlLocale, { numeric: true })

/** Text compared with the numbers inside it as numbers, so `2-1-26` comes before `10-1-26`. */
export function naturalOrder(left: string, right: string): number {
  return COLLATOR.compare(left, right)
}
