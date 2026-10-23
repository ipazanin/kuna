<script setup lang="ts">
import { computed } from 'vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import type { SelectMenuItem } from '@nuxt/ui/components/SelectMenu.vue'

import { bucketTone } from '../../../shared/charts/chartTokens'
import { useSettings } from '../../settings/application/useSettings'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useCategoryColours } from '../../workbook/presentation/categoryColours'
import { BUCKETS } from '../../workbook/domain/bucket'
import { counterpartyLabels } from '../../workbook/domain/counterpartyIdentity'
import type { Workbook } from '../../workbook/domain/workbook'
import { EVERY_OWNER_ADVANCE_LABEL } from '../domain/filterChips'
import { EVERY_OWNER_ADVANCE } from '../domain/filterState'

/** A searchable menu that adds or removes a bucket, category or counterparty filter. Its values are chip ids. */
const props = defineProps<{
  workbook: Workbook
}>()

const chosen = defineModel<string[]>({ required: true })

const settings = useSettings()
const names = useDisplayNames()
const colours = useCategoryColours()

interface Choice {
  readonly label: string
  readonly value: string
  /** The colour that marks the choice: a bucket's, or a category's own. Counterparties have none. */
  readonly colour?: string
}

const groups = computed<SelectMenuItem[][]>(() => {
  const buckets = BUCKETS.filter((bucket) => settings.value.ownerPayModule || bucket !== 'owner-pay')
  const counterparties = [...counterpartyLabels(props.workbook.transactions)].sort(([, left], [, right]) => left.localeCompare(right))
  return [
    [
      { type: 'label' as const, label: 'Buckets' },
      ...buckets.map((bucket): Choice => ({ label: settings.value.bucketLabels[bucket], value: `buckets:${bucket}`, colour: `var(--bucket-${bucketTone(bucket)})` })),
    ],
    [
      { type: 'label' as const, label: 'Categories' },
      ...props.workbook.categories.map((category): Choice => ({ label: names.value.category(category.slug), value: `categories:${category.slug}`, colour: colours.value(category.slug, category.bucket) })),
      ...(props.workbook.ownerAdvances.length === 0 ? [] : [{ label: EVERY_OWNER_ADVANCE_LABEL, value: `categories:${EVERY_OWNER_ADVANCE}` }]),
    ],
    [
      { type: 'label' as const, label: 'Counterparties' },
      ...counterparties.map(([key, label]): Choice => ({ label, value: `counterparties:${key}` })),
    ],
  ]
})
</script>

<template>
  <USelectMenu
    v-model="chosen"
    :items="groups"
    value-key="value"
    multiple
    icon="i-lucide-plus"
    color="neutral"
    variant="outline"
    size="sm"
    :search-input="{ placeholder: 'Search buckets, categories, counterparties' }"
    :content="{ align: 'start', collisionPadding: 12 }"
    :ui="{ content: 'min-w-72' }"
    aria-label="Add filter"
    class="w-auto shrink-0"
    data-testid="add-filter"
  >
    <span class="text-default">Add filter</span>
    <template #trailing />
    <template #item-leading="{ item }">
      <span
        v-if="typeof item === 'object' && item !== null && 'colour' in item && item.colour"
        class="size-2 shrink-0 rounded-[2px]"
        :style="{ background: item.colour }"
        aria-hidden="true"
      />
    </template>
  </USelectMenu>
</template>
