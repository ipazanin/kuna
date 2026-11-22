import { sourceOn, takesOrigin } from '../../../../shared/app/accountSource'
import type { RowOrigin } from '../../../../shared/app/accountSource'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { BY_HAND_SOURCES } from '../../workbook/domain/workbook'
import type { CompanyPeriod, CompanySource } from '../../workbook/domain/workbook'
import type { ImportedRow, ImportedStatement } from './importedStatement'

/** Where a camt statement comes from: the bank's statement mail, which each sync reads, or a file the person brings. */
export type CamtOrigin = Extract<RowOrigin, 'automation' | 'provider-file'>

/** Why an account does not take a statement's new rows from where they came. */
export type IntakeRefusal =
  /** A new row falls on a day whose period takes its rows from another source. */
  | { readonly kind: 'other-source'; readonly account: string; readonly day: CivilDate; readonly source: CompanySource; readonly origin: RowOrigin }
  /** A new row falls before the account's first period, on a day it takes no row. */
  | { readonly kind: 'before-start'; readonly account: string; readonly startsOn: CivilDate; readonly first: CivilDate }

/** Where a statement's rows come from: the mail or the person's file for a camt statement, and by hand for a sheet or a copied one. */
export function originOfStatement(statement: Pick<ImportedStatement, 'source'>, camtOrigin: CamtOrigin): RowOrigin {
  return statement.source.kind === 'camt' ? camtOrigin : 'by-hand'
}

/** How a new account's rows come in: from the bank's statement mail from its first statement's day when that statement came from the mail, and by hand otherwise. */
export function newAccountSources(statement: ImportedStatement, firstDay: CivilDate | null, camtOrigin: CamtOrigin): readonly CompanyPeriod[] {
  return originOfStatement(statement, camtOrigin) === 'automation' && firstDay !== null ? [{ source: 'mail', from: firstDay }] : BY_HAND_SOURCES
}

/**
 * Why the account does not take the statement's new rows from where they came, or null when it does. Each row goes only on a
 * day whose period takes its origin: the mail's own statement on a day the mail fills, the bank's camt file on a day the
 * statement file fills, and a sheet or a copied statement on a day kept by hand, which takes a camt file too. No row goes before the first period.
 */
export function intakeRefusal(statement: ImportedStatement, sources: readonly CompanyPeriod[], camtOrigin: CamtOrigin, fresh: readonly ImportedRow[]): IntakeRefusal | null {
  const { account } = statement
  const origin = originOfStatement(statement, camtOrigin)
  for (const row of fresh) {
    const source = sourceOn(sources, row.date)
    if (source === null) return { kind: 'before-start', account, startsOn: sources[0]?.from ?? row.date, first: row.date }
    if (!takesOrigin(source, origin)) return { kind: 'other-source', account, day: row.date, source, origin }
  }
  return null
}
