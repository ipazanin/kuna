<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { askedLine, lookAlikesOf } from './dryRunLines'
import type { LookAlike } from './dryRunLines'
import { accountNamer } from '../domain/importChoices'
import type { AskedChoice, CostShareFault, SettledImport, SpinOffRowFault, SpinOffStep, SplitStep } from '../domain/importChoices'
import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { decimalText } from '../../../../shared/money/decimal'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCurrencyAmount, formatQuantity } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import { twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/**
 * What the rows cannot say: whether a row like a record Kuna has is that record, the ratio of each split no vendor
 * lists, and the parent and share of cost of a spin-off its row does not give.
 */
const props = defineProps<{
  workbookImport: WorkbookImport
  settled: SettledImport
  /** True once Next was pressed with a spin-off's parent still unpicked, which is when the parent field shows its error. */
  tried: boolean
}>()

/** Each holding of the workbook by its identity, by the name it has in Kuna or will have. */
const names = computed(() => {
  const instruments = props.workbookImport.book.value?.instruments ?? []
  return new Map(
    props.settled.instruments.map(({ question, choice }) => {
      const name = choice.kind === 'new' ? choice.texts.name : instruments.find((instrument) => instrument.id === choice.instrument)?.name
      return [question.identity, name || question.proposal.symbol]
    }),
  )
})
const nameOf = (identity: string): string => names.value.get(identity) ?? identity

const units = (quantity: Parameters<typeof formatQuantity>[0]): string => formatQuantity(quantity, QUANTITY_PLACES)

function splitLine(step: SplitStep): string {
  const { added, held } = step.question
  const count = Number(decimalText(added))
  if (held === null) return plural(words.questions.splitNoHolding(count, units(added)), count)
  return held > 0n ? plural(words.questions.splitRows(count, units(added), units(held)), count) : plural(words.questions.splitNothingHeld(count, units(added)), count)
}

function rowFaultLine(fault: SpinOffRowFault): string {
  return fault.kind === 'parent-not-found' ? words.questions.parentNotFound(fault.from) : words.questions.costShareUnreadable(fault.text)
}

function costShareError(fault: CostShareFault): string {
  return fault === 'reading-missing' ? words.questions.costShareReadingMissing : words.questions.costShareProblem
}

const asked = computed(() => ({
  splits: props.settled.splits.filter((step) => step.listed === null),
  spinOffs: props.settled.spinOffs.filter((step) => !step.answeredByRow),
}))

const askedRows = computed(() => (props.settled.dryRun.report?.asked ?? []).map(askedLine))

const lookAlikes = computed(() => {
  const book = props.workbookImport.book.value
  return book === null ? [] : lookAlikesOf(props.settled.dryRun, book, props.workbookImport.rates.value, accountNamer(props.settled, book.accounts))
})

type LookAlikeChoice = 'later' | 'same' | 'another'

const lookAlikeItems: { value: LookAlikeChoice; label: string }[] = [
  { value: 'later', label: words.questions.lookAlikeLater },
  { value: 'same', label: words.questions.lookAlikeSame },
  { value: 'another', label: words.questions.lookAlikeAnother },
]

/** An answer given against another record, before the account changed, is no answer for this one. */
function lookAlikeChoice(lookAlike: LookAlike): LookAlikeChoice {
  const answer = props.workbookImport.choices.value.lookAlikes[lookAlike.key]
  if (answer === undefined || answer.like !== lookAlike.like) return 'later'
  return answer.same ? 'same' : 'another'
}

const lookAlikeQuestions = computed(() =>
  lookAlikes.value.map((lookAlike) => ({
    key: lookAlike.key,
    row: lookAlike.line.title,
    caption: lookAlike.line.caption,
    note: lookAlike.line.note,
    figure: lookAlike.line.figure,
    choice: lookAlikeChoice(lookAlike),
  })),
)

function answerLookAlike(key: string, choice: LookAlikeChoice): void {
  const lookAlike = lookAlikes.value.find((asked) => asked.key === key)
  if (lookAlike === undefined) return
  props.workbookImport.answerLookAlike(key, choice === 'later' ? null : { like: lookAlike.like, same: choice === 'same' })
}

const askedItems: { value: AskedChoice; label: string }[] = [
  { value: 'hold', label: words.questions.askedHold },
  { value: 'leave-out', label: words.questions.askedLeaveOut },
]

/** Each row the report's recipe asks about, its columns as the file writes them. */
const askedQuestions = computed(() =>
  askedRows.value.map((row) => ({ key: row.key, row: row.title, caption: '', columns: row.caption, note: row.note, choice: props.workbookImport.choices.value.asked[row.key] ?? 'hold' })),
)

function unlistedLine(step: SplitStep): string {
  return step.unlisted === null ? '' : words.questions.unlisted[step.unlisted](props.workbookImport.splitVendor)
}

function typeSplit(step: SplitStep, part: 'newUnits' | 'oldUnits', text: string): void {
  props.workbookImport.choose('splits', step.question.key, { ...step.texts, [part]: text })
}

function parentItems(step: SpinOffStep): { value: string; label: string }[] {
  return props.settled.parents.filter((instrument) => instrument.id !== step.received).map((instrument) => ({ value: instrument.id as string, label: instrument.name }))
}

function spinOffLine(step: SpinOffStep): string {
  const count = Number(decimalText(step.question.quantity))
  return plural(words.questions.spinOffRows(count, units(step.question.quantity), worthOf(step)), count)
}

function worthOf(step: SpinOffStep): string {
  const { worth, currency } = step.question
  return currency === null ? units(worth) : formatCurrencyAmount(worth, currency)
}

function pickParent(step: SpinOffStep, parent: string): void {
  const instrument = props.settled.parents.find((candidate) => candidate.id === parent)
  props.workbookImport.choose('spinOffs', step.question.key, { parent: instrument?.id ?? null, costShare: null })
}

function typeShare(step: SpinOffStep, text: string): void {
  props.workbookImport.choose('spinOffs', step.question.key, { parent: step.parent, costShare: text })
}

function unclearLine(step: SpinOffStep, [asPercent, asFraction]: readonly [string, string]): string {
  return words.questions.costShareUnclear(step.question.costShareText, words.questions.costShareReading(asPercent), words.questions.costShareReading(asFraction))
}

function readingItems(readings: readonly string[]): { value: string; label: string }[] {
  return readings.map((reading) => ({ value: reading, label: words.questions.costShareReading(reading) }))
}

function shareHelp(step: SpinOffStep): string {
  if (step.proposed === null) return words.questions.costShareHelp
  return step.proposedOn === null ? words.questions.costShareProposed : words.questions.costShareFromCloses(dayLabel(step.proposedOn))
}
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="import-questions">
    <p class="type-body">{{ words.questions.intro }}</p>

    <QuestionList
      v-if="lookAlikeQuestions.length > 0"
      :items="lookAlikeQuestions"
      :options="lookAlikeItems"
      :label="words.questions.lookAlikeChoice"
      :heading="twinWords.title"
      :intro="words.questions.lookAlikesIntro"
      data-testid="import-look-alikes"
      @answer="answerLookAlike"
    >
      <template #amount="{ item }">
        <span v-if="item.figure !== ''" class="figure text-muted">{{ item.figure }}</span>
      </template>
    </QuestionList>

    <QuestionList
      v-if="askedQuestions.length > 0"
      :items="askedQuestions"
      :options="askedItems"
      :label="words.questions.askedChoice"
      :heading="words.questions.asked"
      :intro="words.questions.askedIntro"
      data-testid="import-asked"
      @answer="(key, choice) => workbookImport.choose('asked', key, choice)"
    >
      <template #details="{ item }">
        <span v-if="item.columns !== ''" class="break-words type-caption identifier">{{ item.columns }}</span>
        <span class="break-words type-caption">{{ item.note }}</span>
      </template>
    </QuestionList>

    <section v-if="asked.splits.length > 0" class="flex flex-col gap-1" data-testid="import-splits">
      <h3 class="type-card-title">{{ words.questions.splits }}</h3>
      <ul class="flex flex-col">
        <li v-for="step in asked.splits" :key="step.question.key" class="flex flex-col gap-3 border-t border-default py-4 first:border-t-0" data-testid="import-split">
          <p class="flex flex-col gap-0.5">
            <span class="type-label">{{ words.questions.split(nameOf(step.question.identity), dayLabel(step.question.date)) }}</span>
            <span class="type-caption">{{ splitLine(step) }}</span>
            <span v-if="step.unlisted" class="type-caption" data-testid="import-split-unlisted">{{ unlistedLine(step) }}</span>
          </p>
          <FormGrid>
            <UFormField :label="words.questions.newUnits" :help="words.questions.ratioHelp" :error="step.ratioMissing && words.questions.ratioProblem">
              <UInput :model-value="step.texts.newUnits" inputmode="numeric" class="w-full" data-testid="import-split-new" @update:model-value="typeSplit(step, 'newUnits', String($event))" />
            </UFormField>
            <UFormField :label="words.questions.oldUnits">
              <UInput :model-value="step.texts.oldUnits" inputmode="numeric" class="w-full" data-testid="import-split-old" @update:model-value="typeSplit(step, 'oldUnits', String($event))" />
            </UFormField>
          </FormGrid>
        </li>
      </ul>
    </section>

    <section v-if="asked.spinOffs.length > 0" class="flex flex-col gap-1" data-testid="import-spin-offs">
      <h3 class="type-card-title">{{ words.questions.spinOffs }}</h3>
      <ul class="flex flex-col">
        <li v-for="step in asked.spinOffs" :key="step.question.key" class="flex flex-col gap-3 border-t border-default py-4 first:border-t-0" data-testid="import-spin-off">
          <p class="flex flex-col gap-0.5">
            <span class="type-label">{{ words.questions.spinOff(nameOf(step.question.identity), dayLabel(step.question.date)) }}</span>
            <span class="type-caption">{{ spinOffLine(step) }}</span>
            <span v-if="step.rowFault" class="type-caption text-warning" data-testid="import-spin-off-row-problem">{{ rowFaultLine(step.rowFault) }}</span>
          </p>
          <FormGrid>
            <UFormField :label="words.questions.parent" :error="tried && step.parentMissing && words.questions.parentMissing">
              <USelect
                v-bind="step.parent === null ? {} : { modelValue: step.parent }"
                :items="parentItems(step)"
                :placeholder="words.questions.parentMissing"
                class="w-full"
                data-testid="import-spin-off-parent"
                @update:model-value="pickParent(step, String($event))"
              />
            </UFormField>
            <UFormField :label="words.questions.costShare" :help="shareHelp(step)" :error="step.parent !== null && step.costShareFault !== null && costShareError(step.costShareFault)">
              <template v-if="step.costShareReadings" #description>
                <div class="flex flex-col gap-1.5">
                  <p class="type-caption text-warning" data-testid="import-spin-off-unclear">{{ unclearLine(step, step.costShareReadings) }}</p>
                  <ChoiceButtons
                    :model-value="step.costShare"
                    :options="readingItems(step.costShareReadings)"
                    :label="words.questions.costShareReadings"
                    data-testid="import-spin-off-readings"
                    @update:model-value="typeShare(step, String($event))"
                  />
                </div>
              </template>
              <UInput :model-value="step.costShare" inputmode="decimal" class="w-full" data-testid="import-spin-off-share" @update:model-value="typeShare(step, String($event))" />
            </UFormField>
          </FormGrid>
        </li>
      </ul>
    </section>
  </div>
</template>
