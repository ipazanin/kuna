import type { CellValue } from '../../src/features/workbook/infrastructure/workbookSnapshot'

/** A tab's grid with the id column after its last column and an id on every row, made from the row's number, such as `plan-2`. */
export function withIds(prefix: string, [header = [], ...rows]: readonly (readonly CellValue[])[]): CellValue[][] {
  return [[...header, 'id'], ...rows.map((row, index) => [...row, ...Array.from({ length: Math.max(0, header.length - row.length) }, () => ''), `${prefix}-${index + 2}`])]
}
