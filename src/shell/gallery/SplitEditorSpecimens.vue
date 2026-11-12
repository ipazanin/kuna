<script setup lang="ts">
import { ref } from 'vue'
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

function categoryError(field: SplitField): string | null {
  return field.category === '' ? 'Choose a category' : null
}
</script>

<template>
  <GallerySection
    id="split-editor"
    title="SplitEditor"
    description="The whole above its parts, each with an amount, a category and a note, and one part that takes the rest. The equals button makes a part the rest, and the part that was the rest keeps its figure. A rest of nothing shows in red with why. Remove stays off while two parts are left."
  >
    <DashboardGrid layout="pair">
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
    </DashboardGrid>
  </GallerySection>
</template>
