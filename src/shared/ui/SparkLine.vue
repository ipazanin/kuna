<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    points: readonly number[]
    width?: number
    height?: number
  }>(),
  { width: 88, height: 28 },
)

const INSET = 3

const geometry = computed(() => {
  if (props.points.length < 2) return null
  const lowest = Math.min(...props.points)
  const highest = Math.max(...props.points)
  const span = highest - lowest || 1
  const stepX = (props.width - INSET * 2) / (props.points.length - 1)
  const coordinates = props.points.map((point, index) => ({
    x: INSET + index * stepX,
    y: INSET + (1 - (point - lowest) / span) * (props.height - INSET * 2),
  }))
  return {
    path: coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    last: coordinates[coordinates.length - 1],
  }
})
</script>

<template>
  <svg
    v-if="geometry"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="block shrink-0 overflow-visible"
    aria-hidden="true"
  >
    <polyline
      :points="geometry.path"
      fill="none"
      stroke="var(--chart-ink-muted)"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle
      v-if="geometry.last"
      :cx="geometry.last.x"
      :cy="geometry.last.y"
      r="3"
      fill="var(--accent)"
      stroke="var(--surface-raised)"
      stroke-width="1.5"
    />
  </svg>
</template>
