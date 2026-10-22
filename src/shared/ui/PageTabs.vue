<script lang="ts">
import type { InjectionKey } from 'vue'

export interface PageTab {
  readonly value: string
  readonly label: string
  /** A Lucide icon name such as `i-lucide-tags`. */
  readonly icon?: string
  /** What waits in the tab, such as the rows of a queue, shown beside its label. Left out at zero. */
  readonly count?: number
}

/**
 * The selector of the cell at the right end of the tab row, which a page's Filters button moves
 * into on a phone. Null outside a tab strip.
 */
export const PAGE_TAB_ACTIONS: InjectionKey<string> = Symbol('page tab actions')
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UTabs from '@nuxt/ui/components/Tabs.vue'

import { stickyBandHeight, useStickyBandPart } from '../layout/stickyBand'
import { nameTab } from '../routing/browserTitle'

/**
 * The inner tabs of a page, kept in `?tab=` so a link opens the same tab and Back steps through
 * them. The first tab is the default and stays out of the address. Arrow keys move between the
 * tabs and Enter or Space opens one, so arrowing along never fills the history. The `above` slot
 * holds what every tab follows, such as a filter bar, so a phone still finds its Filters button
 * at the end of the tab row.
 */
const props = defineProps<{
  tabs: readonly PageTab[]
  /** The strip's accessible name, such as "Parts of the workbook". */
  label: string
}>()

const emit = defineEmits<{
  /** The person opened a tab, as opposed to arriving on it by a link. */
  select: [value: string]
}>()

defineSlots<Record<string, () => unknown>>()

const route = useRoute()
const router = useRouter()

const active = computed(() => props.tabs.find((tab) => tab.value === route.query.tab)?.value ?? props.tabs[0]?.value ?? '')
const items = computed(() => props.tabs.map((tab) => ({ label: tab.label, value: tab.value, slot: tab.value, ...(tab.icon === undefined ? {} : { icon: tab.icon }) })))
/** Labels this long leave a phone's tab row no room for the word on the Filters button. */
const CROWDED_LABELS = 16
const crowded = computed(() => props.tabs.reduce((length, tab) => length + tab.label.length, 0) > CROWDED_LABELS)
const countOf = (value: string | number): number => props.tabs.find((tab) => tab.value === value)?.count ?? 0

async function open(value: string | number): Promise<void> {
  const tab = String(value)
  if (tab === active.value) {
    return
  }
  emit('select', tab)
  const { tab: _previous, ...others } = route.query
  await router.push({ query: tab === props.tabs[0]?.value ? others : { ...others, tab } })
  await nextTick()
  // Picked from further down the page, the new tab would open out of sight, so the strip comes back into view.
  const strip = list()
  if (strip === null) {
    return
  }
  if (getComputedStyle(strip).position !== 'sticky') {
    if (strip.getBoundingClientRect().top < stickyBandHeight()) strip.scrollIntoView({ block: 'start' })
    return
  }
  // A sticky strip never leaves the screen, so the page scrolls back to where the strip stands unstuck.
  const above = (frame.value?.getBoundingClientRect().top ?? 0) - (stickyBandHeight() - strip.offsetHeight)
  if (above < 0) window.scrollBy({ top: above })
}

const frame = useTemplateRef<HTMLElement>('frame')
const root = useTemplateRef<{ $el: HTMLElement }>('root')
const list = (): HTMLElement | null => root.value?.$el.querySelector<HTMLElement>('[role="tablist"]') ?? null

const strip = shallowRef<HTMLElement | null>(null)
useStickyBandPart(strip)

const actionsId = useId()
provide(PAGE_TAB_ACTIONS, `#${actionsId}`)

/** Which ends of a strip wider than the page have tabs beyond them, so those edges fade. */
const overflow = ref({ start: false, end: false })

function measureOverflow(): void {
  const strip = list()
  overflow.value = strip === null ? { start: false, end: false } : { start: strip.scrollLeft > 1, end: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1 }
}

/**
 * The height of a strip that sticks, kept in `--page-tab-row` for the panels, so a bar of a panel
 * that sticks too, such as a search, sticks under the tab row.
 */
function measureRow(strip: HTMLElement): void {
  frame.value?.style.setProperty('--page-tab-row', getComputedStyle(strip).position === 'sticky' ? `${strip.offsetHeight}px` : '0px')
}

/** A strip wider than the page scrolls its open tab into the middle, so a link to the last tab shows it. */
function centreActiveTab(): void {
  const strip = list()
  if (strip) measureRow(strip)
  const trigger = strip?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
  if (strip && trigger && strip.scrollWidth > strip.clientWidth) {
    const stripBox = strip.getBoundingClientRect()
    const triggerBox = trigger.getBoundingClientRect()
    strip.scrollLeft += triggerBox.left - stripBox.left - (stripBox.width - triggerBox.width) / 2
  }
  measureOverflow()
}

let resizes: ResizeObserver | null = null
onMounted(() => {
  const mounted = list()
  if (mounted === null) {
    return
  }
  strip.value = mounted
  mounted.setAttribute('aria-label', props.label)
  mounted.addEventListener('scroll', measureOverflow, { passive: true })
  // The tabs too, since a web font that swaps in widens them without resizing the strip.
  resizes = new ResizeObserver(centreActiveTab)
  for (const watched of [mounted, ...mounted.querySelectorAll<HTMLElement>('[role="tab"]')]) resizes.observe(watched)
  centreActiveTab()
})
onBeforeUnmount(() => {
  resizes?.disconnect()
  list()?.removeEventListener('scroll', measureOverflow)
  nameTab(null)
})

