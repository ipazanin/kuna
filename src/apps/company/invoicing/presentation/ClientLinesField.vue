<script setup lang="ts">
import { computed, useId } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import MoneyText from '../../../../shared/ui/MoneyText.vue'
import MoveButtons from '../../../../shared/ui/MoveButtons.vue'
import type { InvoiceLine } from '../domain/invoiceLine'
import type { InvoiceTemplateLine } from '../domain/invoiceTemplate'
import PlanItemsSelect from './PlanItemsSelect.vue'
import { words } from './words'

/** A client's invoice lines: each line's text and the plan items it sums, in order, with what this month's open plan rows would give. */
const lines = defineModel<InvoiceTemplateLine[]>({ required: true })

defineProps<{
  /** The plan items the billing plan names for this client. */
  planItems: readonly string[]
  /** Each line's problem, by its place, shown under it once Save was tried. */
  errors: readonly (string | null)[]
  /** What the lines give for this month's open plan rows. */
  preview: readonly InvoiceLine[]
  /** The month the preview is for, as the client reads it. */
  month: string
  disabled: boolean
}>()

const titleId = useId()
const linesItems = computed(() => lines.value.flatMap((line) => line.items))

function update(index: number, change: Partial<InvoiceTemplateLine>): void {
  lines.value = lines.value.map((line, at) => (at === index ? { ...line, ...change } : line))
}

function move(index: number, by: -1 | 1): void {
  const moved = [...lines.value]
  const [line] = moved.splice(index, 1)
  moved.splice(index + by, 0, line!)
  lines.value = moved
}
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3 sm:col-span-2" :aria-labelledby="titleId" data-testid="client-lines">
    <div class="flex flex-col gap-1">
      <h3 :id="titleId" class="type-card-title">{{ words.clientLines.title }}</h3>
      <p class="type-caption max-w-prose">{{ words.clientLines.intro }}</p>
    </div>
    <p v-if="lines.length === 0" class="type-aside">{{ words.clientLines.planNote }}</p>
    <ol v-else class="flex flex-col divide-y divide-default border-y border-default">
      <li v-for="(line, index) in lines" :key="index" class="py-3" data-testid="client-line">
        <UFormField :error="errors[index] ?? false">
          <div class="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <UInput
              :model-value="line.text"
              :placeholder="words.clientLines.textPlaceholder"
              :aria-label="words.clientLines.text(index + 1)"
              :disabled="disabled"
              class="min-w-0"
              data-testid="client-line-text"
              @update:model-value="update(index, { text: String($event) })"
            />
            <div class="order-last flex items-center justify-end gap-1 sm:order-none sm:row-span-2 sm:self-start">
              <MoveButtons
                :up-label="words.clientLines.up(index + 1)"
                :down-label="words.clientLines.down(index + 1)"
                :first="index === 0"
                :last="index === lines.length - 1"
                :disabled="disabled"
                test-id="client-line"
                @up="move(index, -1)"
                @down="move(index, 1)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                class="size-11 shrink-0 justify-center"
                :aria-label="words.clientLines.remove(index + 1)"
                :disabled="disabled"
                data-testid="client-line-remove"
                @click="lines = lines.filter((_, at) => at !== index)"
              />
            </div>
            <PlanItemsSelect
              :model-value="line.items"
              :plan-items="planItems"
              :lines-items="linesItems"
              :label="words.clientLines.items(index + 1)"
              :placeholder="index === lines.length - 1 ? words.clientLines.lastItemsPlaceholder : words.clientLines.itemsPlaceholder"
              :disabled="disabled"
              test-id="client-line"
              @update:model-value="update(index, { items: $event })"
            />
          </div>
        </UFormField>
      </li>
    </ol>
    <div class="flex flex-wrap gap-2">
      <UButton
        :label="words.clientLines.add"
        icon="i-lucide-plus"
        size="sm"
        color="neutral"
        variant="outline"
        :disabled="disabled"
        data-testid="client-line-add"
        @click="lines = [...lines, { text: '', items: [] }]"
      />
      <UButton
        v-if="lines.length > 0"
        :label="words.clientLines.usePlan"
        icon="i-lucide-list-restart"
        size="sm"
        color="neutral"
        variant="ghost"
        :disabled="disabled"
        data-testid="client-lines-clear"
        @click="lines = []"
      />
    </div>
    <div v-if="lines.length > 0" class="flex flex-col gap-1" data-testid="client-lines-preview">
      <p class="type-label">{{ words.clientLines.preview(month) }}</p>
      <p v-if="preview.length === 0" class="type-aside">{{ words.clientLines.previewEmpty }}</p>
      <ul v-else class="flex flex-col gap-1">
        <li v-for="(line, index) in preview" :key="index" class="flex items-baseline justify-between gap-3 type-body">
          <span class="min-w-0 break-words">{{ line.description }}</span>
          <MoneyText :cents="line.amount" class="shrink-0" />
        </li>
      </ul>
    </div>
  </section>
</template>
