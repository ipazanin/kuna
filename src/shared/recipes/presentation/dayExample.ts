const EXAMPLE: Readonly<Record<string, string>> = { yyyy: '2026', MM: '12', dd: '31', HH: '14', mm: '30', ss: '00' }

/** The last day of 2026 at 14:30 as a day format writes it, so a person picks a format by how its days look. */
export function dayExample(format: string): string {
  return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (letters) => EXAMPLE[letters] ?? letters)
}
