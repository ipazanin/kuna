<script setup lang="ts">
import { onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { rememberCollapse, storedCollapse } from './cardCollapse'
import InfoPopover from './InfoPopover.vue'

/**
 * The raised card every screen is built from. With a title it has a header, and with a collapse id
 * the header gets a toggle that hides the body. Without a title it is the bare surface, for tiles.
 */
const props = withDefaults(
  defineProps<{
    title?: string | undefined
    subtitle?: string | undefined
    /** What the card's figure means, behind an info button in the header. */
    definition?: string | undefined
    as?: string
    heading?: 'h2' | 'h3'
    /** Makes the card collapsible and names it for this device's memory, as screen and card, such as "invoicing.months". */
    collapseId?: string
    /** The one line a collapsed card shows under its title, such as the row count or the total. */
    summary?: string | undefined
    startCollapsed?: boolean
    /** True while the address points into the card, such as a deep link to one of its rows. Each such visit opens it, and that is not remembered. */
    reveal?: boolean
  }>(),
  { as: 'section', heading: 'h2', startCollapsed: false, reveal: false },
)

const titleId = useId()
const bodyId = useId()

const collapsed = ref(props.collapseId !== undefined && !props.reveal && (storedCollapse(props.collapseId) ?? props.startCollapsed))

const route = useRoute()
watch(
  () => [props.reveal, route.fullPath] as const,
  ([revealed]) => {
    if (revealed) collapsed.value = false
  },
)

/**
 * A card that first renders once its data has loaded comes after the router's scroll, so a deep link
 * into it scrolls to its target itself.
 */
const root = useTemplateRef<HTMLElement>('root')
onMounted(() => {
  const target = props.reveal && route.hash !== '' ? document.getElementById(route.hash.slice(1)) : null
  if (target !== null && root.value?.contains(target)) {
    target.scrollIntoView({ block: 'start' })
  }
})

function toggle(): void {
  collapsed.value = !collapsed.value
  if (props.collapseId !== undefined) rememberCollapse(props.collapseId, collapsed.value)
}
</script>

<template>
  <component
    :is="as"
    ref="root"
    class="flex min-w-0 flex-col rounded-card border border-default bg-raised shadow-raised"
    :class="{ 'h-fit': collapsed }"
    :aria-labelledby="title === undefined ? undefined : titleId"
    :data-card="collapseId"
    :data-collapsed="collapseId === undefined ? undefined : String(collapsed)"
  >
    <template v-if="title !== undefined">
      <header class="flex flex-col gap-3 px-4 pt-4 sm:px-5" :class="{ 'pb-4': collapsed || !$slots.default }">
        <div class="flex items-start gap-3">
          <div class="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1 basis-48">
              <component :is="heading" :id="titleId" class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <slot name="title">{{ title }}</slot>
              </component>
              <p v-if="collapsed" class="mt-0.5 text-xs text-muted" data-testid="card-summary">{{ summary ?? subtitle }}</p>
              <p v-else-if="subtitle !== undefined || $slots.subtitle" class="mt-0.5 text-xs text-muted">
                <slot name="subtitle">{{ subtitle }}</slot>
              </p>
            </div>
            <div v-if="$slots.actions && !collapsed" class="flex shrink-0 flex-wrap items-center gap-2">
              <slot name="actions" />
            </div>
          </div>
          <div v-if="definition !== undefined || collapseId !== undefined" class="-my-1 -me-1.5 flex shrink-0 items-center">
            <InfoPopover v-if="definition !== undefined" :subject="title" :definition="definition" />
            <UButton
              v-if="collapseId !== undefined"
              icon="i-lucide-chevron-down"
              color="neutral"
              variant="ghost"
              class="card-toggle text-muted"
              :class="{ turned: !collapsed }"
              :aria-label="title"
              :aria-expanded="!collapsed"
              :aria-controls="bodyId"
              data-testid="card-toggle"
              @click="toggle"
            />
          </div>
        </div>
        <div v-if="$slots.header && !collapsed">
          <slot name="header" />
        </div>
      </header>
      <div v-if="$slots.default" v-show="!collapsed" :id="bodyId" class="flex min-w-0 grow flex-col">
        <slot />
      </div>
    </template>
    <slot v-else />
  </component>
</template>

<style scoped>
/* A 44 px target that reaches into the header's padding, so the header keeps the height of its title. */
.card-toggle {
  width: 2.75rem;
  height: 2.75rem;
  margin: -0.625rem -0.25rem -0.625rem 0;
  justify-content: center;
}

.card-toggle :deep(svg) {
  transition: transform 160ms ease;
}

.card-toggle.turned :deep(svg) {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .card-toggle :deep(svg) {
    transition: none;
  }
}
</style>
