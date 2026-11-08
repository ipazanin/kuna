import { proposalGroupsOf } from './proposalLines'
import { ASSET_WRITES, VALUATION_WRITES, newAsset, newValuation, removeAsset } from '../../asset/application/assetWrites'
import { NO_REGION, typedAssetTerms } from '../../asset/presentation/assetTexts'
import type { AssetTexts } from '../../asset/presentation/assetTexts'
import { NO_LOAN, loanChoices, loanReasonOf } from '../../asset/presentation/loanChoices'
import { typedValuationTerms } from '../../asset/presentation/valuationTexts'
import type { ValuationTexts } from '../../asset/presentation/valuationTexts'
import type { LoansOnScreen } from '../../values/presentation/assetsOnDay'
import { ASSET_KINDS, HOUSE_REGIONS } from '../../workbook/domain/asset'
import type { Asset, AssetKind } from '../../workbook/domain/asset'
import { ASSET_RECORDS, VALUATION_RECORDS } from '../../workbook/domain/assetKinds'
import type { AssetsBooks } from '../../workbook/domain/assetsBooks'
import type { AssetBook, AssetWithValuations } from '../../workbook/domain/readAssetBook'
import type { Valuation } from '../../workbook/domain/valuation'
import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, found, inputOf } from '../../../../shared/app/operationInput'
import { amountText, choiceOrNull, refuseOnErrors } from '../../../../shared/app/operationTexts'
import type { AppAcceptance, AppProposer, AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused, proposedWrites } from '../../../../shared/app/proposedWrites'
import type { OpenBooks, ProposalWork } from '../../../../shared/app/proposedWrites'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What a step writes to take a day, a region, a first registration or a loan off an asset. */
const NONE = 'none'

const KIND = { type: 'string', enum: [...ASSET_KINDS] } as const
const NONE_OR_NULL = { type: ['string', 'null'], description: 'none to take it off, or null to leave it.' } as const
const DAY_OR_NONE_OR_NULL = { type: ['string', 'null'], description: 'A day such as 2026-10-31, none to take it off, or null to leave it.' } as const

type Fields = Readonly<Record<string, never>>

/** Every change the chat can propose in Assets. Each calls the write functions and checks the screens use. */
export const ASSETS_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-asset',
    about:
      "Something you own. kind is home (a flat or house), car or other. bought is the day it was bought, and price what was paid, in euros and above zero, which needs bought. region is a home's region for the house price index and firstRegistration a car's, for the customs table. loan is the name of a bank loan Loans lists that no other asset names. A field you have nothing for is null. Valuations go as add-valuation.",
    input: inputOf({
      name: TEXT,
      kind: KIND,
      bought: TEXT_OR_NULL,
      price: NUMBER_OR_NULL,
      region: { type: ['string', 'null'], description: `${HOUSE_REGIONS.join(', ')}, or null for no region.` },
      firstRegistration: TEXT_OR_NULL,
      loan: TEXT_OR_NULL,
      note: TEXT,
    }),
    refs: {},
    creates: ASSET_RECORDS.name,
    alone: false,
    example: { name: 'Car', kind: 'car', bought: '2024-05-10', price: 20000, region: null, firstRegistration: '2024-05-10', loan: 'Car loan', note: '' },
  },
  {
    name: 'change-asset',
    about:
      'Fixes an asset. Null leaves a field as it is. bought, region, firstRegistration and loan take none to take what they hold off, and price 0 does. Changing kind drops a region or first registration the new kind does not take. loan is the name of a bank loan Loans lists that no other asset names.',
    input: inputOf({
      asset: TEXT,
      name: TEXT_OR_NULL,
      kind: choiceOrNull(ASSET_KINDS),
      bought: DAY_OR_NONE_OR_NULL,
      price: NUMBER_OR_NULL,
      region: { type: ['string', 'null'], description: `${HOUSE_REGIONS.join(', ')}, none for no region, or null to leave it.` },
      firstRegistration: DAY_OR_NONE_OR_NULL,
      loan: NONE_OR_NULL,
      note: TEXT_OR_NULL,
    }),
    refs: { asset: ASSET_RECORDS.name },
    creates: null,
    alone: false,
    example: { asset: 'asset-home', name: 'Renamed flat', kind: null, bought: null, price: null, region: 'adriatic', firstRegistration: null, loan: 'none', note: 'Checked' },
  },
  {
    name: 'delete-asset',
    about: 'Deletes an asset with its valuations.',
    input: inputOf({ asset: TEXT }),
    refs: { asset: ASSET_RECORDS.name },
    creates: null,
    alone: false,
    example: { asset: 'asset-home' },
  },
  {
    name: 'add-valuation',
    about: 'What an asset was worth on a day, in euros and zero or more, as you typed it. The day is not before the asset was bought, and no other valuation of it is on that day.',
    input: inputOf({ asset: TEXT, date: TEXT, value: NUMBER, note: TEXT }),
    refs: { asset: ASSET_RECORDS.name },
    creates: null,
    alone: false,
    example: { asset: 'asset-home', date: '2026-06-01', value: 160000, note: '' },
  },
  {
    name: 'change-valuation',
    about: 'Fixes a valuation. Null leaves a field as it is.',
    input: inputOf({ valuation: TEXT, date: TEXT_OR_NULL, value: NUMBER_OR_NULL, note: TEXT_OR_NULL }),
    refs: { valuation: VALUATION_RECORDS.name },
    creates: null,
    alone: false,
    example: { valuation: 'valuation', date: null, value: 170000, note: null },
  },
  {
    name: 'delete-valuation',
    about: 'Deletes a valuation.',
    input: inputOf({ valuation: TEXT }),
    refs: { valuation: VALUATION_RECORDS.name },
    creates: null,
    alone: false,
    example: { valuation: 'valuation' },
  },
]

