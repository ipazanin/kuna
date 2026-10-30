<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    points: readonly number[]
    width?: number
    height?: number
    /** Takes the width of its container, which `width` stands in for until it is measured. */
    fill?: boolean
    /** Any CSS colour for the line and its dot. Left out, a muted line with an accent dot. */
    colour?: string
    /** The index from which the points are still to come: from there the line is dashed in `aheadColour`, and the dot marks it. */
    aheadFrom?: number | undefined
    aheadColour?: string
    /** A hairline at zero, for a line that crosses it. */
    zeroLine?: boolean
    /** A second line on the same scale, drawn under the first, such as what the line is compared against. */
    against?: readonly number[]
    againstColour?: string
  }>(),
  { width: 88, height: 28, fill: false, zeroLine: false },
)

const INSET = 3

const svg = useTemplateRef<SVGSVGElement>('svg')
const measured = ref<number | null>(null)
let observer: ResizeObserver | null = null

// The svg exists only from two points on, so it is measured from when it appears.
watch(
  svg,
  (element) => {
    observer?.disconnect()
    observer = null
    if (!props.fill || element === null) return
    observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined && entry.contentRect.width > 0) measured.value = entry.contentRect.width
    })
    observer.observe(element)
  },
  { flush: 'post' },
)

onBeforeUnmount(() => observer?.disconnect())

const drawnWidth = computed(() => (props.fill ? (measured.value ?? props.width) : props.width))

const geometry = computed(() => {
  if (props.points.length < 2) return null
  const against = props.against ?? []
  const lowest = Math.min(...props.points, ...against, ...(props.zeroLine ? [0] : []))
  const highest = Math.max(...props.points, ...against, ...(props.zeroLine ? [0] : []))
  const span = highest - lowest || 1
  const stepX = (drawnWidth.value - INSET * 2) / (Math.max(props.points.length, against.length) - 1)
  const yOf = (point: number): number => INSET + (1 - (point - lowest) / span) * (props.height - INSET * 2)
  const placed = (points: readonly number[]) => points.map((point, index) => ({ x: INSET + index * stepX, y: yOf(point) }))
  const coordinates = placed(props.points)
  const joined = (points: readonly { x: number; y: number }[]): string => points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const pathOf = (from: number, to: number): string => joined(coordinates.slice(from, to))
  const split = props.aheadFrom === undefined ? coordinates.length - 1 : Math.min(Math.max(props.aheadFrom, 0), coordinates.length - 1)
  return {
    path: pathOf(0, split + 1),
    ahead: split < coordinates.length - 1 ? pathOf(split, coordinates.length) : null,
    dot: coordinates[split],
    against: against.length < 2 ? null : joined(placed(against)),
    zero: props.zeroLine && lowest < 0 && highest > 0 ? yOf(0) : null,
  }
})
</script>

<template>
  <svg v-if="geometry" ref="svg" :width="fill ? '100%' : width" :height="height" :viewBox="`0 0 ${drawnWidth} ${height}`" class="block shrink-0 overflow-visible" aria-hidden="true">
    <line v-if="geometry.zero !== null" x1="0" :x2="drawnWidth" :y1="geometry.zero" :y2="geometry.zero" stroke="var(--chart-axis)" stroke-width="1" />
    <polyline
      v-if="geometry.against !== null"
      :points="geometry.against"
      fill="none"
      :stroke="againstColour ?? 'var(--chart-ink-muted)'"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <polyline :points="geometry.path" fill="none" :stroke="colour ?? 'var(--chart-ink-muted)'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <polyline
      v-if="geometry.ahead !== null"
      :points="geometry.ahead"
      fill="none"
      :stroke="aheadColour ?? colour ?? 'var(--chart-ink-muted)'"
      stroke-width="1.5"
      stroke-dasharray="4 3"
      stroke-linejoin="round"
    />
    <circle v-if="geometry.dot" :cx="geometry.dot.x" :cy="geometry.dot.y" r="3" :fill="colour ?? 'var(--accent)'" stroke="var(--surface-raised)" stroke-width="1.5" />
  </svg>
</template>
