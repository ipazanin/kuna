<script setup lang="ts">
import { RouterLink } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppBrand from './AppBrand.vue'

/** The Kuna mark and name at the top of every app's menu and first run, which opens the home with every app. */
defineProps<{
  /** Where the link goes, said after the name to a screen reader and as the tooltip, such as "All apps". */
  label: string
}>()
</script>

<template>
  <RouterLink to="/" :title="label" class="-mx-2 flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-elevated" data-testid="home-link">
    <AppBrand title="Kuna" />
    <span class="sr-only">, {{ label }}</span>
    <UIcon name="i-lucide-layout-grid" class="size-4 shrink-0 text-muted" aria-hidden="true" />
  </RouterLink>
</template>
