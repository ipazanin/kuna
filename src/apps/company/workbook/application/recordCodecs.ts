import { installedPack } from '../../packs/packContribution'
import { RULE_CODEC } from '../../rules/domain/readRules'
import { settingCodec } from '../../settings/domain/settings'
import { ACCOUNT_CODEC } from '../domain/accountsReading'
import { BILLING_CODEC } from '../domain/billingPlanReading'
import { CATEGORY_CODEC } from '../domain/categoriesReading'
import { CLIENT_CODEC } from '../domain/clientsReading'
import { DISMISSAL_CODEC } from '../domain/dismissalsReading'
import { INVOICE_CODEC } from '../domain/invoicesReading'
import { LEDGER_CODEC } from '../domain/ledgerReading'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { SPLIT_PART_CODEC } from '../domain/splitsReading'

const CORE_CODECS = [
  LEDGER_CODEC,
  CATEGORY_CODEC,
  ACCOUNT_CODEC,
  settingCodec(() => installedPack().workbook?.settings ?? null),
  RULE_CODEC,
  INVOICE_CODEC,
  CLIENT_CODEC,
  BILLING_CODEC,
  SPLIT_PART_CODEC,
  DISMISSAL_CODEC,
] as readonly RecordCodec<unknown>[]

/** How every kind is stored: core's kinds, then the installed pack's. */
function installedCodecs(): readonly RecordCodec<unknown>[] {
  return [...CORE_CODECS, ...(installedPack().workbook?.codecs ?? [])]
}

/** The codec of a kind, core's or the installed pack's. Throws for a kind nothing stores. */
export function codecOfKind<R>(kind: RecordKind<R>): RecordCodec<R> {
  const codec = installedCodecs().find((candidate) => candidate.kind.name === kind.name)
  if (codec === undefined) {
    throw new Error(`Nothing stores ${kind.noun.many}.`)
  }
  return codec as RecordCodec<R>
}
