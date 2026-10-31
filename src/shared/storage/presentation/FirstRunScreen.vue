<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

import type { StepFlow } from '../../ui/StepCard.vue'
import type { FileFirstRun } from './fileFirstRun'
import FirstRunFindStep from './FirstRunFindStep.vue'
import FirstRunFolderStep from './FirstRunFolderStep.vue'
import FirstRunHomeStep from './FirstRunHomeStep.vue'
import FirstRunPage from './FirstRunPage.vue'
import { useFirstRun } from './useFirstRun'
import type { FirstRunStep } from './useFirstRun'

/** An app's first run at `<start route>?step=…`: where the file lives, then the folder or the find for a file on Drive. */
const props = defineProps<{ firstRun: FileFirstRun }>()

const start = useFirstRun(props.firstRun)
const flow: StepFlow = { step: start.step, canGoBack: computed(() => start.step.value !== 'home'), back: () => void start.go('home') }

const STEPS: Readonly<Record<FirstRunStep, Component>> = { home: FirstRunHomeStep, folder: FirstRunFolderStep, find: FirstRunFindStep }

const step = computed(() => STEPS[start.step.value])
</script>

<template>
  <FirstRunPage :app-name="firstRun.appName" :lead="firstRun.words.lead" :footer="firstRun.words.footer" :flow="flow">
    <component :is="step" :key="start.step.value" :first-run="firstRun" :steps="start" />
  </FirstRunPage>
</template>
