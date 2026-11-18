<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { moneyFromCents } from '../../shared/money/money'
import AppCard from '../../shared/ui/AppCard.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import QuestionList from '../../shared/ui/QuestionList.vue'
import GallerySection from './GallerySection.vue'

const GALLERY_ANSWERS = [
  { value: 'later', label: 'Decide later' },
  { value: 'both', label: 'Keep both' },
  { value: 'kept', label: 'Keep the one I have' },
] as const
type GalleryAnswer = (typeof GALLERY_ANSWERS)[number]['value']
const galleryAnswers = ref<Readonly<Record<string, GalleryAnswer>>>({ bakery: 'both' })
const galleryQuestions = computed(() =>
  [
    { key: 'market', row: 'Corner market', caption: '9 Nov 2026 · Main account', note: 'Looks like: CORNER MARKET LTD, −12.30 €, 10 Nov 2026', amount: moneyFromCents(-1230) },
    { key: 'bakery', row: 'Bakery', caption: '8 Nov 2026 · Main account', note: 'Looks like: BAKERY 22, −4.20 €, 8 Nov 2026', amount: moneyFromCents(-420) },
    { key: 'pharmacy', row: 'Pharmacy', caption: '7 Nov 2026 · Main account', amount: moneyFromCents(-1890) },
  ].map((item) => ({ ...item, choice: galleryAnswers.value[item.key] ?? ('later' as const) })),
)
</script>

<template>
  <GallerySection
    id="question-list"
    title="QuestionList"
    description="Rows that each ask for one of a few choices, with an intro and a heading the card may already give. The answer being written shows busy. The amount slot puts a figure in a column beside each row's words, and the action slot a link button on a line of its own under the choices."
  >
    <DashboardGrid>
      <AppCard title="With its heading and amounts">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <QuestionList
            :items="galleryQuestions"
            :options="GALLERY_ANSWERS"
            label="Which to keep"
            heading="Rows that look like ones you have"
            intro="Each looks like a row you have, with the same amount and at most 3 days apart."
            :saving="{ key: 'market', choice: 'kept' }"
            @answer="(key, choice) => (galleryAnswers = { ...galleryAnswers, [key]: choice })"
          >
            <template #amount="{ item }">
              <MoneyText :cents="item.amount" tone="flow" />
            </template>
          </QuestionList>
        </div>
      </AppCard>
      <AppCard title="Inside a card that names the rows">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <QuestionList
            :items="galleryQuestions"
            :options="GALLERY_ANSWERS"
            label="Which to keep"
            intro="Each looks like a row you have, with the same amount and at most 3 days apart."
            @answer="(key, choice) => (galleryAnswers = { ...galleryAnswers, [key]: choice })"
          />
        </div>
      </AppCard>
      <AppCard title="With an action under the choices">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <QuestionList
            :items="galleryQuestions"
            :options="GALLERY_ANSWERS"
            label="Which to keep"
            intro="Each looks like a row you have. A row Kuna can fill a form from also offers Book."
            @answer="(key, choice) => (galleryAnswers = { ...galleryAnswers, [key]: choice })"
          >
            <template #action="{ item }">
              <UButton v-if="item.key !== 'pharmacy'" label="Book" icon="i-lucide-notebook-pen" color="neutral" variant="link" size="sm" class="px-0" />
            </template>
          </QuestionList>
        </div>
      </AppCard>
    </DashboardGrid>
  </GallerySection>
</template>
