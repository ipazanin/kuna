<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import type { LineDraft } from './useInvoiceRun'
import { words } from './words'

const lines = defineModel<LineDraft[]>('lines', { required: true })

defineProps<{
  total: Money
  disabled: boolean
}>()

const emit = defineEmits<{
  /** Lines from the billing plan's open rows again. */
  plan: []
  /** One line for the whole amount. */
  merge: []
}>()

function update(index: number, field: keyof LineDraft, text: string): void {
  lines.value = lines.value.map((line, at) => (at === index ? { ...line, [field]: text } : line))
}

function remove(index: number): void {
  lines.value = lines.value.filter((_, at) => at !== index)
}

function add(): void {
  lines.value = [...lines.value, { description: '', amount: '' }]
}

function amountError(text: string): boolean {
  const amount = typedAmount(text)
  return text.trim() !== '' && (amount === null || amount <= 0)
}
</script>

<template>
  <section class="@container flex min-w-0 flex-col gap-2" aria-labelledby="invoice-lines-title" data-testid="invoice-lines">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 id="invoice-lines-title" class="text-sm font-medium text-highlighted">{{ words.lines.title }}</h3>
      <div class="flex flex-wrap gap-1">
        <UButton :label="words.lines.fromPlan" icon="i-lucide-list-restart" size="sm" color="neutral" variant="ghost" :disabled="disabled" @click="emit('plan')" />
        <UButton
          :label="words.lines.merge"
          icon="i-lucide-merge"
          size="sm"
          color="neutral"
          variant="ghost"
          :disabled="disabled || lines.length < 2"
          data-testid="invoice-lines-merge"
          @click="emit('merge')"
        />
      </div>
    </div>
    <p class="-mt-1 text-xs text-muted">{{ words.lines.intro }}</p>
    <ul class="flex flex-col gap-2">
      <li v-for="(line, index) in lines" :key="index" class="line-row" data-testid="invoice-line">
        <UInput
          :model-value="line.description"
          :placeholder="words.lines.descriptionPlaceholder"
          class="min-w-0"
          :aria-label="words.lines.description(index + 1)"
          :disabled="disabled"
          @update:model-value="update(index, 'description', String($event))"
        />
        <UInput
          :model-value="line.amount"
          inputmode="decimal"
          :placeholder="words.lines.amountPlaceholder"
          class="w-full"
          v-bind="amountError(line.amount) ? { color: 'error', highlight: true } : {}"
          :aria-label="words.lines.amount(index + 1)"
          :disabled="disabled"
          @update:model-value="update(index, 'amount', String($event))"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          class="size-11 justify-center sm:size-9"
          :aria-label="words.lines.remove(index + 1)"
          :disabled="disabled"
          @click="remove(index)"
        />
      </li>
    </ul>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <UButton :label="words.lines.add" icon="i-lucide-plus" size="sm" color="neutral" variant="outline" :disabled="disabled" data-testid="invoice-line-add" @click="add" />
      <p class="text-sm text-toned">{{ words.lines.total }} <MoneyText :cents="total" class="font-medium text-highlighted" /></p>
    </div>
  </section>
</template>

<style scoped>
.line-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7.5rem auto;
  align-items: center;
  gap: 0.5rem;
}

@container (max-width: 24rem) {
  .line-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .line-row > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
