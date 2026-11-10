<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { askedLine, lookAlikesOf } from './dryRunLines'
import type { LookAlike } from './dryRunLines'
import ImportLines from './ImportLines.vue'
import { accountNamer } from './importChoices'
import type { AskedChoice, SettledImport, SpinOffStep, SplitStep } from './importChoices'
import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { decimalText } from '../../../../shared/money/decimal'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCurrencyAmount, formatQuantity } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
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

function answerLookAlike(lookAlike: LookAlike, choice: LookAlikeChoice): void {
  props.workbookImport.answerLookAlike(lookAlike.key, choice === 'later' ? null : { like: lookAlike.like, same: choice === 'same' })
}

const askedItems: { value: AskedChoice; label: string }[] = [
  { value: 'hold', label: words.questions.askedHold },
  { value: 'leave-out', label: words.questions.askedLeaveOut },
]

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

    <section v-if="lookAlikes.length > 0" class="flex flex-col gap-1" data-testid="import-look-alikes">
      <h3 class="type-card-title">{{ twinWords.title }}</h3>
      <p class="type-caption">{{ words.questions.lookAlikesIntro }}</p>
      <ul class="flex flex-col">
        <li v-for="lookAlike in lookAlikes" :key="lookAlike.key" class="flex flex-col gap-1 border-t border-default pb-4 first:border-t-0" data-testid="import-look-alike">
          <ImportLines :lines="[lookAlike.line]" />
          <ChoiceButtons
            :model-value="lookAlikeChoice(lookAlike)"
            :options="lookAlikeItems"
            :label="words.questions.lookAlikeChoice"
            data-testid="import-look-alike-choice"
            @update:model-value="answerLookAlike(lookAlike, $event as LookAlikeChoice)"
          />
        </li>
      </ul>
    </section>

    <section v-if="askedRows.length > 0" class="flex flex-col gap-1" data-testid="import-asked">
      <h3 class="type-card-title">{{ words.questions.asked }}</h3>
      <p class="type-caption">{{ words.questions.askedIntro }}</p>
      <ul class="flex flex-col">
        <li v-for="row in askedRows" :key="row.key" class="flex flex-col gap-1 border-t border-default pb-4 first:border-t-0" data-testid="import-asked-row">
          <ImportLines :lines="[row]" warns verbatim />
          <ChoiceButtons
            :model-value="workbookImport.choices.value.asked[row.key] ?? 'hold'"
            :options="askedItems"
            :label="words.questions.askedChoice"
            data-testid="import-asked-choice"
            @update:model-value="workbookImport.choose('asked', row.key, $event as AskedChoice)"
          />
        </li>
      </ul>
    </section>

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
            <UFormField :label="words.questions.newUnits" :help="words.questions.ratioHelp" :error="step.problem ?? false">
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
            <span v-if="step.workbookProblem" class="type-caption text-warning" data-testid="import-spin-off-row-problem">{{ step.workbookProblem }}</span>
          </p>
          <FormGrid>
            <UFormField :label="words.questions.parent" :error="(tried && step.problems.parent) || false">
              <USelect
                v-bind="step.parent === null ? {} : { modelValue: step.parent }"
                :items="parentItems(step)"
                :placeholder="words.questions.parentMissing"
                class="w-full"
                data-testid="import-spin-off-parent"
                @update:model-value="pickParent(step, String($event))"
              />
            </UFormField>
            <UFormField :label="words.questions.costShare" :help="shareHelp(step)" :error="(step.parent !== null && step.problems.costShare) || false">
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