/** A day a step names, kept as it is for null, or taken off for none. */
function dayText(named: string | null, kept: CivilDate | null): string {
  return named === null ? (kept ?? '') : named === NONE ? '' : named
}

/** The bank loan a step names by the name Loans lists it under, through the asset dialog's own choices, or the loan it has for null. */
function loanOf(named: string | null, kept: string | null, loans: LoansOnScreen, taken: Pick<AssetBook, 'assets'>, editing: Asset | null): string | null {
  if (named === null) return kept
  const reason = loanReasonOf(loans)
  if (reason !== '') throw new StepRefused(`${reason}.`)
  if (named === NONE) return null
  const free = loanChoices(loans, taken, editing).filter((choice) => choice.value !== NO_LOAN && choice.label === named)
  if (free.length === 0) throw new StepRefused(`${named} is not a bank loan Loans lists that no other asset names.`)
  if (free.length > 1) throw new StepRefused(`More than one bank loan in Loans is called ${named}. Rename one in Loans first.`)
  return free[0]!.value
}

/** The asset the fields give over what it had, through the asset dialog's own check, with its loan picked as the dialog picks it. */
function assetOf(field: Fields, before: Asset | null, loans: LoansOnScreen, taken: Pick<AssetBook, 'assets'>): Omit<Asset, 'id'> {
  const kind: AssetKind | undefined = choiceOf(ASSET_KINDS, field['kind'], 'kind') ?? before?.kind
  if (kind === undefined) throw new StepRefused(`kind is one of ${ASSET_KINDS.join(', ')}.`)
  const [region, firstRegistration] = [field['region'] as string | null, field['firstRegistration'] as string | null]
  if (region !== null && region !== NONE && kind !== 'home') throw new StepRefused('A region is for a home.')
  if (firstRegistration !== null && firstRegistration !== NONE && kind !== 'car') throw new StepRefused('A first registration is for a car.')
  const price = field['price'] as number | null
  const texts: AssetTexts = {
    name: (field['name'] as string | null) ?? before?.name ?? '',
    kind,
    bought: dayText(field['bought'], before?.bought ?? null),
    price: price === null ? (before?.price != null ? plainAmount(before.price) : '') : before !== null && price === 0 ? '' : amountText(price),
    region: region === null ? (before?.region ?? NO_REGION) : region === NONE ? NO_REGION : (choiceOf(HOUSE_REGIONS, region, 'region') ?? NO_REGION),
    firstRegistration: dayText(firstRegistration, before?.firstRegistration ?? null),
  }
  const typed = typedAssetTerms(texts)
  refuseOnErrors(typed.errors)
  const loan = loanOf(field['loan'], before?.loan ?? null, loans, taken, before)
  return { ...typed.terms!, loan, note: (field['note'] as string | null) ?? before?.note ?? '' }
}

/** The day and value the fields give for a valuation of the asset, through the valuation dialog's own check. */
function valuationTermsOf(texts: ValuationTexts, entry: AssetWithValuations, editing: Valuation | null): { readonly date: CivilDate; readonly value: Valuation['value'] } {
  const typed = typedValuationTerms(texts, { bought: entry.asset.bought, valuations: entry.valuations, editing: editing?.id ?? null })
  refuseOnErrors(typed.errors)
  return typed.terms!
}

