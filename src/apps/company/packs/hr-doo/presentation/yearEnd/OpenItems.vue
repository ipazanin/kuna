<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { OpenItemGroup } from '../../domain/yearEnd/yearEndOpenItems'
import type { FigureDetail } from '../tracedFigureView'
import type { RuleChip } from './LineBuildUp.vue'

export interface OpenItemView {
  readonly key: string
  readonly group: OpenItemGroup
  readonly title: string
  readonly settledBy: string
  readonly settled: boolean
  readonly cents: number | null
  readonly to: RouteLocationRaw | null
  /** A figure with no rows of its own, such as interest worked out per loan, opens its build-up instead. */
  readonly detail: FigureDetail | null
  readonly rules: readonly RuleChip[]
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import BuildUpButton from '../BuildUpButton.vue'
import FigureDialog from '../FigureDialog.vue'
import { GROUP_WORDING } from './yearEndWording'

/** The items to settle with the accountant, by group, each with what would settle it. */
const props = defineProps<{
  items: readonly OpenItemView[]
}>()

const ORDER: readonly OpenItemGroup[] = ['unexplained', 'judgement', 'completeness', 'compliance']

const opened = ref<FigureDetail | null>(null)
const dialogOpen = ref(false)

function openDetail(detail: FigureDetail): void {
  opened.value = detail
  dialogOpen.value = true
}

const groups = computed(() => ORDER.map((group) => ({ group, wording: GROUP_WORDING[group], items: props.items.filter((item) => item.group === group) })).filter((entry) => entry.items.length > 0))
</script>

<template>
  <div class="grid gap-x-8 gap-y-5 lg:grid-cols-2" data-testid="open-items">
    <section v-for="entry in groups" :key="entry.group" :aria-label="entry.wording.title" class="flex min-w-0 flex-col gap-2">
      <div>
        <h3 class="text-sm font-medium text-highlighted">{{ entry.wording.title }}</h3>
        <p class="text-xs text-muted">{{ entry.wording.description }}</p>
      </div>
      <ul class="flex flex-col">
        <li v-for="item in entry.items" :key="item.key" class="item-row" :data-settled="item.settled">
          <UIcon
            :name="item.settled ? 'i-lucide-circle-check' : 'i-lucide-circle-dot'"
            class="mt-0.5 size-4 shrink-0"
            :class="item.settled ? 'text-positive' : 'text-[var(--tone-warning)]'"
            aria-hidden="true"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="flex items-baseline justify-between gap-3">
              <p class="min-w-0 text-sm text-highlighted">{{ item.title }}</p>
              <BuildUpButton v-if="item.detail !== null" :cents="item.detail.cents" :label="item.title" class="shrink-0 text-sm text-toned" @open="openDetail(item.detail)" />
              <DrillLink v-else-if="item.cents !== null" :to="item.to" :label="`${item.title}, open the rows`" class="shrink-0">
                <MoneyText :cents="item.cents" class="text-sm text-toned" />
              </DrillLink>
            </div>
            <p class="text-xs text-muted">
              <span class="font-medium text-toned">{{ item.settled ? 'Still open if' : 'Settled by' }}</span> {{ item.settledBy }}
            </p>
            <ul v-if="item.rules.length > 0" class="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-4">
              <li v-for="rule in item.rules" :key="rule.id">
                <DrillLink :to="rule.to" :label="`${rule.title}, open the rule`" class="text-xs text-highlighted">{{ rule.title }}</DrillLink>
              </li>
            </ul>
          </div>
        </li>
      </ul>
    </section>
    <FigureDialog v-model:open="dialogOpen" :detail="opened" />
  </div>
</template>

<style scoped>
.item-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding-block: 0.5rem;
}

.item-row + .item-row {
  border-top: 1px solid var(--border-default);
}
</style>
