/**
 * How the bank amount of a purchase in a category splits into cost and VAT, from the `vat` column
 * of `categories`. A blank cell is `none`.
 */
export const VAT_TREATMENTS = [
  'none',
  'deductible-25',
  'deductible-13',
  'deductible-5',
  'reverse-charge',
  'foreign-vat',
  'representation',
  'car-50',
] as const

export type VatTreatment = (typeof VAT_TREATMENTS)[number]

export function isVatTreatment(text: string): text is VatTreatment {
  return (VAT_TREATMENTS as readonly string[]).includes(text)
}
