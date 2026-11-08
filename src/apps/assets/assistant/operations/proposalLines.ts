import { words as assetWords } from '../../asset/presentation/words'
import { words as valueWords } from '../../values/presentation/words'
import type { LoansOnScreen } from '../../values/presentation/assetsOnDay'
import type { Asset } from '../../workbook/domain/asset'
import { ASSET_RECORDS, VALUATION_RECORDS } from '../../workbook/domain/assetKinds'
import type { AssetBook } from '../../workbook/domain/readAssetBook'
import type { Valuation } from '../../workbook/domain/valuation'
import { words as assetsWords } from '../../words'
import type { ProposalGroup } from '../../../../shared/app/assistantOperations'
import { proposalGroups } from '../../../../shared/app/proposalGroups'
import type { ProposalDescriber, ProposedRecord } from '../../../../shared/app/proposalGroups'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import type { CheckedWrite } from '../../../../shared/storage/application/recordWrites'

/** The fields Kuna keeps by itself, which no operation sets, so a card leaves them off. */
export const KEPT_BY_KUNA: ReadonlySet<string> = new Set(['id'])

const DAY_FIELDS: ReadonlySet<string> = new Set(['bought', 'firstRegistration', 'date'])

/** The amount a field holds, for a field that holds one. */
function moneyIn(field: string, record: ProposedRecord): Money | null {
  if (field === 'price') return (record as Pick<Asset, 'price'>).price
  if (field === 'value') return (record as Pick<Valuation, 'value'>).value
  return null
}

/** A field's name on the card, as the dialog that sets it names it. */
export const FIELD_NAMES: Readonly<Record<string, string>> = {
  name: assetWords.assetDialog.name,
  kind: assetWords.assetDialog.kind,
  bought: assetWords.assetDialog.bought,
  price: assetWords.assetDialog.price,
  region: assetWords.assetDialog.region,
  firstRegistration: assetWords.assetDialog.firstRegistration,
  loan: assetWords.assetDialog.loan,
  note: assetsWords.form.note,
  asset: assetWords.asset,
  date: assetWords.valuationDialog.date,
  value: assetWords.valuationDialog.value,
}

/** What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's. A loan shows by the name Loans lists it under. */
export function proposalGroupsOf(checked: CheckedWrite, book: AssetBook, loans: LoansOnScreen): readonly ProposalGroup[] {
  const namesOf = new Map<unknown, string>(book.readings.assets.facts.map((asset) => [asset.id, asset.name]))
  for (const { change } of checked.changes) {
    if ((change.verb === 'add' || change.verb === 'change') && change.kind.name === ASSET_RECORDS.name)
      namesOf.set((change.after as ProposedRecord)['id'], (change.after as ProposedRecord)['name'] as string)
  }
  for (const loan of Array.isArray(loans) ? loans : []) namesOf.set(loan.key, loan.name)
  const describer: ProposalDescriber = {
    keptByKuna: KEPT_BY_KUNA,
    fieldName: (field) => FIELD_NAMES[field] ?? field,
    shown: (_kind, field, record) => {
      const value = record[field]
      if (value === null || value === undefined || value === '') return null
      if (field === 'kind') return valueWords.kinds[value as keyof typeof valueWords.kinds]
      if (field === 'region') return valueWords.regions[value as keyof typeof valueWords.regions]
      const money = moneyIn(field, record)
      if (money !== null) return formatMoney(money)
      if (DAY_FIELDS.has(field)) return dayLabel(value as CivilDate)
      return namesOf.get(value) ?? String(value)
    },
    label: (kind, record, fallback) =>
      kind.name === VALUATION_RECORDS.name ? (namesOf.get(record['asset']) ?? fallback) : typeof record['name'] === 'string' && record['name'] !== '' ? record['name'] : fallback,
    warns: () => false,
  }
  return proposalGroups(checked, () => describer)
}
