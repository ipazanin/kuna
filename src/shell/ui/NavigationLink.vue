<script setup lang="ts">
import { RouterLink } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

import { plural } from '../../shared/text/translation'
import AppMark from '../../shared/ui/AppMark.vue'
import { words } from './words'

defineOptions({ inheritAttrs: false })

/** One row of the menu: a 24 px column for its icon, then its name, so every row in the menu lines up. */
withDefaults(
  defineProps<{
    to: string
    label: string
    icon: string
    /** The custom property of an app's colour, which puts the icon on a tile. */
    colour?: `--${string}` | undefined
    /** Above zero it shows as a pill and reads to a screen reader as what waits. */
    count?: number | undefined
    /** False on an app's row, whose link repeats the first page in the app's list, which is the one marked. */
    marksCurrent?: boolean
    /** On the icon sidebar: the icon alone, with the name for a screen reader and as its tooltip. */
    rail?: boolean
    /** Looks current while a screen opened from it shows, without telling a screen reader it is the page. */
    lit?: boolean
  }>(),
  { marksCurrent: true, rail: false, lit: false },
)
</script>

<template>
  <UTooltip :text="label" :disabled="!rail" :content="{ side: 'right' }">
    <RouterLink
      v-bind="$attrs"
      :to="to"
      class="nav-link"
      :class="{ 'in-rail': rail, 'is-active': lit }"
      :active-class="marksCurrent ? 'is-active' : 'router-link-active'"
      :aria-current-value="marksCurrent ? 'page' : 'false'"
    >
      <AppMark v-if="colour !== undefined" :icon="icon" :colour="colour" />
      <span v-else class="grid size-6 shrink-0 place-items-center">
        <UIcon :name="icon" class="size-4" aria-hidden="true" />
      </span>
      <span :class="rail ? 'sr-only' : 'min-w-0 truncate'" data-testid="nav-label">{{ label }}</span>
      <template v-if="count">
        <span class="nav-count figure" aria-hidden="true" data-testid="nav-count">{{ count }}</span>
        <span class="sr-only">{{ plural(words.navigation.waiting(count), count) }}</span>
      </template>
    </RouterLink>
  </UTooltip>
</template>
