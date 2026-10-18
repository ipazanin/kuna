/** The spreadsheet letter of a 1-based column: 1 is A, 26 is Z, 27 is AA. */
export function columnLetter(column: number): string {
  if (!Number.isInteger(column) || column < 1) {
    throw new RangeError(`${column} is not a column number.`)
  }
  let letters = ''
  for (let remaining = column; remaining > 0; remaining = Math.floor((remaining - 1) / 26)) {
    letters = String.fromCharCode(65 + ((remaining - 1) % 26)) + letters
  }
  return letters
}
