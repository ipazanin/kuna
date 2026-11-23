<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { moneyFromCents, negateMoney } from '../../shared/money/money'
import type { Money } from '../../shared/money/money'
import { typedAmount } from '../../shared/money/typedAmount'
import AppCard from '../../shared/ui/AppCard.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import SplitEditor from '../../shared/ui/SplitEditor.vue'
import { splitField } from '../../shared/ui/splitFields'
import type { SplitField } from '../../shared/ui/splitFields'
import GallerySection from './GallerySection.vue'
import type { Label } from '../../shared/categorising/domain/labels'
import { recordIdOf } from '../../shared/storage/domain/recordId'
import type { RecordId } from '../../shared/storage/domain/recordId'
import { recordKind } from '../../shared/storage/domain/recordKind'
import LabelsSelect from '../../shared/ui/LabelsSelect.vue'

/** A made-up payment of €45.30 split into made-up categories. */
const WHOLE: Money = moneyFromCents(4_530)
const CATEGORIES = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'household', label: 'Household' },
]

const SPECIMENS = [
  { title: 'A new split', parts: ref<SplitField[]>([splitField('', 'groceries', '', false), splitField('', '', '', true)]), tried: false, refusal: null },
  {
    title: 'Three parts, the second one the rest',
    parts: ref<SplitField[]>([splitField('20.00', 'groceries', '', false), splitField('', 'restaurants', '', true), splitField('15.30', 'household', 'Soap and bulbs', false)]),
    tried: false,
    refusal: null,
  },
  {
    title: 'Saved with fields missing',
    parts: ref<SplitField[]>([splitField('', 'groceries', '', false), splitField('', '', '', true)]),
    tried: true,
    refusal: 'A refusal from the caller, shown once saving was tried.',
  },
  { title: 'The amounts leave the rest nothing', parts: ref<SplitField[]>([splitField('50.00', 'groceries', '', false), splitField('', 'restaurants', '', true)]), tried: false, refusal: null },
] as const

/** Made-up labels for the specimen whose parts carry them. */
const GALLERY_LABELS = recordKind<Label>('gallery-split-label', {
  en: { one: 'label', many: 'labels', article: 'a' },
  hr: { one: 'oznaka', of: 'oznake', few: 'oznake', other: 'oznaka', gender: 'feminine' },
})
const LABELS: readonly Label[] = [
  { id: recordIdOf(GALLERY_LABELS, 'trip'), name: 'Summer trip' },
  { id: recordIdOf(GALLERY_LABELS, 'flat'), name: 'New flat' },
]
const labelled = ref<SplitField[]>([splitField('30.00', 'restaurants', 'Dinner', false), splitField('', 'household', '', true)])
const partLabels = ref<Record<number, readonly RecordId[]>>({ [labelled.value[0]!.id]: [LABELS[0]!.id] })

/** Made-up people a part may count under, for the specimen with the beside and tools slots. */
const PEOPLE = ['The shop', 'A friend']
const shared = ref<SplitField[]>([splitField('22.65', 'restaurants', '', false), splitField('', 'restaurants', '', true)])
const sharedWith = ref<Record<number, string>>({ [shared.value[1]!.id]: 'A friend' })

function halve(): void {
  shared.value = [splitField('22.65', 'restaurants', '', false), splitField('', 'restaurants', '', true)]
  sharedWith.value = { [shared.value[1]!.id]: 'A friend' }
}

function categoryError(field: SplitField): string | null {
  return field.category === '' ? 'Choose a category' : null
}
</script>

<template>
  <GallerySection
    id="split-editor"
    title="SplitEditor"
    description="The whole above its parts, each with an amount, a category and a note, and one part that takes the rest. The equals button makes a part the rest, and the part that was the rest keeps its figure. A rest of nothing shows in red with why. Remove stays off while two parts are left. The part slot adds fields of a part under its note, such as its labels. The beside slot adds fields under a part's category, such as who it counts under, and the tools slot holds shortcuts above the parts, such as Half and half."
  >
    <DashboardGrid>
      <AppCard v-for="specimen in SPECIMENS" :key="specimen.title" :title="specimen.title">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <SplitEditor
            v-model="specimen.parts.value"
            whole-label="The payment, money out"
            :whole="WHOLE"
            :typed="typedAmount"
            :tried="specimen.tried"
            :category-error="categoryError"
            :refusal="specimen.refusal"
          >
            <template #whole>
              <MoneyText :cents="negateMoney(WHOLE)" tone="flow" />
            </template>
            <template #category="{ field }">
              <USelect v-model="field.category" :items="CATEGORIES" placeholder="Choose a category" class="w-full" />
            </template>
            <template #rest="{ cents }">
              <MoneyText :cents="cents" />
            </template>
          </SplitEditor>
        </div>
      </AppCard>
      <AppCard title="Each part with its labels, in the part slot">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <SplitEditor v-model="labelled" whole-label="The payment, money out" :whole="WHOLE" :typed="typedAmount" :tried="false" :category-error="categoryError">
            <template #whole>
              <MoneyText :cents="negateMoney(WHOLE)" tone="flow" />
            </template>
            <template #category="{ field }">
              <USelect v-model="field.category" :items="CATEGORIES" placeholder="Choose a category" class="w-full" />
            </template>
            <template #rest="{ cents }">
              <MoneyText :cents="cents" />
            </template>
            <template #part="{ field, place }">
              <LabelsSelect
                :model-value="partLabels[field.id] ?? []"
                :labels="LABELS"
                :name="`Labels of part ${place}`"
                class="w-full"
                @update:model-value="partLabels = { ...partLabels, [field.id]: $event }"
              />
            </template>
          </SplitEditor>
        </div>
      </AppCard>
      <AppCard title="Who each part counts under, with a shortcut above the parts">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <SplitEditor v-model="shared" whole-label="The payment, money out" :whole="WHOLE" :typed="typedAmount" :tried="false" :category-error="categoryError">
            <template #whole>
              <MoneyText :cents="negateMoney(WHOLE)" tone="flow" />
            </template>
            <template #tools>
              <UButton label="Half and half" icon="i-lucide-divide" color="neutral" variant="outline" size="sm" @click="halve" />
            </template>
            <template #category="{ field }">
              <USelect v-model="field.category" :items="CATEGORIES" placeholder="Choose a category" class="w-full" />
            </template>
            <template #beside="{ field, place }">
              <USelect
                :model-value="sharedWith[field.id] ?? PEOPLE[0]"
                :items="PEOPLE"
                :aria-label="`Who part ${place} counts under`"
                size="sm"
                class="w-full"
                @update:model-value="sharedWith = { ...sharedWith, [field.id]: $event }"
              />
            </template>
            <template #rest="{ cents }">
              <MoneyText :cents="cents" />
            </template>
          </SplitEditor>
        </div>
      </AppCard>
    </DashboardGrid>
  </GallerySection>
</template>
