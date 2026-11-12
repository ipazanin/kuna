const OIB_IN_TEXT = /(?<!\d)\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}(?!\d)/

/** The OIB in a text as printed, such as `HR12345678903` or `R1 123 456 789 03`, its eleven digits in one run, or blank when it holds none. */
export function oibIn(text: string): string {
  return OIB_IN_TEXT.exec(text)?.[0].replace(/\D/g, '') ?? ''
}
