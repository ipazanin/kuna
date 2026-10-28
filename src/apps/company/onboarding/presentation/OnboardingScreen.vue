<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import type { Component } from 'vue'

import type { OnboardingStep } from '../domain/onboardingSteps'
import AccessStep from './AccessStep.vue'
import CompanyStep from './CompanyStep.vue'
import FileStep from './FileStep.vue'
import FindStep from './FindStep.vue'
import FolderStep from './FolderStep.vue'
import HomeStep from './HomeStep.vue'
import StatementStep from './StatementStep.vue'
import WelcomeStep from './WelcomeStep.vue'
import { useOnboarding } from './useOnboarding'

/**
 * Onboarding at `#/company/start?step=…`, on the ruled page of the first run: the steps of the path in a row,
 * named from 640 px and numbered on a phone, and the step's card under it. The route holds the step,
 * so a trip to Google comes back into it. The row only shows where the person is, so it holds no buttons.
 */
const onboarding = useOnboarding()

const STEPS: Readonly<Record<OnboardingStep, { readonly title: string; readonly component: Component }>> = {
  welcome: { title: 'Welcome', component: WelcomeStep },
  home: { title: 'Home', component: HomeStep },
  access: { title: 'Google', component: AccessStep },
  file: { title: 'File', component: FileStep },
  folder: { title: 'Folder', component: FolderStep },
  find: { title: 'Find', component: FindStep },
  company: { title: 'Company', component: CompanyStep },
  statement: { title: 'Statement', component: StatementStep },
}

const items = computed(() => {
  const current = onboarding.steps.value.indexOf(onboarding.place.value.step)
  return onboarding.steps.value.map((step, index) => ({ step, title: STEPS[step].title, state: index < current ? 'done' : index === current ? 'current' : 'ahead' }))
})
const step = computed(() => STEPS[onboarding.place.value.step])

// A new step takes focus, so a screen reader announces its card, and it comes into view.
watch(
  () => onboarding.place.value.step,
  () => void nextTick(() => document.querySelector<HTMLElement>('[data-testid="onboarding-step"]')?.focus()),
)

const privacyPage = `${import.meta.env.BASE_URL}privacy.html`
</script>

<template>
  <main class="onboarding min-h-dvh">
    <div class="onboarding-column mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
      <header class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <svg viewBox="0 0 32 32" class="size-9 shrink-0" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--accent)" />
            <path d="M8 22h16M10 18v-6M16 18V9M22 18v-4" stroke="var(--accent-ink)" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          <h1 data-testid="screen-title" tabindex="-1" class="text-title font-semibold text-highlighted">Kuna</h1>
        </div>
        <p class="max-w-[52ch] text-base text-toned">Company finances from your bank statements, worked out in this browser.</p>
      </header>

      <ol class="steps" aria-label="Steps" data-testid="onboarding-stepper">
        <li v-for="(item, index) in items" :key="item.step" class="step" :data-state="item.state" :aria-current="item.state === 'current' ? 'step' : undefined">
          <span class="step-mark figure" aria-hidden="true">{{ index + 1 }}</span>
          <span class="step-title" :class="{ 'max-sm:sr-only': item.state !== 'current' }">{{ item.title }}</span>
        </li>
      </ol>

      <component :is="step.component" :key="onboarding.place.value.step" />

      <footer class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
        <span>No server. Your data stays in your Google Drive, this browser and the files you export.</span>
        <a :href="privacyPage" class="onboarding-link inline-target">Privacy</a>
      </footer>
    </div>
  </main>
</template>

<style scoped>
/* Faint ruled lines, as on a ledger page, fading out further down. */
.onboarding {
  background-color: var(--surface-page);
  background-image:
    linear-gradient(to bottom, transparent 0, var(--surface-page) 42rem),
    repeating-linear-gradient(to bottom, transparent 0 31px, var(--border-default) 31px 32px);
}

/* The margin rule of a ledger book, in the brass accent, beside the column on wide screens. */
.onboarding-column {
  position: relative;
}

@media (min-width: 768px) {
  .onboarding-column::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -1.5rem;
    width: 1px;
    background: var(--accent);
    opacity: 0.6;
  }
}

.steps {
  display: flex;
  gap: 0.5rem;
}

.step {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

/* The rule from each step to the next, brass once the step is done. */
.step + .step::before {
  content: '';
  position: absolute;
  top: 0.75rem;
  right: calc(100% + 0.25rem);
  left: calc(-100% + 1.25rem);
  height: 1px;
  background: var(--border-strong);
}

.step[data-state='done'] + .step::before,
.step[data-state='current']::before {
  background: var(--accent);
}

.step-mark {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface-page);
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.step[data-state='done'] .step-mark {
  border-color: var(--accent);
  color: var(--accent);
}

.step[data-state='current'] .step-mark {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.step-title {
  font-size: 0.75rem;
  color: var(--ink-muted);
  white-space: nowrap;
}

.step[data-state='current'] .step-title {
  color: var(--ink-strong);
  font-weight: 500;
}

.onboarding-link {
  color: var(--ink-secondary);
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.onboarding-link:hover {
  color: var(--ink-strong);
  text-decoration-color: var(--accent);
}
</style>
