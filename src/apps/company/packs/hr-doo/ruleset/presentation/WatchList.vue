<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../../../shared/ui/ShowAllButton.vue'
import ConfidenceBadge from './ConfidenceBadge.vue'
import { ruleLink } from './ruleWording'
import type { WatchView } from './ruleWording'
import { words } from './words'
import { plural } from '../../../../../../shared/text/translation'

/** The estimates, pending and unconfirmed values, then the matters with no value yet. */
const props = defineProps<{
  items: readonly WatchView[]
  total: number
  checkedOn: string
  /** A search shows every match, so nothing it found is folded away. */
  searching: boolean
}>()

const expanded = ref(false)
const folds = computed(() => !props.searching && props.items.length > FIRST_SHOWN)
const shown = computed(() => (folds.value && !expanded.value ? props.items.slice(0, FIRST_SHOWN) : props.items))
</script>

<template>
  <AppCard :title="words.watch.title" collapse-id="settings.watch-list" start-collapsed :summary="plural(words.watch.summary(items.length), items.length)" data-testid="watch-list">
    <template #title>
      {{ words.watch.title }} <span class="figure font-normal text-muted">{{ items.length === total ? total : words.watch.shownOf(items.length, total) }}</span>
    </template>
    <template #subtitle>
      <span class="block max-w-[75ch]">{{ words.watch.about(checkedOn) }}</span>
    </template>
    <p v-if="items.length === 0" class="px-5 py-6 text-sm text-muted">{{ words.watch.nothing }}</p>
    <ul v-else class="watch-items px-4 pt-2 pb-3 sm:px-5">
      <li v-for="item in shown" :key="item.key" class="watch-item" data-testid="watch-item">
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <RouterLink v-if="item.ruleId !== null" :to="ruleLink(item.ruleId)" class="watch-title" data-testid="watch-rule-link">
            <span
              >{{ item.title }}<span v-if="item.period" class="figure font-normal text-muted">, {{ item.period }}</span></span
            >
          </RouterLink>
          <span v-else class="text-sm font-medium text-highlighted">{{ item.title }}</span>
          <ConfidenceBadge :confidence="item.confidence" />
        </div>
        <p class="mt-1 text-xs leading-relaxed text-toned">{{ item.note }}</p>
        <p class="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted">
          <span>{{ words.areas[item.area].label }}</span>
          <a v-if="item.url !== null" :href="item.url" target="_blank" rel="noopener noreferrer" class="watch-source">
            <span>{{ words.watch.openSource }}</span>
            <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
            <span class="sr-only">{{ words.watch.opensInNewTab }}</span>
          </a>
          <span v-else-if="item.ruleId === null">{{ words.watch.noSource }}</span>
        </p>
      </li>
    </ul>
    <ShowAllButton v-if="folds" v-model:expanded="expanded" :total="items.length" class="px-4 pb-4 sm:px-5" />
  </AppCard>
</template>

<style scoped>
.watch-items {
  display: grid;
  column-gap: 2rem;
}

@media (min-width: 1280px) {
  .watch-items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.watch-item {
  padding-block: 0.75rem;
  border-top: 1px solid var(--border-default);
}

.watch-title,
.watch-source {
  border-radius: 3px;
  text-decoration-line: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  transition: text-decoration-color 120ms ease;
}

.watch-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ink-strong);
}

.watch-source {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--ink-secondary);
}

.watch-title:hover,
.watch-source:hover {
  text-decoration-color: var(--accent);
}

@media (max-width: 639px) {
  .watch-title,
  .watch-source {
    display: inline-flex;
    align-items: center;
  }
}
</style>
