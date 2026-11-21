<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UPopover from '@nuxt/ui/components/Popover.vue'

import RemovableChip from './RemovableChip.vue'
import { words } from './words'

/**
 * The active filters as removable chips, with Clear once any is active. In one line, the chips that
 * do not fit fold into "+N more", so the line keeps its height however many there are. The chips, "+N more"
 * for each N and Clear are measured on a copy in a box of no size, so the copy never widens the line.
 */
const props = withDefaults(
  defineProps<{
    chips: readonly { readonly id: string; readonly label: string }[]
    /** One line that folds its overflow. Off, the chips wrap, as in the phone's filter sheet. */
    oneLine?: boolean
  }>(),
  { oneLine: false },
)

const emit = defineEmits<{
  remove: [chipId: string]
  clear: []
}>()

const row = useTemplateRef<HTMLElement>('row')
const measuredChips = useTemplateRef<HTMLElement>('measuredChips')
const measuredMore = useTemplateRef<HTMLElement>('measuredMore')
const measuredClear = useTemplateRef<HTMLElement>('measuredClear')
const shownCount = ref(props.chips.length)

const shownChips = computed(() => (props.oneLine ? props.chips.slice(0, shownCount.value) : props.chips))
const foldedChips = computed(() => (props.oneLine ? props.chips.slice(shownCount.value) : []))

const GAP = 6

function widthsIn(copy: HTMLElement | null): number[] {
  return [...(copy?.children ?? [])].map((element) => (element as HTMLElement).offsetWidth)
}

/** How many chips fit beside Clear and, when some fold, beside "+N more" for that N, each measured on the copy. */
function fit(): void {
  const available = row.value?.clientWidth ?? 0
  const chipWidths = widthsIn(measuredChips.value)
  const moreWidths = widthsIn(measuredMore.value)
  const clearWidth = measuredClear.value?.offsetWidth ?? 0
  const lineWidth = (count: number): number => {
    const folded = chipWidths.length - count
    const more = folded > 0 ? (moreWidths[folded - 1] ?? 0) + GAP : 0
    return chipWidths.slice(0, count).reduce((sum, width) => sum + width + GAP, more + clearWidth)
  }
  let count = chipWidths.length
  while (count > 0 && lineWidth(count) > available) count -= 1
  shownCount.value = count
}

let observer: ResizeObserver | undefined
onMounted(() => {
  if (!props.oneLine || row.value === null) return
  observer = new ResizeObserver(fit)
  observer.observe(row.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => props.chips,
  () => {
    if (props.oneLine) void nextTick(fit)
  },
)
</script>

<template>
  <div ref="row" class="relative flex min-w-0 flex-1 items-center gap-1.5" :class="oneLine ? 'overflow-hidden' : 'flex-wrap'">
    <div class="contents" :aria-label="words.chips.group" role="group">
      <RemovableChip v-for="chip in shownChips" :key="chip.id" :label="chip.label" :remove-label="words.chips.remove(chip.label)" data-testid="filter-chip" @remove="emit('remove', chip.id)" />
      <UPopover v-if="foldedChips.length" :content="{ align: 'start', collisionPadding: 12 }">
        <UButton :label="words.chips.more(foldedChips.length)" color="neutral" variant="ghost" size="xs" class="shrink-0" data-testid="more-filters" />
        <template #content>
          <ul class="flex max-w-80 flex-col items-start gap-1 p-2">
            <li v-for="chip in foldedChips" :key="chip.id">
              <RemovableChip :label="chip.label" :remove-label="words.chips.remove(chip.label)" @remove="emit('remove', chip.id)" />
            </li>
          </ul>
        </template>
      </UPopover>
    </div>
    <UButton v-if="chips.length" :label="words.chips.clear" color="neutral" variant="link" size="xs" class="shrink-0" @click="emit('clear')" />
    <div v-if="oneLine" class="pointer-events-none invisible absolute size-0 overflow-hidden" aria-hidden="true" inert data-testid="filter-chip-copy">
      <div ref="measuredChips" class="flex w-max gap-1.5">
        <RemovableChip v-for="chip in chips" :key="chip.id" :label="chip.label" :remove-label="words.chips.remove(chip.label)" />
      </div>
      <div ref="measuredMore" class="flex w-max gap-1.5">
        <UButton v-for="folded in chips.length" :key="folded" :label="words.chips.more(folded)" color="neutral" variant="ghost" size="xs" class="shrink-0" />
      </div>
      <div class="flex w-max">
        <span ref="measuredClear" class="flex"><UButton :label="words.chips.clear" color="neutral" variant="link" size="xs" class="shrink-0" /></span>
      </div>
    </div>
  </div>
</template>
