const OIB = /^\d{11}$/
const OIB_IN_TEXT = /(?<!\d)\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}(?!\d)/

/** The OIB in a text as printed, such as `HR12345678903` or `R1 123 456 789 03`, its eleven digits in one run, or blank when it holds none. */
export function oibIn(text: string): string {
  return OIB_IN_TEXT.exec(text)?.[0].replace(/\D/g, '') ?? ''
}

/** Whether the text is eleven digits whose last is the check digit of the first ten, by ISO 7064 MOD 11,10. */
export function isValidOib(text: string): boolean {
  if (!OIB.test(text)) return false
  let rest = 10
  for (const digit of text.slice(0, 10)) {
    rest = (rest + Number(digit)) % 10
    rest = ((rest === 0 ? 10 : rest) * 2) % 11
  }
  return (rest === 1 ? 0 : 11 - rest) === Number(text[10])
}
