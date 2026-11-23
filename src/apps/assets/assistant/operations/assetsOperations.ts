import { proposalGroupsOf } from './proposalLines'
import { acceptingBrowserFileCards, withBrowserFileCards } from '../../../../shared/app/browserFileCards'
import type { BrowserFile } from '../../../../shared/app/browserFileCards'
import { ASSET_SHARE_WRITES, ASSET_WRITES, VALUATION_WRITES, newAsset, newAssetShare, newValuation, removeAsset } from '../../asset/application/assetWrites'
import { shareChangeErrors } from '../../asset/presentation/words'
import { typedAssetTerms } from '../../asset/presentation/assetTexts'
import type { AssetTexts } from '../../asset/presentation/assetTexts'
import { loanChoices, loanReasonOf } from '../../asset/presentation/loanChoices'
import { typedValuationTerms } from '../../asset/presentation/valuationTexts'
import type { ValuationTexts } from '../../asset/presentation/valuationTexts'
import type { LoansOnScreen } from '../../loans/application/assetLoans'
import { ASSET_KINDS, HOUSE_REGIONS } from '../../workbook/domain/asset'
import type { Asset, AssetKind } from '../../workbook/domain/asset'
import { ASSET_RECORDS, ASSET_SHARE_RECORDS, VALUATION_RECORDS } from '../../workbook/domain/assetKinds'
import type { AssetShare } from '../../workbook/domain/assetShare'
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
import { writtenPercent } from '../../../../shared/money/percent'
import type { Percent } from '../../../../shared/money/percent'
import { typedPartChange } from '../../../../shared/money/yourPart'
import type { PartChange, PartChangeTexts } from '../../../../shared/money/yourPart'
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
      "Something you own. kind is home (a flat or house), car or other. bought is the day it was bought, and price what was paid, in euros and above zero, which needs bought. region is a home's region for the house price index and firstRegistration a car's, for the customs table. loan is the name of a bank loan Loans lists that no other asset names. share is your part in percent when you own it with others, such as 50, or null when it is all yours. A field you have nothing for is null. Valuations go as add-valuation, and a later change of your part as add-asset-share.",
    input: inputOf({
      name: TEXT,
      kind: KIND,
      bought: TEXT_OR_NULL,
      price: NUMBER_OR_NULL,
      region: { type: ['string', 'null'], description: `${HOUSE_REGIONS.join(', ')}, or null for no region.` },
      firstRegistration: TEXT_OR_NULL,
      loan: TEXT_OR_NULL,
      share: NUMBER_OR_NULL,
      note: TEXT,
    }),
    refs: {},
    creates: ASSET_RECORDS.name,
    alone: false,
    example: { name: 'Car', kind: 'car', bought: '2024-05-10', price: 20000, region: null, firstRegistration: '2024-05-10', loan: 'Car loan', share: null, note: '' },
  },
  {
    name: 'change-asset',
    about:
      'Fixes an asset. Null leaves a field as it is. bought, region, firstRegistration and loan take none to take what they hold off, and price 0 does. Changing kind drops a region or first registration the new kind does not take. loan is the name of a bank loan Loans lists that no other asset names. share is your part from the day it was bought in percent, and 100 makes it all yours. A later change of your part goes as add-asset-share.',
    input: inputOf({
      asset: TEXT,
      name: TEXT_OR_NULL,
      kind: choiceOrNull(ASSET_KINDS),
      bought: DAY_OR_NONE_OR_NULL,
      price: NUMBER_OR_NULL,
      region: { type: ['string', 'null'], description: `${HOUSE_REGIONS.join(', ')}, none for no region, or null to leave it.` },
      firstRegistration: DAY_OR_NONE_OR_NULL,
      loan: NONE_OR_NULL,
      share: NUMBER_OR_NULL,
      note: TEXT_OR_NULL,
    }),
    refs: { asset: ASSET_RECORDS.name },
    creates: null,
    alone: false,
    example: { asset: 'asset-home', name: 'Renamed flat', kind: null, bought: null, price: null, region: 'adriatic', firstRegistration: null, loan: 'none', share: 50, note: 'Checked' },
  },
  {
    name: 'delete-asset',
    about: 'Deletes an asset with its valuations and the changes of your part of it.',
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
  {
    name: 'add-asset-share',
    about:
      'Your part of an asset you own with others from a day on, in percent above 0 and at most 100, such as 100 once you buy out the other owner. The day is not before the asset was bought, and no other change of it is from that day. Your part from the day it was bought is the share of change-asset.',
    input: inputOf({ asset: TEXT, from: TEXT, share: NUMBER, note: TEXT }),
    refs: { asset: ASSET_RECORDS.name },
    creates: null,
    alone: false,
    example: { asset: 'asset-home', from: '2026-03-01', share: 100, note: 'Bought out my brother' },
  },
  {
    name: 'change-asset-share',
    about: 'Fixes a change of your part. Null leaves a field as it is.',
    input: inputOf({ shareChange: TEXT, from: TEXT_OR_NULL, share: NUMBER_OR_NULL, note: TEXT_OR_NULL }),
    refs: { shareChange: ASSET_SHARE_RECORDS.name },
    creates: null,
    alone: false,
    example: { shareChange: 'asset-share', from: null, share: 75, note: null },
  },
  {
    name: 'delete-asset-share',
    about: 'Deletes a change of your part, so the part before it holds on.',
    input: inputOf({ shareChange: TEXT }),
    refs: { shareChange: ASSET_SHARE_RECORDS.name },
    creates: null,
    alone: false,
    example: { shareChange: 'asset-share' },
  },
]

