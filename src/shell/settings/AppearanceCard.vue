<script setup lang="ts">
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { chooseLanguage, languageChoice } from '../../shared/text/language'
import type { LanguageChoice } from '../../shared/text/language'
import { chooseTheme, themeChoice } from '../../shared/theme/theme'
import type { ThemeChoice } from '../../shared/theme/theme'
import AppCard from '../../shared/ui/AppCard.vue'
import { words } from './words'

const privacyPage = `${import.meta.env.BASE_URL}privacy.html`

const THEME_CHOICES: { label: string; value: ThemeChoice }[] = [
  { label: words.appearance.system, value: 'system' },
  { label: words.appearance.light, value: 'light' },
  { label: words.appearance.dark, value: 'dark' },
]

// Each language is named in itself, so it reads the same whichever language is on screen.
const LANGUAGE_CHOICES: { label: string; value: LanguageChoice }[] = [
  { label: words.language.browser, value: 'browser' },
  { label: 'English', value: 'en' },
  { label: 'Hrvatski', value: 'hr' },
]
</script>

<template>
  <AppCard :title="words.appearance.title">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <URadioGroup
        :model-value="themeChoice"
        :items="THEME_CHOICES"
        :legend="words.appearance.theme"
        orientation="horizontal"
        variant="table"
        :ui="{ item: 'flex-1' }"
        data-testid="theme-choice"
        @update:model-value="chooseTheme($event as ThemeChoice)"
      />
      <p class="text-xs text-muted">{{ words.appearance.themeNote }}</p>
      <URadioGroup
        :model-value="languageChoice"
        :items="LANGUAGE_CHOICES"
        :legend="words.language.legend"
        variant="table"
        data-testid="language-choice"
        @update:model-value="chooseLanguage($event as LanguageChoice)"
      />
      <p class="text-xs text-muted">{{ words.language.note }}</p>
      <p class="text-sm text-muted">
        {{ words.appearance.privacy }}
        <a :href="privacyPage" class="settings-link inline-target">{{ words.appearance.privacyLink }}</a>
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
