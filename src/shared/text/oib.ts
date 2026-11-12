const OIB = /^\d{11}$/

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
