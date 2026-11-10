import { normaliseIban } from '../../../../shared/text/fold'

/** A comma-separated list of IBANs, each normalised, blanks left out. */
export function ibanListOf(text: string): string[] {
  return text
    .split(',')
    .map(normaliseIban)
    .filter((iban) => iban !== '')
}
