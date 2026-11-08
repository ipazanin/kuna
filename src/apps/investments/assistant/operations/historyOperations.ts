import { words } from '../words'
import type { AcceptResult, AssistantOperation, CheckedProposal } from '../../../../shared/app/assistantOperations'
import { inputOf } from '../../../../shared/app/operationInput'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import type { SideCards } from './investmentSteps'

/** The answer that the file holds every buy and sale since the first, which this device keeps for the file on screen and `app.ts` hands in. */
export interface HistoryAnswer {
  /** The id of the Investments file on screen, which the answer belongs to, or null while none is. */
  file(): string | null
  given(): boolean
  give(): void
  takeBack(): void
}

const CONFIRM = 'confirm-history'

/** An answer this device keeps, as a card counts it. */
const ANSWER_NOUN: RecordNoun = {
  en: { one: 'answer on this device', many: 'answers on this device', article: 'an' },
  hr: { one: 'odgovor na ovom uređaju', of: 'odgovora na ovom uređaju', few: 'odgovora na ovom uređaju', other: 'odgovora na ovom uređaju', gender: 'masculine' },
}

export const HISTORY_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: CONFIRM,
    about:
      'Tells Kuna this file holds every buy and sale since the first, as the Tax screen asks before it shows tax, since a gain is counted from what was paid. Only when the person says so. It is kept on this device, and Undo takes it back.',
    input: inputOf({}),
    refs: {},
    creates: null,
    alone: true,
    example: {},
  },
  {
    name: 'forget-history',
    about: 'Takes back that the file holds every buy and sale, as Settings, General does, so tax hides until the person confirms it again. Undo gives it back.',
    input: inputOf({}),
    refs: {},
    creates: null,
    alone: true,
    example: {},
  },
]

/** What Accept of an answer keeps, which only this file reads: the answer, and the file it was checked on. */
interface HeldAnswer {
  readonly historyComplete: boolean
  readonly file: string
}

const OTHER_FILE = 'Another Investments file is on screen now, and the answer belongs to the one the card was for.'

function isHeldAnswer(held: object): held is HeldAnswer {
  return 'historyComplete' in held
}

/** The answer on the Tax screen and Settings, General, given or taken back on this device with an Undo that restores it while the same file is on screen. */
export function historyCards(history: HistoryAnswer): SideCards {
  const set = (complete: boolean): void => (complete ? history.give() : history.takeBack())
  return {
    operations: HISTORY_OPERATIONS,
    check(title, step) {
      const given = history.given()
      const file = history.file()
      if (file === null) return Promise.resolve({ refused: ['The Investments file is not open on this device.'] })
      const complete = step.operation === CONFIRM
      if (given === complete) return Promise.resolve({ refused: [complete ? 'That is answered on this device already.' : 'The history is not confirmed on this device.'] })
      const held: HeldAnswer = { historyComplete: complete, file }
      const line = { label: words.cards.historyComplete, fields: [], warning: null }
      return Promise.resolve({ title, count: 1, groups: [{ verb: complete ? 'add' : 'remove', noun: ANSWER_NOUN, lines: [line] }], outside: [], undoable: true, held })
    },
    acceptOwn(proposal: CheckedProposal): Promise<AcceptResult> | null {
      const { held } = proposal
      if (!isHeldAnswer(held)) return null
      if (history.file() !== held.file) return Promise.resolve({ kind: 'refused', reason: OTHER_FILE })
      const before = history.given()
      set(held.historyComplete)
      return Promise.resolve({
        kind: 'done',
        undo: () => {
          if (history.file() !== held.file) return Promise.resolve({ kind: 'refused', reason: OTHER_FILE })
          set(before)
          return Promise.resolve({ kind: 'undone' })
        },
      })
    },
  }
}
