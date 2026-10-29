<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

import DrillLink from '../../../../../shared/ui/DrillLink.vue'

/** Names the category roles no category carries, and what the screen leaves out because of it. */
defineProps<{
  missing: readonly { readonly role: string; readonly leftOut: string }[]
}>()
</script>

<template>
  <div v-if="missing.length > 0" class="flex items-start gap-2 text-sm leading-5 text-toned" data-testid="missing-roles">
    <UIcon name="i-lucide-tag" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
    <div class="flex flex-col gap-1">
      <p v-for="entry in missing" :key="entry.role">
        No category has the role <span class="identifier">{{ entry.role }}</span
        >, so {{ entry.leftOut }}.
      </p>
      <DrillLink to="/company/settings?tab=categories" in-prose class="self-start text-highlighted">Add roles on Settings, Categories</DrillLink>
    </div>
  </div>
</template>