/** Plans the steps into one write, in order, through the screens' own write functions. A `$` name stands for an asset an earlier step added. */
function planned(unit: UnitOfWork, { workbook, records }: OpenBooks<AssetsBooks>, steps: readonly ProposalStep[], loans: LoansOnScreen): void {
  const made = new Map<string, string>()
  const addedAssets: Asset[] = []
  const addedValuations: Valuation[] = []
  const changedAssets = new Map<string, Asset>()
  const idOf = (value: unknown): string => {
    const text = String(value)
    return made.get(text) ?? text
  }
  const taken = () => ({
    assets: [...workbook.assets.map((entry) => ({ ...entry, asset: changedAssets.get(entry.asset.id) ?? entry.asset })), ...addedAssets.map((asset) => ({ asset, valuations: [], loanShared: false }))],
  })
  const storedAssetOf = (value: unknown): Asset => {
    const id = idOf(value)
    if (addedAssets.some((asset) => asset.id === id)) throw new StepRefused('Change an asset added on this card on a later card.')
    return found(workbook.readings.assets.facts, id, 'asset')
  }
  const entryOf = (value: unknown): AssetWithValuations => {
    const id = idOf(value)
    const added = addedAssets.find((asset) => asset.id === id)
    const base = workbook.assets.find((entry) => entry.asset.id === id) ?? (added === undefined ? undefined : { asset: added, valuations: [], loanShared: false })
    if (base === undefined) throw new StepRefused('That asset is no longer in the file.')
    return { ...base, valuations: [...base.valuations, ...addedValuations.filter((valuation) => valuation.asset === id)] }
  }

  for (const { operation, input, as } of steps) {
    // The chat checked the input against this operation's schema, so each field has the type the schema gives it.
    const field = input as Fields
    switch (operation) {
      case 'add-asset': {
        const asset = newAsset(assetOf(field, null, loans, taken()))
        unit.of(ASSET_WRITES).add(asset)
        addedAssets.push(asset)
        if (as !== null) made.set(as, asset.id)
        break
      }
      case 'change-asset': {
        const before = storedAssetOf(field['asset'])
        const after = { ...newAsset(assetOf(field, before, loans, taken())), id: before.id }
        unit.of(ASSET_WRITES).change(before, after)
        changedAssets.set(before.id, after)
        break
      }
      case 'delete-asset':
        removeAsset(unit, records, storedAssetOf(field['asset']))
        break
      case 'add-valuation': {
        const entry = entryOf(field['asset'])
        const terms = valuationTermsOf({ date: field['date'], value: amountText(field['value']) }, entry, null)
        const valuation = newValuation({ asset: entry.asset.id, ...terms, note: field['note'] })
        unit.of(VALUATION_WRITES).add(valuation)
        addedValuations.push(valuation)
        break
      }
      case 'change-valuation': {
        const before = found(workbook.readings.valuations.facts, idOf(field['valuation']), 'valuation')
        const value = field['value'] as number | null
        const texts = { date: (field['date'] as string | null) ?? before.date, value: value === null ? plainAmount(before.value) : amountText(value) }
        const terms = valuationTermsOf(texts, entryOf(before.asset), before)
        unit.of(VALUATION_WRITES).change(before, { ...before, ...terms, note: ((field['note'] as string | null) ?? before.note).trim() })
        break
      }
      case 'delete-valuation':
        unit.of(VALUATION_WRITES).remove(found(workbook.readings.valuations.facts, idOf(field['valuation']), 'valuation'))
        break
      default:
        throw new StepRefused('There is no such operation.')
    }
  }
}

type AssetsStore = Pick<WorkbookStore<AssetsBooks>, 'state' | 'check' | 'write' | 'undo'>

/** How the chat's steps become one write of the Assets file, with the bank loans Loans lists on the day. */
function assetsWork(loans: () => LoansOnScreen): ProposalWork<AssetsBooks, never> {
  return {
    notOpen: 'The Assets file is not open on this device.',
    plan: (unit, books, steps) => planned(unit, books, steps, loans()),
    groups: (checked, { workbook }) => proposalGroupsOf(checked, workbook, loans()),
  }
}

/** The changes the chat can propose and their dry run, over the app's own store and the Loans it reads, which `app.ts` hands in. */
export function assetsProposer(store: AssetsStore, loans: () => LoansOnScreen): AppProposer {
  return { operations: ASSETS_OPERATIONS, readsBooks: true, check: proposedWrites(store, assetsWork(loans)).check }
}

/** Writes a proposal as it was checked, in one write with one Undo. A record changed since refuses this proposal alone. */
export function assetsAcceptance(store: AssetsStore, loans: () => LoansOnScreen): AppAcceptance {
  return { accept: proposedWrites(store, assetsWork(loans)).accept }
}
