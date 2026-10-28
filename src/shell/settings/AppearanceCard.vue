<script setup lang="ts">
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { chooseTheme, themeChoice } from '../../shared/theme/theme'
import type { ThemeChoice } from '../../shared/theme/theme'
import AppCard from '../../shared/ui/AppCard.vue'

const privacyPage = `${import.meta.env.BASE_URL}privacy.html`

const THEME_CHOICES: { label: string; value: ThemeChoice }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]
</script>

<template>
  <AppCard title="Appearance and privacy">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <URadioGroup
        :model-value="themeChoice"
        :items="THEME_CHOICES"
        legend="Theme"
        orientation="horizontal"
        variant="table"
        :ui="{ item: 'flex-1' }"
        data-testid="theme-choice"
        @update:model-value="chooseTheme($event as ThemeChoice)"
      />
      <p class="text-xs text-muted">System follows this device's setting as it changes. Light or Dark is remembered on this device.</p>
      <p class="text-sm text-muted">
        There is no server. Nothing leaves this browser except calls to Google's APIs for the books on Drive, your statements and your invoices.
        <a :href="privacyPage" class="settings-link inline-target">Read the privacy notes</a>
      </p>
    </div>
  </AppCard>
</template>

<style scoped>
.settings-link {
  color: var(--ink-secondary);
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.settings-link:hover {
  color: var(--ink-strong);
  text-decoration-color: var(--accent);
}
</style>
