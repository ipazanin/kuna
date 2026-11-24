<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { LineDraft } from './lineDrafts'
import { words } from './words'

const lines = defineModel<LineDraft[]>('lines', { required: true })

const props = withDefaults(
  defineProps<{
    total: Money
    disabled: boolean
    /** The lines start from the billing plan, which From the billing plan and One line for the total fill again. */
    planned?: boolean
    /** The client has invoice lines of its own, which start the list instead of one line per plan row. */
    templated?: boolean
    /** The lines start from those the invoice went out with. */
    reexport?: boolean
  }>(),
  { planned: false, templated: false, reexport: false },
)

const emit = defineEmits<{
  /** The lines the client's invoice starts from again. */
  plan: []
  /** One line for the whole amount. */
  merge: []
}>()

const store = useWorkbook()
const created = ref<string[]>([])
const itemChoices = computed(() => [...new Set([...(store.state.workbook?.billingPlan.map((row) => row.item) ?? []), ...lines.value.flatMap((line) => line.items), ...created.value])])

const intro = computed(() => {
  if (!props.planned) return words.lines.introTyped
  if (props.reexport) return words.lines.introReexport
  return props.templated ? words.lines.introTemplate : words.lines.intro
})

function update(index: number, change: Partial<LineDraft>): void {
  lines.value = lines.value.map((line, at) => (at === index ? { ...line, ...change } : line))
}

function createItem(index: number, text: string): void {
  const typed = text.trim()
  if (typed === '') return
  created.value = [...created.value, typed]
  update(index, { items: [...new Set([...lines.value[index]!.items, typed])] })
}

function remove(index: number): void {
  lines.value = lines.value.filter((_, at) => at !== index)
}

function add(): void {
  lines.value = [...lines.value, { description: '', amount: '', items: [] }]
}

function amountError(text: string): boolean {
  const amount = typedAmount(text)
  return text.trim() !== '' && (amount === null || amount <= 0)
}
</script>

<template>
  <section class="@container flex min-w-0 flex-col gap-2" aria-labelledby="invoice-lines-title" data-testid="invoice-lines">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 id="invoice-lines-title" class="type-card-title">{{ words.lines.title }}</h3>
      <div v-if="planned" class="flex flex-wrap gap-1">
        <UButton
          :label="templated ? words.lines.fromTemplate : words.lines.fromPlan"
          icon="i-lucide-list-restart"
          size="sm"
          color="neutral"
          variant="ghost"
          :disabled="disabled"
          @click="emit('plan')"
        />
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
    <ol class="flex flex-col divide-y divide-default border-y border-default">
      <li v-for="(line, index) in lines" :key="index" class="flex flex-col gap-2 py-3" data-testid="invoice-line">
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 @sm:grid-cols-[minmax(0,1fr)_7.5rem_auto]">
          <UInput
            :model-value="line.description"
            :placeholder="words.lines.descriptionPlaceholder"
            class="col-span-full min-w-0 @sm:col-span-1"
            :aria-label="words.lines.description(index + 1)"
            :disabled="disabled"
            data-testid="invoice-line-text"
            @update:model-value="update(index, { description: String($event) })"
          />
          <UInput
            :model-value="line.amount"
            inputmode="decimal"
            :placeholder="words.lines.amountPlaceholder"
            class="w-full"
            v-bind="amountError(line.amount) ? { color: 'error', highlight: true } : {}"
            :aria-label="words.lines.amount(index + 1)"
            :disabled="disabled"
            data-testid="invoice-line-amount"
            @update:model-value="update(index, { amount: String($event) })"
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
        </div>
        <USelectMenu
          :model-value="[...line.items]"
          :items="itemChoices"
          multiple
          create-item
          :search-input="{ placeholder: words.clientLines.searchItem }"
          :aria-label="words.clientLines.items(index + 1)"
          :disabled="disabled"
          class="w-full"
          data-testid="invoice-line-items"
          @update:model-value="update(index, { items: ($event as string[]).map(String) })"
          @create="createItem(index, $event)"
        >
          <template #default>
            <span v-if="line.items.length === 0" class="text-muted">{{ words.clientLines.itemsPlaceholder }}</span>
            <span v-else class="flex min-h-lh min-w-0 flex-wrap items-center gap-1">
              <UBadge v-for="item in line.items" :key="item" :label="item" color="neutral" variant="subtle" size="xs" class="max-w-full" data-testid="invoice-line-item" />
            </span>
          </template>
        </USelectMenu>
      </li>
    </ol>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <UButton :label="words.lines.add" icon="i-lucide-plus" size="sm" color="neutral" variant="outline" :disabled="disabled" data-testid="invoice-line-add" @click="add" />
      <p class="type-body">{{ words.lines.total }} <MoneyText :cents="total" class="font-medium text-highlighted" /></p>
    </div>
    <p class="max-w-prose type-aside">{{ intro }}</p>
  </section>
</template>
