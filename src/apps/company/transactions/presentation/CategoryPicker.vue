<script setup lang="ts">
import { computed } from 'vue'

import OptionalSelect from '../../../../shared/ui/OptionalSelect.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import type { Category } from '../../workbook/domain/workbook'
import { useCategoryColours } from '../../workbook/presentation/categoryColours'
import { naturalOrder } from '../../../../shared/text/naturalOrder'
import { words } from './words'

/** A searchable list of the categories tab, by screen name and by slug. Nothing outside the tab can be picked. */
const props = withDefaults(
  defineProps<{
    categories: readonly Category[]
    /** What the closed picker says before a choice. */
    placeholder?: string
    /** Offers "No category" as the first choice, which a review rule may name. */
    allowNone?: boolean
    disabled?: boolean
    loading?: boolean
  }>(),
  { placeholder: words.picker.choose, allowNone: false, disabled: false, loading: false },
)

const chosen = defineModel<string | undefined>()

/** The pick as the shared select binds it, blank while no category is picked. */
const optionalValue = computed({
  get: () => chosen.value ?? '',
  set: (value: string) => {
    chosen.value = value
  },
})

const names = useDisplayNames()
const colours = useCategoryColours()

interface Choice {
  readonly label: string
  readonly value: string
  /** The category's slug, which the menu shows beside or under the label as room allows. */
  readonly description?: string
  readonly colour: string
}

const items = computed<Choice[]>(() =>
  props.categories
    .map((category): Choice => ({ label: names.value.category(category.slug), value: category.slug, description: category.slug, colour: colours.value(category.slug, category.bucket) }))
    .sort((left, right) => naturalOrder(left.label, right.label)),
)

const picked = computed(() => items.value.find((item) => item.value === chosen.value) ?? null)

const MENU_UI = {
  content: 'w-max min-w-[max(16rem,var(--reka-combobox-trigger-width))] max-w-[calc(100vw-1.5rem)]',
  itemWrapper: 'flex-row flex-wrap items-baseline gap-x-3',
  itemDescription: 'identifier ms-auto',
}
const MENU_CONTENT = { align: 'start', collisionPadding: 12 } as const
</script>

<template>
  <OptionalSelect
    v-model="optionalValue"
    :items="items"
    :none="allowNone ? words.noCategory : placeholder"
    :search="words.picker.search"
    :clearable="allowNone"
    :filter-fields="['label', 'value']"
    :content="MENU_CONTENT"
    :ui="MENU_UI"
    :disabled="disabled"
    :loading="loading"
    color="neutral"
    variant="outline"
    class="min-w-0 sm:min-w-48"
  >
    <span v-if="picked" class="flex min-w-0 items-center gap-1.5">
      <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: picked.colour }" aria-hidden="true" />
      <span class="truncate">{{ picked.label }}</span>
    </span>
    <span v-else class="text-muted">{{ allowNone ? words.noCategory : placeholder }}</span>
    <template #item-leading="{ item }">
      <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: 'colour' in item ? item.colour : 'transparent' }" aria-hidden="true" />
    </template>
  </OptionalSelect>
</template>
