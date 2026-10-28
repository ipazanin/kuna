<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { useAppUpdate } from '../pwa/appUpdate'

const { updateReady, applyUpdate } = useAppUpdate()
</script>

<template>
  <div v-if="updateReady" class="update-prompt" role="status" data-testid="update-prompt">
    <UIcon name="i-lucide-sparkles" class="size-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
    <p class="min-w-0 flex-1 text-sm text-toned">A new version of Ledgerboard is ready.</p>
    <UButton label="Reload" icon="i-lucide-refresh-cw" size="sm" @click="applyUpdate" />
  </div>
</template>

<style scoped>
.update-prompt {
  position: fixed;
  z-index: 40;
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  bottom: calc(1rem + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: min(26rem, calc(100vw - 2rem));
  padding: 0.625rem 0.625rem 0.625rem 0.875rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-card);
  background: var(--surface-elevated);
  box-shadow: var(--elevation-overlay);
}
</style>
