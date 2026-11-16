<script setup lang="ts">
import { computed } from 'vue'

import { languageChoice } from '../../shared/text/language'
import type { LanguageChoice } from '../../shared/text/language'
import { chooseTheme, themeChoice } from '../../shared/theme/theme'
import type { ThemeChoice } from '../../shared/theme/theme'
import MenuButton from '../../shared/ui/MenuButton.vue'
import { switchLanguage } from './switchLanguage'
import { words } from './words'

const THEME_ICONS: Readonly<Record<ThemeChoice, string>> = { system: 'i-lucide-monitor', light: 'i-lucide-sun', dark: 'i-lucide-moon' }
const THEMES: readonly ThemeChoice[] = ['system', 'light', 'dark']
const LANGUAGES: readonly LanguageChoice[] = ['browser', 'en', 'hr']

const shown = words.themeAndLanguage

const props = withDefaults(defineProps<{ tooltipSide?: 'right' | 'bottom' }>(), { tooltipSide: 'right' })

/** The one control for this device's theme and language, its icon showing the theme in force. A new language loads Kuna again, which the language group's note says. */
const groups = computed(() => [
  {
    label: shown.theme,
    picked: themeChoice.value,
    choices: THEMES.map((theme) => ({ value: theme, label: shown.themes[theme], ...(theme === 'system' ? { description: shown.followsDevice } : {}) })),
  },
  {
    label: shown.language,
    note: shown.reloads,
    picked: languageChoice,
    choices: LANGUAGES.map((language) => ({ value: language, label: shown.languages[language] })),
  },
])

function isTheme(choice: ThemeChoice | LanguageChoice): choice is ThemeChoice {
  return THEMES.some((theme) => theme === choice)
}

function pick(choice: ThemeChoice | LanguageChoice): void {
  if (isTheme(choice)) chooseTheme(choice)
  else if (choice !== languageChoice) void switchLanguage(choice)
}
</script>

<template>
  <MenuButton
    :label="shown.name(shown.themes[themeChoice], shown.languages[languageChoice])"
    :icon="THEME_ICONS[themeChoice]"
    look="icon"
    :tooltip-side="props.tooltipSide"
    :groups="groups"
    data-testid="theme-and-language"
    @pick="pick"
  />
</template>
