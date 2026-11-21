import type { CivilDate } from '../../calendar/civilDate'
import { subtractMoney, ZERO } from '../../money/money'
import type { Money } from '../../money/money'
import type { RecordId } from '../../storage/domain/recordId'
import { fold } from '../../text/fold'
import { partReplacements } from './partReplacements'

/** A name that groups money across categories and months with no days of its own, such as a renovation. Each app keeps its own labels, and its parts name the labels they carry. */
export interface Label {
  readonly id: RecordId
  readonly name: string
}

/** A part that carries labels, by their ids. */
interface Labelled {
  readonly labels: readonly RecordId[]
}

/** The label that has the name once folded, or null, so a name typed again picks the label it already is. */
export function labelCalled(name: string, labels: readonly Label[]): Label | null {
  const folded = fold(name)
  return folded === '' ? null : (labels.find((label) => fold(label.name) === folded) ?? null)
}

/** Why a name cannot be a label's: it is blank, or another label of the file has it once folded, so `Prague` and `prague` are one label. */
export type LabelNameProblem = 'blank' | 'taken'

/** Why the name cannot be the label's, among the file's labels, or null when it can. `own` is the label being renamed, or null for a new one. */
export function labelNameProblem(name: string, labels: readonly Label[], own: RecordId | null): LabelNameProblem | null {
  const folded = fold(name)
  if (folded === '') return 'blank'
  return labels.some((label) => label.id !== own && fold(label.name) === folded) ? 'taken' : null
}

/** What a name typed into a labels field picks: the label that has it, a new label made with it, or why it cannot be a label's. */
export type TypedLabel = { readonly label: Label; readonly made: boolean } | { readonly problem: LabelNameProblem }

/** The label a typed name picks among the labels on offer, made by the app's own `make` when none has the name. */
export function typedLabel(name: string, labels: readonly Label[], make: (name: string) => Label): TypedLabel {
  const held = labelCalled(name, labels)
  if (held !== null) return { label: held, made: false }
  const problem = labelNameProblem(name, labels, null)
  return problem === null ? { label: make(name), made: true } : { problem }
}

/** The picked labels with the one typed added, where it is not picked already. */
export function pickedWith(picked: readonly RecordId[], label: Label): readonly RecordId[] {
  return picked.includes(label.id) ? picked : [...picked, label.id]
}

/** The parts with the label on each, where it is not already. */
export function withLabel<Part extends Labelled>(parts: readonly Part[], label: RecordId): readonly Part[] {
  return parts.map((part) => (part.labels.includes(label) ? part : { ...part, labels: [...part.labels, label] }))
}

/** The parts with the label off each. */
export function withoutLabel<Part extends Labelled>(parts: readonly Part[], label: RecordId): readonly Part[] {
  return parts.map((part) => (part.labels.includes(label) ? { ...part, labels: part.labels.filter((held) => held !== label) } : part))
}

/** Every label the parts carry, each once, in the order the parts first carry them. */
export function labelsOf(parts: readonly Labelled[]): readonly RecordId[] {
  return [...new Set(parts.flatMap((part) => part.labels))]
}

/**
 * The parts a write leaves, with the labels of the parts they replace. A part that kept its id and did not grow keeps its own
 * labels. A new part or one that grew takes every label of the parts it took money from, so a re-split loses none.
 */
export function carriedLabels<Id, Part extends Labelled & { readonly id: Id; readonly amount: number }>(found: readonly Part[], left: readonly Part[]): readonly Part[] {
  const replacements = partReplacements(found, left)
  if (replacements.length === 0) return left
  const foundById = new Map(found.map((part) => [part.id, part]))
  const replacing = new Map(replacements.map(({ part, replaces }) => [part, replaces.flatMap((id) => foundById.get(id) ?? [])]))
  return left.map((part) => {
    const replaces = replacing.get(part.id)
    if (replaces === undefined) return part
    const labels = labelsOf([part, ...replaces])
    return labels.length === part.labels.length ? part : { ...part, labels }
  })
}

/** How a list of labels is ordered: those nothing carries first, then by the day of their newest part, newest first, and by name within a day. */
export function labelOrder(one: { readonly label: Label; readonly latest: CivilDate | null }, other: { readonly label: Label; readonly latest: CivilDate | null }): number {
  if (one.latest !== other.latest) {
    if (one.latest === null) return -1
    if (other.latest === null) return 1
    return one.latest > other.latest ? -1 : 1
  }
  return one.label.name.localeCompare(other.label.name)
}

/** The one figure a label leads with: its result, income less costs, or only its costs when it has no income, since a result would read a plain cost as a loss. */
export interface LabelFigure {
  readonly counts: 'result' | 'costs'
  readonly amount: Money
}

/** The figure a label leads with from what it took in and what it cost, both counted as its app counts them. */
export function labelFigure(income: Money, cost: Money): LabelFigure {
  if (income === ZERO) return { counts: 'costs', amount: cost }
  return { counts: 'result', amount: subtractMoney(income, cost) }
}
