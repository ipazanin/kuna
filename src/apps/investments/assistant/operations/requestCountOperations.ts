import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { words as pricesWords } from '../../prices/presentation/words'
import { words } from '../words'
import type { AcceptResult, AssistantOperation, CheckedProposal, UndoResult } from '../../../../shared/app/assistantOperations'
import { inputOf } from '../../../../shared/app/operationInput'
import { words as sharedWords } from '../../../../shared/app/words'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import type { SideCards } from './investmentSteps'

/** This browser's requests to each price vendor today, which `app.ts` hands in, read and set as the Prices settings show them. */
export interface RequestCounts {
  today(vendorId: string): number
  set(vendorId: string, count: number): void
}

/** A vendor's count of requests, kept in this browser, as a card counts it. */
const REQUEST_COUNT: RecordNoun = {
  en: { one: 'request count on this device', many: 'request counts on this device', article: 'a' },
  hr: { one: 'broj zahtjeva na ovom uređaju', of: 'broja zahtjeva na ovom uređaju', few: 'broja zahtjeva na ovom uređaju', other: 'brojeva zahtjeva na ovom uređaju', gender: 'masculine' },
}

const RESET_REQUESTS = 'reset-requests-today'

export const REQUEST_COUNT_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: RESET_REQUESTS,
    about: "Sets a price vendor's count of today's requests from this browser back to zero, which Settings, Prices sets against the vendor's daily limit. It changes this device and not the books.",
    input: inputOf({ vendor: { type: 'string', enum: PRICE_VENDORS.map((vendor) => vendor.id) } }),
    refs: {},
    creates: null,
    alone: true,
    example: { vendor: PRICE_VENDORS[0]!.id },
  },
]

/** What Accept of a count card sets, which only this file reads. */
interface HeldCount {
  readonly vendorId: string
  readonly before: number
  readonly after: number
}

function isHeldCount(held: object): held is HeldCount {
  return 'vendorId' in held && 'before' in held && 'after' in held
}

/** A reset of a vendor's count of today's requests. Accept is refused once the count moved since the card, and Undo puts it back while it is still the one the card set. */
export function requestCountCards(counts: RequestCounts): SideCards {
  return {
    operations: REQUEST_COUNT_OPERATIONS,
    check(title, { input }) {
      const vendor = PRICE_VENDORS.find((candidate) => candidate.id === input['vendor'])
      if (vendor === undefined) return Promise.resolve({ refused: [`vendor is one of ${PRICE_VENDORS.map((candidate) => candidate.id).join(', ')}.`] })
      const before = counts.today(vendor.id)
      if (before === 0) return Promise.resolve({ refused: ['Nothing would change, as this browser asked that vendor nothing today.'] })
      const held: HeldCount = { vendorId: vendor.id, before, after: 0 }
      const usage = (count: number): string => pricesWords.usedToday(count, vendor.limits.perDay)
      const line = { label: vendor.name, fields: [{ name: words.cards.requestsToday, before: usage(before), after: usage(held.after), warns: false }], warning: null }
      const card: CheckedProposal = { title, count: 1, groups: [{ verb: 'change', noun: REQUEST_COUNT, notes: [], lines: [line] }], outside: [], undoable: true, heldBack: null, held }
      return Promise.resolve(card)
    },
    acceptOwn(proposal) {
      const { held } = proposal
      if (!isHeldCount(held)) return null
      if (counts.today(held.vendorId) !== held.before) return Promise.resolve<AcceptResult>({ kind: 'refused', reason: words.cards.countChanged })
      counts.set(held.vendorId, held.after)
      const undo = (): Promise<UndoResult> => {
        if (counts.today(held.vendorId) !== held.after) return Promise.resolve({ kind: 'refused', reason: sharedWords.proposalUndoEnded })
        counts.set(held.vendorId, held.before)
        return Promise.resolve({ kind: 'undone' })
      }
      return Promise.resolve<AcceptResult>({ kind: 'done', undo })
    },
  }
}
