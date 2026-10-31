<script setup lang="ts">
import { computed } from 'vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

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
  }>(),
  { placeholder: words.picker.choose, allowNone: false, disabled: false },
)

const chosen = defineModel<string | undefined>()

/** The menu needs a value for "No category" that is not blank. Slugs are trimmed, so none starts with a space. */
const NONE = ' none'

const menuValue = computed({
  get: () => (chosen.value === '' && props.allowNone ? NONE : chosen.value),
  set: (value: string | undefined) => {
    chosen.value = value === NONE ? '' : value
  },
})

const names = useDisplayNames()
const colours = useCategoryColours()

interface Choice {
  readonly label: string
  readonly value: string
  /** The category's colour, null for "No category". */
  readonly colour: string | null
}

const items = computed<Choice[]>(() => [
  ...(props.allowNone ? [{ label: words.noCategory, value: NONE, colour: null }] : []),
  ...props.categories
    .map((category): Choice => ({ label: names.value.category(category.slug), value: category.slug, colour: colours.value(category.slug, category.bucket) }))
    .sort((left, right) => naturalOrder(left.label, right.label)),
])

const picked = computed(() => items.value.find((item) => item.value === menuValue.value) ?? null)
</script>

<template>
  <USelectMenu
    v-bind="menuValue === undefined ? {} : { modelValue: menuValue }"
    :items="items"
    value-key="value"
    :filter-fields="['label', 'value']"
    :search-input="{ placeholder: words.picker.search }"
    :content="{ align: 'start', collisionPadding: 12 }"
    :ui="{ content: 'min-w-64' }"
    :disabled="disabled"
    color="neutral"
    variant="outline"
    class="min-w-48"
    @update:model-value="menuValue = $event"
  >
    <span v-if="picked" class="flex min-w-0 items-center gap-1.5">
      <span v-if="picked.colour" class="size-2 shrink-0 rounded-[2px]" :style="{ background: picked.colour }" aria-hidden="true" />
      <span class="truncate">{{ picked.label }}</span>
    </span>
    <span v-else class="text-muted">{{ placeholder }}</span>
    <template #item-leading="{ item }">
      <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: item.colour ?? 'transparent' }" aria-hidden="true" />
    </template>
    <template #item-trailing="{ item }">
      <span v-if="item.value !== NONE" class="identifier text-xs text-muted">{{ item.value }}</span>
    </template>
  </USelectMenu>
</template>
