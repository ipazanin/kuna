import { assetsAcceptance, assetsProposer } from '../../src/apps/assets/assistant/operations/assetsOperations'
import { FILE_OPEN } from './browserFile'
import { ASSET_WRITES, VALUATION_WRITES } from '../../src/apps/assets/asset/application/assetWrites'
import type { AssetLoan } from '../../src/apps/assets/loans/application/assetLoans'
import type { Asset } from '../../src/apps/assets/workbook/domain/asset'
import { ASSET_RECORDS, VALUATION_RECORDS } from '../../src/apps/assets/workbook/domain/assetKinds'
import type { AssetsBooks } from '../../src/apps/assets/workbook/domain/assetsBooks'
import type { Valuation } from '../../src/apps/assets/workbook/domain/valuation'
import { emptyAssetsDocument } from '../../src/apps/assets/workbook/infrastructure/assetsDocument'
import type { ChatReads } from '../../src/shared/ai/application/chatReads'
import { proposeChanges } from '../../src/shared/ai/application/chatProposals'
import { chatRefs } from '../../src/shared/ai/domain/chatRefs'
import type { CheckedProposal } from '../../src/shared/app/assistantOperations'
import { newPseudonyms } from '../../src/shared/privacy/domain/pseudonyms'
import type { WorkbookStore } from '../../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'
import { civil, euros } from './ledger'
import { ASSETS, browserHarness } from './writeBack'

export const HOME_LOAN_KEY = '0b6f3c1e-5d2a-4e8f-9a71-3c4d5e6f7a80'
export const CAR_LOAN_KEY = '1c7a4d2f-6e3b-4f90-8b82-4d5e6f7a8b91'

/** The bank loans Loans lists beside the desk: the home loan, which the flat names, and a car loan no asset names. */
export const DESK_LOANS: readonly AssetLoan[] = [
  { key: HOME_LOAN_KEY, name: 'Home loan', owed: euros(120_000), to: '/loans/bank-loan' },
  { key: CAR_LOAN_KEY, name: 'Car loan', owed: euros(8_000), to: '/loans/bank-loan' },
]

/** A flat in the City of Zagreb bought on 2025-03-15 for 200,000.00 with the home loan on it. */
const FLAT: Asset = {
  id: recordIdOf(ASSET_RECORDS, 'asset-home'),
  name: 'Flat in Zagreb',
  kind: 'home',
  bought: civil('2025-03-15'),
  price: euros(200_000),
  region: 'zagreb',
  firstRegistration: null,
  loan: HOME_LOAN_KEY,
  note: '',
}

/** A boat bought on 2022-06-01 for 18,000.00, with no loan. */
const BOAT: Asset = {
  id: recordIdOf(ASSET_RECORDS, 'asset-boat'),
  name: 'Sailing boat',
  kind: 'other',
  bought: civil('2022-06-01'),
  price: euros(18_000),
  region: null,
  firstRegistration: null,
  loan: null,
  note: '',
}

/** The marina's guess of the boat on 2026-05-01. */
const VALUATION: Valuation = { id: recordIdOf(VALUATION_RECORDS, 'valuation'), asset: BOAT.id, date: civil('2026-05-01'), value: euros(15_500), note: '' }

/** The record each operation's example names, by the name it gives it. */
export const EXAMPLE_RECORDS: Readonly<Record<string, string>> = {
  'asset-home': FLAT.id,
  'asset-boat': BOAT.id,
  valuation: VALUATION.id,
}

/** An Assets file where every operation's example has what it needs, with the chat's refs and the cards it was shown. */
export interface AssetsDesk {
  readonly store: WorkbookStore<AssetsBooks>
  readonly cards: CheckedProposal[]
  ref(kind: string, id: string): string
  propose(steps: readonly { readonly op: string; readonly input: unknown; readonly as?: string }[]): ReturnType<typeof proposeChanges>
  accept(at?: number): ReturnType<ReturnType<typeof assetsAcceptance>['accept']>
}

export async function assetsDesk(used: Set<string>, loans: () => AssetLoan[] | 'opening' | 'failed' | null = () => [...DESK_LOANS]): Promise<AssetsDesk> {
  const { store: harnessed } = await browserHarness(used, emptyAssetsDocument('2026-11-07T09:00:00.000Z'), ASSETS)
  const store = harnessed as unknown as WorkbookStore<AssetsBooks>
  await store.write('The desk', (unit) => {
    unit.of(ASSET_WRITES).add(FLAT)
    unit.of(ASSET_WRITES).add(BOAT)
    unit.of(VALUATION_WRITES).add(VALUATION)
  })
  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: () => true }
  const cards: CheckedProposal[] = []
  const proposers = new Map([['assets', assetsProposer(store, loans, FILE_OPEN)]])
  return {
    store,
    cards,
    ref: (kind, id) => reads.refs.recordRef({ app: 'assets', kind, id }),
    propose: (steps) =>
      proposeChanges(
        { app: 'assets', title: 'A title', steps: steps.map((step) => ({ op: step.op, input: JSON.stringify(step.input), as: step.as ?? null })), next: false },
        proposers,
        reads,
        [],
        (_app, card) => cards.push(card),
      ),
    accept: (at = cards.length - 1) => assetsAcceptance(store, loans, FILE_OPEN).accept(cards[at]!),
  }
}
