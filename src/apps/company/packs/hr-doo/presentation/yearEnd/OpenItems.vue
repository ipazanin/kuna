<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { OpenItemGroup } from '../../domain/yearEnd/yearEndOpenItems'
import type { AskableDetail } from '../tracedFigureView'
import type { RuleChip } from './LineBuildUp.vue'

export interface OpenItemView {
  readonly key: string
  readonly group: OpenItemGroup
  readonly title: string
  readonly settledBy: string
  readonly settled: boolean
  readonly cents: Money | null
  readonly to: RouteLocationRaw | null
  /** A figure with no rows of its own, such as interest worked out per loan, opens its build-up instead. */
  readonly detail: AskableDetail | null
  readonly rules: readonly RuleChip[]
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AskChatButton from '../../../../../../shared/ai/presentation/AskChatButton.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import BuildUpButton from '../BuildUpButton.vue'
import FigureAsk from '../FigureAsk.vue'
import FigureDialog from '../FigureDialog.vue'
import { GROUP_WORDING } from './yearEndWording'
import { words as packWords } from '../words'
import { words } from './words'
import type { Money } from '../../../../../../shared/money/money'

/** The items to settle with the accountant, by group, each with what would settle it. */
const props = defineProps<{
  items: readonly OpenItemView[]
}>()

const ORDER: readonly OpenItemGroup[] = ['unexplained', 'judgement', 'completeness', 'compliance']

const opened = ref<AskableDetail | null>(null)
const dialogOpen = ref(false)

function openDetail(detail: AskableDetail): void {
  opened.value = detail
  dialogOpen.value = true
}

const groups = computed(() => ORDER.map((group) => ({ group, wording: GROUP_WORDING[group], items: props.items.filter((item) => item.group === group) })).filter((entry) => entry.items.length > 0))
</script>

<template>
  <div class="grid gap-x-8 gap-y-5 @2xl:grid-cols-2" data-testid="open-items">
    <section v-for="entry in groups" :key="entry.group" :aria-label="entry.wording.title" class="flex min-w-0 flex-col gap-2">
      <div>
        <h3 class="text-sm font-medium text-highlighted">{{ entry.wording.title }}</h3>
        <p class="text-xs text-muted">{{ entry.wording.description }}</p>
      </div>
      <ul class="flex flex-col">
        <FigureAsk v-for="item in entry.items" :key="item.key" v-slot="{ ask, askLabel, marked }" :detail="item.detail">
          <li class="item-row" :data-settled="item.settled" v-bind="marked">
            <UIcon :name="item.settled ? 'i-lucide-circle-check' : 'i-lucide-circle-dot'" class="mt-0.5 size-4 shrink-0" :class="item.settled ? 'text-success' : 'text-warning'" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div class="flex items-baseline justify-between gap-3">
                <p class="min-w-0 text-sm text-highlighted">{{ item.title }}</p>
                <span v-if="item.detail !== null" class="inline-flex shrink-0 items-center gap-0.5">
                  <BuildUpButton :cents="item.detail.cents" :label="item.title" class="text-sm text-toned" @open="openDetail(item.detail)" />
                  <AskChatButton v-if="askLabel" :label="askLabel" icon-only @ask="ask" />
                </span>
                <DrillLink v-else-if="item.cents !== null" :to="item.to" :label="packWords.figure.openRows(item.title)" class="shrink-0">
                  <MoneyText :cents="item.cents" class="text-sm text-toned" />
                </DrillLink>
              </div>
              <p class="text-xs text-muted">
                <span class="font-medium text-toned">{{ item.settled ? words.openItems.stillOpenIf : words.openItems.settledBy }}</span> {{ item.settledBy }}
              </p>
              <ul v-if="item.rules.length > 0" class="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-4">
                <li v-for="rule in item.rules" :key="rule.id">
                  <DrillLink :to="rule.to" :label="packWords.figure.openRule(rule.title)" class="text-xs text-highlighted">{{ rule.title }}</DrillLink>
                </li>
              </ul>
            </div>
          </li>
        </FigureAsk>
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
