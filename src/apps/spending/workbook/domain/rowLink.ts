import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/**
 * The record in another app that a row is, such as a bank loan's instalment or an informal loan in Loans: the app, the kind
 * of record and its key as that app keeps them, and for an instalment its due date. Whether the app still has it is known only on screen.
 */
export interface RowLink {
  readonly app: string
  readonly kind: string
  readonly key: string
  readonly due: CivilDate | null
}

const NAME = /^[a-z][a-z0-9.-]*$/
const KEY = /^[^/\s]+$/

/** The link a row's `link` field names as app/kind/key, with /due after it for an instalment, or null for text of another shape. */
export function rowLinkOf(text: string): RowLink | null {
  const [app = '', kind = '', key = '', dueText, ...rest] = text.split('/')
  const due = dueText === undefined ? null : parseCivilDate(dueText)
  if (!NAME.test(app) || !NAME.test(kind) || !KEY.test(key) || (dueText !== undefined && due === null) || rest.length > 0) return null
  return { app, kind, key, due }
}

/** The link as the row's `link` field keeps it. */
export function rowLinkText(link: RowLink): string {
  return [link.app, link.kind, link.key, ...(link.due === null ? [] : [link.due])].join('/')
}
