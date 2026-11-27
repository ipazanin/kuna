<script lang="ts">
type Way = 'up' | 'down'

/** The arrow last pressed in any list, so only that row's buttons take focus back once its move settles. */
let pressedLast: { readonly owner: symbol; readonly way: Way } | null = null
</script>

<script setup lang="ts">
/**
 * The pair of buttons that moves a row of an ordered list one place up or down, each 44 px square so a thumb reaches it on a phone.
 * Once a move settles and focus has dropped from the pressed arrow, because it went disabled at the list's end or while its write
 * ran, focus goes back to it or to the other arrow. That needs the list keyed by its rows, so these buttons travel with their row.
 */
import { nextTick, useTemplateRef, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

const props = withDefaults(
  defineProps<{
    /** What the up button is called aloud, such as "Move Groceries up". */
    upLabel: string
    downLabel: string
    first: boolean
    last: boolean
    /** True while the list takes no moves, such as while the file is read-only. */
    disabled?: boolean
    /** The move whose write runs, which shows loading on its button, or null. */
    saving?: Way | null
    /** What the buttons' test ids start with, such as `spending-rule`, which names them `spending-rule-up` and `spending-rule-down`. */
    testId?: string
  }>(),
  { disabled: false, saving: null, testId: 'move' },
)
const emit = defineEmits<{ up: []; down: [] }>()

const owner = Symbol('move buttons')
const root = useTemplateRef<HTMLElement>('root')
const arrows = { up: useTemplateRef<ComponentPublicInstance>('up'), down: useTemplateRef<ComponentPublicInstance>('down') }

function opens(way: Way): boolean {
  return !props.disabled && !(way === 'up' ? props.first : props.last)
}

function press(way: Way): void {
  pressedLast = { owner, way }
  if (way === 'up') emit('up')
  else emit('down')
  void nextTick(keepFocus)
}

function keepFocus(): void {
  if (pressedLast?.owner !== owner || props.saving !== null) return
  const active = document.activeElement
  const dropped = active === null || active === document.body || (active instanceof HTMLButtonElement && active.disabled && root.value?.contains(active) === true)
  if (!dropped) return
  const pressedFirst: readonly Way[] = pressedLast.way === 'up' ? ['up', 'down'] : ['down', 'up']
  const target = pressedFirst.find(opens)
  if (target !== undefined) (arrows[target].value?.$el as HTMLElement | undefined)?.focus()
}

watch(() => [props.first, props.last, props.disabled, props.saving], keepFocus, { flush: 'post' })
</script>

<template>
  <div ref="root" class="flex shrink-0 items-center">
    <UButton
      ref="up"
      icon="i-lucide-arrow-up"
      color="neutral"
      variant="ghost"
      class="size-11 justify-center"
      :aria-label="upLabel"
      :disabled="first || disabled"
      :loading="saving === 'up'"
      :data-testid="`${testId}-up`"
      @click="press('up')"
    />
    <UButton
      ref="down"
      icon="i-lucide-arrow-down"
      color="neutral"
      variant="ghost"
      class="size-11 justify-center"
      :aria-label="downLabel"
      :disabled="last || disabled"
      :loading="saving === 'down'"
      :data-testid="`${testId}-down`"
      @click="press('down')"
    />
  </div>
</template>
