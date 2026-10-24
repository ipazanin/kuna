import type { CellValue, WorkbookTab } from '../../src/features/workbook/infrastructure/workbookSnapshot'

/** The tabs whose rows have no business key of their own, so each row carries an id. */
export const TABS_WITH_IDS = ['outgoing-plan', 'owner-advances', 'assets', 'year-end', 'plan', 'splits', 'dismissed'] as const satisfies readonly WorkbookTab[]

/** A tab's grid with the id column after its last column and an id on every row, made from the row's number, such as `plan-2`. */
export function withIds(prefix: string, [header = [], ...rows]: readonly (readonly CellValue[])[]): CellValue[][] {
  return [[...header, 'id'], ...rows.map((row, index) => [...row, ...Array.from({ length: Math.max(0, header.length - row.length) }, () => ''), `${prefix}-${index + 2}`])]
}
