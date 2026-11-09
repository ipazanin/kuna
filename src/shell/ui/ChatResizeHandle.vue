<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

import { CHAT_DEFAULT_WIDTH, CHAT_MIN_WIDTH, resizeChat } from '../../shared/ai/presentation/chatDock'
import { words } from './words'

/**
 * The docked chat's leading edge, which widens the chat by drag, by double-click back to its default, and by keyboard as
 * the WAI-ARIA window splitter pattern says. Left Arrow widens, Right Arrow narrows, Home gives the smallest and End the widest.
 */
const props = defineProps<{
  /** The chat's drawn width in px. */
  width: number
  /** The widest the window lets the chat go in px. */
  widest: number
  /** The id of the chat's dock. */
  controls: string
}>()

const emit = defineEmits<{
  /** The width under the pointer during a drag, at most once a frame. The chat keeps it only on release. */
  drag: [width: number]
  release: []
}>()

const STEP = 16
const LONG_STEP = 64

const dragging = ref(false)
let start: { readonly x: number; readonly width: number } | null = null
let latest = 0
let frame = 0

function withinRoom(px: number): number {
  return Math.min(props.widest, Math.max(CHAT_MIN_WIDTH, Math.round(px)))
}

function grab(event: PointerEvent): void {
  if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return
  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  start = { x: event.clientX, width: props.width }
  latest = props.width
  dragging.value = true
  document.documentElement.classList.add('chat-resizing')
}

function follow(event: PointerEvent): void {
  if (start === null) return
  latest = withinRoom(start.width + start.x - event.clientX)
  if (frame === 0) {
    frame = requestAnimationFrame(() => {
      frame = 0
      emit('drag', latest)
    })
  }
}

function letGo(): void {
  if (start === null) return
  const moved = latest !== start.width
  cancelAnimationFrame(frame)
  frame = 0
  start = null
  dragging.value = false
  document.documentElement.classList.remove('chat-resizing')
  if (moved) resizeChat(latest)
  emit('release')
}

function press(event: KeyboardEvent): void {
  const step = event.shiftKey ? LONG_STEP : STEP
  const asked = { ArrowLeft: props.width + step, ArrowRight: props.width - step, Home: CHAT_MIN_WIDTH, End: props.widest }[event.key]
  if (asked === undefined) return
  event.preventDefault()
  resizeChat(withinRoom(asked))
}

onBeforeUnmount(letGo)
</script>

<template>
  <div
    role="separator"
    tabindex="0"
    aria-orientation="vertical"
    :aria-label="words.chatWidth"
    :aria-controls="controls"
    :aria-valuenow="width"
    :aria-valuemin="CHAT_MIN_WIDTH"
    :aria-valuemax="widest"
    class="chat-resize-handle z-control"
    :data-dragging="dragging || undefined"
    data-testid="chat-resize"
    @pointerdown="grab"
    @pointermove="follow"
    @pointerup="letGo"
    @pointercancel="letGo"
    @lostpointercapture="letGo"
    @dblclick="resizeChat(CHAT_DEFAULT_WIDTH)"
    @keydown="press"
  ></div>
</template>
