import type { CivilDate } from '../../calendar/civilDate'
import type { AccountMoney } from '../../money/accountMoney'
import type { CurrencyCode } from '../../money/currencyCode'
import type { Money } from '../../money/money'
import type { ChatElementAbout } from './chatElement'
import { figuresIn, holdsStrayFigure } from './writtenFigures'

/** An amount Kuna computed, in the app's own currency or in an account's, as the figure says. */
export type FigureAmount = { readonly of: 'app'; readonly cents: Money; readonly currency: CurrencyCode } | { readonly of: 'account'; readonly cents: AccountMoney; readonly currency: CurrencyCode }

/** A figure Kuna computed and handed to the model under a ref. */
export type ChatFigure = FigureAmount & { readonly ref: string }

/** A figure's build-up a person tagged, which the chat holds in memory and `read_build_up` reads. */
export type ChatBuildUp = Extract<ChatElementAbout, { readonly kind: 'build-up' }>

/** A section of a law file a page handed to the model, which an answer cites by its ref. */
export interface LawCitation {
  /** The page it was read from, such as `investments/law/capital-gains#losses`. */
  readonly path: string
  readonly file: string
  /** Null for the lines under the file's own title. */
  readonly heading: string | null
  /** The day the file's law was last verified. */
  readonly checked: CivilDate
}

/** What the screen resolves the refs of an answer by. */
export type ShownRefs = Pick<ChatRefs, 'figureOf' | 'lawOf'>

/** The record a ref stands for. */
export interface RecordOfRef {
  readonly app: string
  readonly kind: string
  readonly id: string
}

/** How many record refs of each kind and how many build-up refs a chat handed out, which a chat restored after a reload numbers on from. */
export interface RefsHandedOut {
  readonly records: Readonly<Record<string, number>>
  readonly buildUps: number
}

const NONE_HANDED_OUT: RefsHandedOut = { records: {}, buildUps: 0 }

/**
 * The refs and the figures of one chat, held in memory only. A model names a record only by a ref it was handed and
 * quotes an amount only if a tool gave it, so a ref it makes up reaches nothing and an amount it makes up gets flagged.
 */
export interface ChatRefs {
  recordRef(record: RecordOfRef): string
  recordOf(ref: string): RecordOfRef | null
  /** The ref of a build-up, the same one for the same build-up through the chat. */
  buildUpRef(buildUp: ChatBuildUp): string
  buildUpOf(ref: string): ChatBuildUp | null
  figureRef(key: string, amount: FigureAmount): string
  figureOf(ref: string): ChatFigure | null
  /** The ref of a law section, the same one for the same section through the chat. */
  lawRef(citation: LawCitation): string
  lawOf(ref: string): LawCitation | null
  /** An amount a tool returned without a ref, such as a record's. */
  noteAmount(cents: number): void
  noteRate(basisPoints: number): void
  /**
   * The figures in a text Kuna wrote itself, such as a page of the catalogue, or in an answer from before a reload that held
   * no stray figure. Never for a record's free text, which a stranger wrote.
   */
  noteFiguresIn(text: string): void
  /** Whether an answer writes an amount or a rate no tool returned, or names a figure ref no tool gave. */
  holdsStrayFigure(answer: string): boolean
  /** How many refs it handed out, so a chat restored after a reload never hands out a ref an earlier answer used for something else. */
  handedOut(): RefsHandedOut
}

/** Aliases, masked identifiers and record refs hold digits that are no amounts, as in `Person 3 €40`, so they leave the text before it is read for figures. */
const NOT_A_FIGURE = /(?<![\p{L}\p{N}])(?:(?:Person|Osoba) \d+|[A-Z]{2}•• ••••[A-Z0-9]{4}(?: #\d+)?|[a-z]+-\d+)(?![\p{L}\p{N}])|\[OIB\](?: #\d+)?/gu
const FIGURE_REF = /\[(f\d+)\]/g

export function chatRefs(numberedFrom: RefsHandedOut = NONE_HANDED_OUT): ChatRefs {
  const records = new Map<string, RecordOfRef>()
  const recordRefs = new Map<string, string>()
  const counts = new Map<string, number>(Object.entries(numberedFrom.records))
  let buildUpCount = numberedFrom.buildUps
  const buildUps = new Map<string, ChatBuildUp>()
  const figures = new Map<string, ChatFigure>()
  const figureRefs = new Map<string, string>()
  const citations = new Map<string, LawCitation>()
  const amounts = new Set<number>()
  const rates = new Set<number>()
  return {
    recordRef(record) {
      const key = `${record.app}/${record.kind}/${record.id}`
      const known = recordRefs.get(key)
      if (known !== undefined) return known
      const count = (counts.get(record.kind) ?? 0) + 1
      counts.set(record.kind, count)
      const ref = `${record.kind}-${count}`
      recordRefs.set(key, ref)
      records.set(ref, record)
      return ref
    },
    recordOf: (ref) => records.get(ref) ?? null,
    buildUpRef(buildUp) {
      const known = [...buildUps].find(([, held]) => held === buildUp)?.[0]
      if (known !== undefined) return known
      buildUpCount += 1
      const ref = `build-up-${buildUpCount}`
      buildUps.set(ref, buildUp)
      return ref
    },
    buildUpOf: (ref) => buildUps.get(ref) ?? null,
    figureRef(key, amount) {
      amounts.add(Math.abs(amount.cents))
      const held = figureRefs.get(key)
      if (held !== undefined && figures.get(held)?.cents === amount.cents) return held
      const ref = `f${figures.size + 1}`
      figures.set(ref, { ...amount, ref })
      figureRefs.set(key, ref)
      return ref
    },
    figureOf: (ref) => figures.get(ref) ?? null,
    lawRef(citation) {
      const known = [...citations].find(([, held]) => held.path === citation.path)?.[0]
      if (known !== undefined) return known
      const ref = `law-${citations.size + 1}`
      citations.set(ref, citation)
      return ref
    },
    lawOf: (ref) => citations.get(ref) ?? null,
    noteAmount: (cents) => void amounts.add(Math.abs(cents)),
    noteRate: (basisPoints) => void rates.add(basisPoints),
    noteFiguresIn(text) {
      for (const figure of figuresIn(text)) {
        if (figure.kind === 'rate') figure.basisPoints.forEach((points) => rates.add(points))
        else figure.cents.forEach((cents) => amounts.add(cents))
      }
    },
    holdsStrayFigure(answer) {
      const namesUnknown = [...answer.matchAll(FIGURE_REF)].some((match) => !figures.has(match[1] ?? ''))
      return namesUnknown || holdsStrayFigure(answer.replace(FIGURE_REF, '').replace(NOT_A_FIGURE, ''), amounts, rates)
    },
    handedOut: () => ({ records: Object.fromEntries(counts), buildUps: buildUpCount }),
  }
}