/** A part a step names in percent, kept as it is for null. A part of 100 the asset terms keep as all of it. */
function partText(named: number | null, kept: Percent | undefined): string {
  if (named === null) return kept === undefined ? '' : String(writtenPercent(kept))
  return String(named)
}

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
  const free = loanChoices(loans, taken, editing).filter((choice) => choice.label === named)
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
    region: region === null ? (before?.region ?? '') : region === NONE ? '' : (choiceOf(HOUSE_REGIONS, region, 'region') ?? ''),
    firstRegistration: dayText(firstRegistration, before?.firstRegistration ?? null),
    share: partText(field['share'] as number | null, before?.share),
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

/** The day and part the fields give for a change of the asset's part, through the share dialog's own check. */
function shareTermsOf(texts: PartChangeTexts, entry: AssetWithValuations, editing: AssetShare | null): PartChange {
  const typed = typedPartChange(texts, entry.asset.bought, entry.shares, editing?.id ?? null)
  refuseOnErrors(shareChangeErrors(typed.faults))
  return typed.change!
}

/** Plans the steps into one write, in order, through the screens' own write functions. A `$` name stands for an asset an earlier step added. */
function planned(unit: UnitOfWork, { workbook, records }: OpenBooks<AssetsBooks>, steps: readonly ProposalStep[], loans: LoansOnScreen): void {
  const made = new Map<string, string>()
  const addedAssets: Asset[] = []
  const addedValuations: Valuation[] = []
  const addedShares: AssetShare[] = []
  const changedAssets = new Map<string, Asset>()
  const idOf = (value: unknown): string => {
    const text = String(value)
    return made.get(text) ?? text
  }
  const taken = () => ({
    assets: [
      ...workbook.assets.map((entry) => ({ ...entry, asset: changedAssets.get(entry.asset.id) ?? entry.asset })),
      ...addedAssets.map((asset) => ({ asset, valuations: [], shares: [], loanShared: false })),
    ],
  })
  const storedAssetOf = (value: unknown): Asset => {
    const id = idOf(value)
    if (addedAssets.some((asset) => asset.id === id)) throw new StepRefused('Change an asset added on this card on a later card.')
    return found(workbook.readings.assets.facts, id, 'asset')
  }
  const entryOf = (value: unknown): AssetWithValuations => {
    const id = idOf(value)
    const added = addedAssets.find((asset) => asset.id === id)
    const base = workbook.assets.find((entry) => entry.asset.id === id) ?? (added === undefined ? undefined : { asset: added, valuations: [], shares: [], loanShared: false })
    if (base === undefined) throw new StepRefused('That asset is no longer in the file.')
    return {
      ...base,
      valuations: [...base.valuations, ...addedValuations.filter((valuation) => valuation.asset === id)],
      shares: [...base.shares, ...addedShares.filter((change) => change.asset === id)],
    }
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
      case 'add-asset-share': {
        const entry = entryOf(field['asset'])
        const terms = shareTermsOf({ from: field['from'], share: String(field['share']) }, entry, null)
        const change = newAssetShare({ asset: entry.asset.id, ...terms, note: field['note'] })
        unit.of(ASSET_SHARE_WRITES).add(change)
        addedShares.push(change)
        break
      }
      case 'change-asset-share': {
        const before = found(workbook.readings.assetShares.facts, idOf(field['shareChange']), 'change of your part')
        const texts = { from: (field['from'] as string | null) ?? before.from, share: partText(field['share'] as number | null, before.share) }
        const terms = shareTermsOf(texts, entryOf(before.asset), before)
        unit.of(ASSET_SHARE_WRITES).change(before, { ...before, ...terms, note: ((field['note'] as string | null) ?? before.note).trim() })
        break
      }
      case 'delete-asset-share':
        unit.of(ASSET_SHARE_WRITES).remove(found(workbook.readings.assetShares.facts, idOf(field['shareChange']), 'change of your part'))
        break
      default:
        throw new StepRefused('There is no such operation.')
    }
  }
}

type AssetsStore = Pick<WorkbookStore<AssetsBooks>, 'state' | 'check' | 'write' | 'undo'>

/** How the chat's steps become one write of the Assets file, with the bank loans Loans lists on the day, which the card reads as the plan read them. */
function assetsWork(appName: string, loans: () => LoansOnScreen): ProposalWork<AssetsBooks, never, LoansOnScreen> {
  return {
    appName,
    plan: (unit, books, steps) => {
      const onScreen = loans()
      planned(unit, books, steps, onScreen)
      return onScreen
    },
    card: (checked, { workbook }, onScreen) => ({ groups: proposalGroupsOf(checked, workbook, onScreen), outside: [], heldBack: null }),
  }
}

/** The changes the chat can propose and their dry run, over the app's own store and the Loans it reads, which `app.ts` hands in. */
export function assetsProposer(store: AssetsStore, loans: () => LoansOnScreen, file: BrowserFile): AppProposer {
  return withBrowserFileCards({ operations: ASSETS_OPERATIONS, readsBooks: true, check: proposedWrites(store, assetsWork(file.appName, loans)).check }, file)
}

/** Writes a proposal as it was checked, in one write with one Undo. A record changed since refuses this proposal alone. */
export function assetsAcceptance(store: AssetsStore, loans: () => LoansOnScreen, file: BrowserFile): AppAcceptance {
  return acceptingBrowserFileCards({ accept: proposedWrites(store, assetsWork(file.appName, loans)).accept }, file)
}
