<script setup lang="ts">
import { RouterLink } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppBrand from './AppBrand.vue'

/** The Kuna mark and name, which open the home with every app: quiet beside a grid icon on a first run, or the largest mark centred at the top of a menu. */
defineProps<{
  /** The link's name for a screen reader and its tooltip, which starts with the visible Kuna, such as "Kuna, all apps". */
  label: string
  /** Quiet beside a grid icon on a first run, or lead for the largest mark centred at the top of a menu. */
  look: 'quiet' | 'lead'
}>()
</script>

<template>
  <RouterLink
    to="/"
    :title="label"
    :aria-label="label"
    class="flex rounded-control transition-colors hover:bg-elevated"
    :class="look === 'lead' ? 'justify-center px-2 py-3' : '-mx-2 items-center gap-2 px-2 py-1.5'"
    data-testid="home-link"
  >
    <AppBrand title="Kuna" :look="look" />
    <UIcon v-if="look === 'quiet'" name="i-lucide-layout-grid" class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
  </RouterLink>
</template>
