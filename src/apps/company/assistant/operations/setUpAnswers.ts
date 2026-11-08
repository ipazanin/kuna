import { words } from './words'
import type { AcceptResult, AssistantOperation, CheckedProposal, ProposalStep } from '../../../../shared/app/assistantOperations'
import { inputOf } from '../../../../shared/app/operationInput'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'

/** The questions of Company's set-up card a person answers once on a device: the starting categories look right, and statements come in by hand. */
export const SET_UP_ANSWERS = ['categories-look-right', 'statements-by-hand'] as const

export type SetUpAnswer = (typeof SET_UP_ANSWERS)[number]

/** The answers kept on this device for the books on screen, which `app.ts` hands in. */
export interface SetUpAnswers {
  given(answer: SetUpAnswer): boolean
  give(answer: SetUpAnswer): void
  takeBack(answer: SetUpAnswer): void
}

const SET_UP_NOUN: RecordNoun = {
  en: { one: 'set-up answer', many: 'set-up answers', article: 'a' },
  hr: { one: 'odgovor o postavljanju', of: 'odgovora o postavljanju', few: 'odgovora o postavljanju', other: 'odgovora o postavljanju', gender: 'masculine' },
}

export const SET_UP_ANSWER: AssistantOperation = {
  name: 'answer-set-up',
  about:
    "Answers a question of Company's set-up card on this device: categories-look-right says the starting categories look right, statements-by-hand that statements come in by hand on Import. It goes alone on a card, and Undo asks the question again.",
  input: inputOf({ answer: { type: 'string', enum: [...SET_UP_ANSWERS] } }),
  refs: {},
  creates: null,
  alone: true,
  example: { answer: 'categories-look-right' },
}

/** What Accept of an answer keeps, which only this file reads. */
interface HeldAnswer {
  readonly setUpAnswer: SetUpAnswer
}

function isHeldAnswer(held: object): held is HeldAnswer {
  return 'setUpAnswer' in held
}

/** The card of an answer, which goes alone and writes nothing to the books, or why not. */
export function setUpAnswerCheck(title: string, steps: readonly ProposalStep[], answers: SetUpAnswers): CheckedProposal | { readonly refused: readonly string[] } {
  if (steps.length !== 1) return { refused: ['An answer goes alone on a card.'] }
  const answer = SET_UP_ANSWERS.find((candidate) => candidate === steps[0]!.input['answer'])
  if (answer === undefined) return { refused: [`answer is one of ${SET_UP_ANSWERS.join(', ')}.`] }
  if (answers.given(answer)) return { refused: ['That is answered on this device already.'] }
  const held: HeldAnswer = { setUpAnswer: answer }
  return { title, count: 1, groups: [{ verb: 'add', noun: SET_UP_NOUN, lines: [{ label: words.setUp[answer], fields: [], warning: null }] }], outside: [], undoable: true, held }
}

/** Keeps the answer of an answer's card, with an Undo that asks the question again. Null for any other card. */
export function setUpAnswerAccept(proposal: CheckedProposal, answers: SetUpAnswers): Promise<AcceptResult> | null {
  const { held } = proposal
  if (!isHeldAnswer(held)) return null
  answers.give(held.setUpAnswer)
  return Promise.resolve({
    kind: 'done',
    undo: () => {
      answers.takeBack(held.setUpAnswer)
      return Promise.resolve({ kind: 'undone' })
    },
  })
}
