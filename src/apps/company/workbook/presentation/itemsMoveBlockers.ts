import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { plural } from '../../../../shared/text/translation'
import type { ItemsMoveBlocker } from '../application/rowIdWrites'
import { words } from './words'

/** A sentence of the blocked move notice and how many blockers it stands for. */
export interface ItemsMoveBlockerLine {
  readonly text: string
  readonly count: number
}

/**
 * Each blocker of the move to items in a sentence, with its account named as `accountName` gives it. The refused parts of one row
 * share a sentence that counts them, and so do the refused parts whose row cannot be read, so no two sentences read the same.
 */
export function itemsMoveBlockerLines(blockers: readonly ItemsMoveBlocker[], accountName: (account: string) => string, said: typeof words = words): readonly ItemsMoveBlockerLine[] {
  const refusedByRow = new Map<string, Extract<ItemsMoveBlocker, { kind: 'refused-part' }>[]>()
  blockers.forEach((blocker) => {
    if (blocker.kind !== 'refused-part') return
    const key = rowKey(blocker)
    refusedByRow.set(key, [...(refusedByRow.get(key) ?? []), blocker])
  })
  return blockers.flatMap((blocker): ItemsMoveBlockerLine[] => {
    switch (blocker.kind) {
      case 'unreadable-row':
        return [{ text: said.itemsMove.unreadableRow(blocker.label), count: 1 }]
      case 'refused-part': {
        const ofRow = refusedByRow.get(rowKey(blocker)) ?? []
        if (ofRow[0] !== blocker) return []
        const count = ofRow.length
        const text = blocker.row === null ? said.itemsMove.refusedParts(count) : said.itemsMove.refusedPartsOfRow(count, accountName(blocker.row.account), dayLabel(blocker.row.date))
        return [{ text: plural(text, count), count }]
      }
      case 'kept-whole':
        return [{ text: said.itemsMove.keptWhole(accountName(blocker.row.account), dayLabel(blocker.row.date)), count: 1 }]
      case 'zero-row':
        return [{ text: said.itemsMove.zeroRow(accountName(blocker.row.account), dayLabel(blocker.row.date)), count: 1 }]
    }
  })
}

/** The row a refused part belongs to as a key, the same for every part whose row cannot be read. */
function rowKey({ row }: Extract<ItemsMoveBlocker, { kind: 'refused-part' }>): string {
  return row === null ? '' : `${row.account}\u0000${row.date}`
}