watch(active, () => void nextTick(centreActiveTab))
watch(
  () => props.tabs.find((tab) => tab.value === active.value)?.label ?? null,
  (label) => nameTab(label),
  { immediate: true },
)
</script>

<template>
  <div ref="frame" class="page-tabs-frame" :class="{ 'has-above': $slots.above, crowded }">
    <slot name="above" />
    <!-- First in the page's order, so on a phone focus meets the Filters button just before the tabs it sits beside. -->
    <div :id="actionsId" class="page-tab-actions" data-testid="page-tab-actions" />
    <UTabs
      ref="root"
      :model-value="active"
      :items="items"
      activation-mode="manual"
      variant="link"
      color="neutral"
      class="page-tabs"
      :class="{ 'shared-width': tabs.length <= 4, 'fade-start': overflow.start, 'fade-end': overflow.end }"
      :ui="{ root: 'min-w-0 gap-5', list: 'page-tabs-list', indicator: 'bottom-0 h-0.5 bg-[var(--accent)]', trigger: 'page-tab shrink-0' }"
      data-testid="page-tabs"
      @update:model-value="open"
    >
      <template #trailing="{ item }">
        <template v-if="countOf(item.value) > 0">
          <span class="tab-count figure" aria-hidden="true">{{ countOf(item.value) }}</span>
          <span class="sr-only">, {{ countOf(item.value) }}</span>
        </template>
      </template>
      <template v-for="tab in tabs" :key="tab.value" #[tab.value]>
        <slot :name="tab.value" />
      </template>
    </UTabs>
  </div>
</template>

<style scoped>
/* The strip scrolls inside itself, so a longer list of tabs never widens the page. */
.page-tabs :deep(.page-tabs-list) {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  scroll-margin-top: calc(var(--sticky-band) + 0.75rem);
}

.page-tabs.fade-start :deep(.page-tabs-list) {
  mask-image: linear-gradient(to right, transparent, #000 2rem);
}

.page-tabs.fade-end :deep(.page-tabs-list) {
  mask-image: linear-gradient(to left, transparent, #000 2rem);
}

.page-tabs.fade-start.fade-end :deep(.page-tabs-list) {
  mask-image: linear-gradient(to right, transparent, #000 2rem, #000 calc(100% - 2rem), transparent);
}

.tab-count {
  min-width: 1.25rem;
  padding: 0 0.3125rem;
  border-radius: 999px;
  background: var(--surface-elevated);
  color: var(--ink-secondary);
  font-size: 0.6875rem;
  line-height: 1.125rem;
  text-align: center;
}

.page-tab-actions {
  display: none;
}

.page-tabs-frame.has-above > .page-tabs {
  margin-top: 1rem;
}

/*
 * On a phone the strip and the actions cell make one row that sticks under the top bar, across the
 * whole width. The tabs root steps aside, so the strip, the cell and the open panel share one grid.
 */
@media (max-width: 639px) {
  .page-tabs-frame {
    --gutter-start: max(1rem, env(safe-area-inset-left));
    --gutter-end: max(1rem, env(safe-area-inset-right));
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 1.25rem;
  }

  .page-tabs-frame > .page-tabs {
    display: contents;
  }

  .page-tabs :deep(.page-tabs-list),
  .page-tab-actions {
    position: sticky;
    top: calc(3.5rem + env(safe-area-inset-top));
    z-index: 10;
    grid-row: 1;
    background: color-mix(in srgb, var(--surface-page) 92%, transparent);
    backdrop-filter: blur(10px);
  }

  .page-tabs :deep(.page-tabs-list) {
    grid-column: 1;
    width: auto;
    max-width: none;
    margin-bottom: 0;
    margin-inline-start: calc(-1 * var(--gutter-start));
    padding-inline-start: var(--gutter-start);
  }

  .page-tab-actions {
    display: flex;
    grid-column: 2;
    align-items: center;
    margin-inline-end: calc(-1 * var(--gutter-end));
    padding-inline-end: var(--gutter-end);
    border-bottom: 1px solid var(--border-default);
  }

  .page-tabs :deep([data-slot='content']) {
    grid-column: 1 / -1;
  }

  .page-tabs-frame.has-above > .page-tabs {
    margin-top: 0;
  }

  .page-tabs-frame.has-above > :slotted(*) {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .page-tabs-frame.has-above :deep(.page-tabs-list),
  .page-tabs-frame.has-above .page-tab-actions {
    grid-row: 2;
  }
}

/*
 * Long tab labels leave no room for the word on a phone, so the Filters button keeps its icon and
 * count, and the word stays for a screen reader.
 */
@media (max-width: 639px) {
  .page-tabs-frame.crowded .page-tab-actions :deep(.filters-label) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

/*
 * A phone shares its width between four tabs or fewer, which then need no icons. Each tab grows from
 * its label's width, so a long label such as Breakdown is not cut short beside two short ones.
 */
@media (max-width: 639px) {
  .page-tabs.shared-width :deep(.page-tab) {
    flex: 1 1 auto;
    min-width: 0;
    justify-content: center;
    padding-inline: 0.5rem;
  }

  .page-tabs.shared-width :deep(.page-tab [data-slot='leadingIcon']) {
    display: none;
  }
}
</style>
