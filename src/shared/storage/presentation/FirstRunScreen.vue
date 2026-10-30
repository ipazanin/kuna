<script setup lang="ts">
import { computed, nextTick, provide, watch } from 'vue'
import type { Component } from 'vue'

import { words as sharedWords } from '../../app/words'
import HomeLink from '../../ui/HomeLink.vue'
import { STEP_FLOW } from '../../ui/StepCard.vue'
import type { FileFirstRun } from './fileFirstRun'
import FirstRunFindStep from './FirstRunFindStep.vue'
import FirstRunFolderStep from './FirstRunFolderStep.vue'
import FirstRunHomeStep from './FirstRunHomeStep.vue'
import { useFirstRun } from './useFirstRun'
import type { FirstRunStep } from './useFirstRun'

/** An app's first run at `<start route>?step=…`, on the ruled page of a first run: where the file lives, then the folder or the find for a file on Drive. */
const props = defineProps<{ firstRun: FileFirstRun }>()

const start = useFirstRun(props.firstRun)
provide(STEP_FLOW, { step: start.step, canGoBack: computed(() => start.step.value !== 'home'), back: () => void start.go('home') })

const STEPS: Readonly<Record<FirstRunStep, Component>> = { home: FirstRunHomeStep, folder: FirstRunFolderStep, find: FirstRunFindStep }

// A new step takes focus, so a screen reader announces its card.
watch(
  () => start.step.value,
  () => void nextTick(() => document.querySelector<HTMLElement>('[data-testid="onboarding-step"]')?.focus()),
)

const step = computed(() => STEPS[start.step.value])
</script>

<template>
  <main class="first-run min-h-dvh">
    <div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
      <header class="flex flex-col gap-3">
        <HomeLink :label="sharedWords.allApps" class="self-start" />
        <h1 data-testid="screen-title" tabindex="-1" class="screen-title text-title font-semibold text-highlighted">{{ firstRun.appName }}</h1>
        <p class="max-w-[52ch] text-base text-toned">{{ firstRun.words.lead }}</p>
      </header>
      <component :is="step" :key="start.step.value" :first-run="firstRun" />
      <footer class="text-xs text-muted">{{ firstRun.words.footer }}</footer>
    </div>
  </main>
</template>
