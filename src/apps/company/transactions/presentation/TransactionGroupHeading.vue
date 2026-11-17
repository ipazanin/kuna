<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { negateMoney } from '../../../../shared/money/money'
import { formatPercent } from '../../../../shared/money/moneyFormat'
import { pointsOfShare } from '../../../../shared/money/percent'
import CutText from '../../../../shared/ui/CutText.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { inSentence } from '../../settings/domain/profitAndLossLabels'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { isDefinedBucket } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { useCategoryColours } from '../../workbook/presentation/categoryColours'
import type { GroupShare, TransactionGroup } from '../domain/transactionGroups'
import CategoryChip from './CategoryChip.vue'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'

/** The heading of one group of transactions, which collapses and expands the group. */
const props = defineProps<{
  group: TransactionGroup
  expanded: boolean
  bucketLabels: Readonly<Record<DefinedBucket, string>>
}>()

const emit = defineEmits<{
  toggle: []
}>()

const names = useDisplayNames()
const colours = useCategoryColours()

const rowCount = computed(() => plural(words.rows(props.group.rows.length), props.group.rows.length))

const bucketLabel = computed(() => {
  const shown = props.group
  if (shown.kind !== 'category') return ''
  return isDefinedBucket(shown.bucket) ? props.bucketLabels[shown.bucket] : words.unclassified
})

const share = computed<GroupShare | null>(() => (props.group.kind === 'month' ? null : props.group.share))

const shareWhole = computed(() => {
  switch (share.value?.of) {
    case 'income':
      return inSentence(props.bucketLabels.income)
    case 'cost':
      return words.group.wholes.cost
    case 'money-in':
      return words.group.wholes.moneyIn
    default:
      return words.group.wholes.moneyOut
  }
})

/** A category's bar wears its colour, or its bucket's. A counterparty has no colour of its own. */
const shareColour = computed(() => (props.group.kind === 'category' ? colours.value(props.group.category, props.group.bucket) : 'var(--chart-deemphasis)'))

const groupName = computed(() => {
  const shown = props.group
  if (shown.kind === 'month') return monthLabel(shown.month)
  if (shown.kind === 'category') return shown.category === '' ? words.noCategory : names.value.category(shown.category)
  return shown.label || words.noCounterparty
})
</script>

<template>
  <!-- A card narrower than a month's name and three figures on one line moves the figures under the name. Both lists that hold the heading are containers. -->
  <!-- Below 640 px the group's name wraps, since a phone cannot long press a toggle to read a cut name. -->
  <button
    type="button"
    class="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 py-2.5 ps-3 pe-4 text-start text-[0.8125rem] text-highlighted transition-colors hover:bg-accented focus-visible:-outline-offset-2 @max-[44rem]:grid-cols-[auto_minmax(0,1fr)] @max-[44rem]:gap-y-1.5 @max-[44rem]:py-2"
    :aria-expanded="expanded"
    data-testid="group-toggle"
    @click="emit('toggle')"
  >
    <UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition-transform motion-reduce:transition-none" :class="{ '-rotate-90': !expanded }" aria-hidden="true" />

    <span class="flex min-w-0 items-center gap-3 @max-[44rem]:gap-2">
      <template v-if="group.kind === 'category'">
        <CategoryChip :category="group.category" :bucket="group.bucket" wraps-on-phone class="min-w-0 shrink" />
        <span class="type-caption whitespace-nowrap">{{ bucketLabel }}</span>
      </template>
      <template v-else-if="group.kind === 'month'">
        <CutText class="min-w-0 font-medium max-sm:break-words max-sm:whitespace-normal">{{ groupName }}</CutText>
        <span v-if="group.coverage !== 'complete'" class="inline-flex items-center gap-1.5 type-caption whitespace-nowrap">
          <span class="swatch swatch-hatched" :style="{ '--swatch': 'var(--chart-deemphasis)' }" aria-hidden="true" />
          {{ group.coverage === 'month-so-far' ? words.group.monthSoFar : words.group.partMonth }}
        </span>
      </template>
      <template v-else>
        <CutText class="min-w-0 font-medium max-sm:break-words max-sm:whitespace-normal">{{ groupName }}</CutText>
        <CutText v-if="group.iban" class="font-mono tracking-[-0.01em] type-caption max-sm:min-w-12 max-sm:flex-1">{{ group.iban }}</CutText>
      </template>
      <span class="figure shrink-0 type-caption whitespace-nowrap">{{ rowCount }}</span>
    </span>

    <span class="flex items-center justify-end gap-5 @max-[44rem]:col-start-2 @max-[44rem]:flex-wrap @max-[44rem]:justify-between @max-[44rem]:gap-x-3 @max-[44rem]:gap-y-1">
      <template v-if="group.kind === 'month'">
        <span class="inline-flex items-baseline gap-1.5">
          <span class="type-caption whitespace-nowrap">{{ bucketLabels.income }}</span>
          <MoneyText :cents="group.income" tone="flow" />
        </span>
        <span class="inline-flex items-baseline gap-1.5">
          <span class="type-caption whitespace-nowrap">{{ words.group.costs }}</span>
          <MoneyText :cents="negateMoney(group.cost)" tone="flow" />
        </span>
        <span class="inline-flex items-baseline gap-1.5">
          <span class="type-caption whitespace-nowrap">{{ words.group.net }}</span>
          <MoneyText :cents="group.net" tone="outcome" class="font-medium" />
        </span>
      </template>
      <template v-else>
        <span
          v-if="share"
          class="inline-flex w-34 items-center gap-2 @max-[44rem]:w-auto @max-[44rem]:max-w-40 @max-[44rem]:flex-1"
          :title="words.group.shareOf(formatPercent(share.fraction), shareWhole)"
        >
          <span class="h-1 flex-1 overflow-hidden rounded-xs bg-accented" aria-hidden="true">
            <span class="block h-full rounded-xs" :style="{ width: `${Math.min(100, Math.max(0, pointsOfShare(share.fraction)))}%`, background: shareColour }" />
          </span>
          <span class="figure w-12 text-end type-caption">{{ formatPercent(share.fraction) }}</span>
          <span class="sr-only">{{ words.group.ofWhole(shareWhole) }}</span>
        </span>
        <span v-else class="inline-flex w-34 @max-[44rem]:w-auto @max-[44rem]:max-w-40 @max-[44rem]:flex-1" aria-hidden="true" />
        <MoneyText :cents="group.total" tone="flow" class="min-w-26 text-end font-medium @max-[44rem]:min-w-0" />
      </template>
    </span>
  </button>
</template>
