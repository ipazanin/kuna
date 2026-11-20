import { computed, ref } from 'vue'

import { words } from './words'
import type { PartChoices } from '../domain/entrySplit'
import { addLabel } from '../../labels/application/labelWrites'
import { newLabel } from '../../labels/domain/labels'
import { sideOf } from '../../categories/domain/rowSide'
import { eventMembership } from '../../events/domain/eventMembership'
import { eventsNewestFirst } from '../../events/domain/events'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import { BY_DAYS, OUT_OF_EVENTS } from '../../workbook/domain/event'
import type { EventChoice } from '../../workbook/domain/event'
import { labelCalled, labelNameProblem } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { words as uiWords } from '../../../../shared/ui/words'

/** A part in a dialog, by whatever the dialog keys its parts by, such as the item's id or the field's. */
export type PartKey = string | number

/** A part with the labels and event choice it opens with. */
export interface OpenedPart extends PartChoices {
  readonly part: PartKey
}

/**
 * The labels and event of an entry's parts as a dialog edits them: the labels to pick from with those typed in the dialog, why
 * a typed name made no label, and each event a part can join on the entry's day. Save adds the typed labels a part carries.
 */
export function useLabelsAndEvents(day: () => CivilDate | null) {
  const store = useSpendingBooks()
  const created = ref<readonly Label[]>([])
  /** Why the last name typed into a labels field made no label, and the part it was typed for, null for the entry's own field. */
  const labelRefused = ref<{ readonly part: PartKey | null; readonly text: string } | null>(null)
  const partLabels = ref<Readonly<Record<PartKey, readonly RecordId[]>>>({})
  /** Each part's event choice, which its select changes in place. */
  const partEvents = ref<Record<PartKey, EventChoice>>({})

  const labelChoices = computed(() => [...(store.state.workbook?.labels ?? []), ...created.value])
  /** Labels and events go on the parts of a file moved to items. */
  const labelling = computed(() => store.state.workbook !== null && !isBeforeItems(store.state.workbook.stored))
  const events = computed(() => eventsNewestFirst(store.state.workbook?.events ?? []))

  /** The labels with the one a typed name names: a label the file or the dialog has under it, or a new one. A name that cannot be a label's adds none and says why. */
  function withTyped(picked: readonly RecordId[], name: string, part: PartKey | null = null): readonly RecordId[] {
    const held = labelCalled(name, labelChoices.value)
    const problem = held === null ? labelNameProblem(name, labelChoices.value, null) : null
    labelRefused.value = problem === null ? null : { part, text: uiWords.labelName[problem] }
    if (held !== null) return picked.includes(held.id) ? picked : [...picked, held.id]
    if (problem !== null) return picked
    const label = newLabel(name)
    created.value = [...created.value, label]
    return [...picked, label.id]
  }

  function labelPart(part: PartKey, picked: readonly RecordId[]): void {
    partLabels.value = { ...partLabels.value, [part]: picked }
  }

  /**
   * The choices of a part's event under its category: first the event its day gives it, then each event, newest first, and no
   * event. Two events of one name read apart by their days.
   */
  function eventItems(filedUnder: string | null): { label: string; value: EventChoice }[] {
    const on = day()
    const side = sideOf(store.state.workbook?.categories.find((candidate) => candidate.id === filedUnder) ?? null)
    const byDays = on === null ? null : eventMembership(events.value)({ event: BY_DAYS }, on, side)
    const named = events.value.find((candidate) => candidate.id === byDays)
    const twin = (name: string): boolean => events.value.filter((candidate) => candidate.name === name).length > 1
    return [
      { label: named === undefined ? words.dialog.byDaysNone : words.dialog.byDays(named.name), value: BY_DAYS },
      ...events.value.map((candidate) => ({ label: twin(candidate.name) ? `${candidate.name} · ${dayRangeLabel(candidate.days)}` : candidate.name, value: candidate.id })),
      { label: words.dialog.noEvent, value: OUT_OF_EVENTS },
    ]
  }

  /** Starts the parts over with what they open with, and forgets the labels typed before. */
  function start(parts: readonly OpenedPart[]): void {
    partLabels.value = Object.fromEntries(parts.map(({ part, labels }) => [part, labels]))
    partEvents.value = Object.fromEntries(parts.map(({ part, event }) => [part, event]))
    created.value = []
    labelRefused.value = null
  }

  /** Gives each part not seen yet what it opens with, and leaves the others as they are. */
  function addParts(parts: readonly OpenedPart[]): void {
    const added = parts.filter(({ part }) => !(part in partEvents.value))
    if (added.length === 0) return
    partLabels.value = { ...partLabels.value, ...Object.fromEntries(added.map(({ part, labels }) => [part, labels])) }
    partEvents.value = { ...partEvents.value, ...Object.fromEntries(added.map(({ part, event }) => [part, event])) }
  }

  /** Adds, in the write, the labels typed in the dialog that something it writes carries. */
  function addCarried(unit: UnitOfWork, carried: ReadonlySet<RecordId>): void {
    created.value.filter((label) => carried.has(label.id)).forEach((label) => addLabel(unit, label))
  }

  return { labelChoices, labelling, labelRefused, partLabels, partEvents, events, withTyped, labelPart, eventItems, start, addParts, addCarried }
}

/** The labels and events of one dialog's parts, which `LabelsAndEventFields` reads and adds typed labels to. */
export type LabelsAndEvents = ReturnType<typeof useLabelsAndEvents>
