<script setup lang="ts">
import { computed, nextTick, provide, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import BankKeyForm from './BankKeyForm.vue'
import { useBankKey } from './useBankKey'
import { words } from './words'
import { bankRedirectUrl } from '../infrastructure/bankBrowserState'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import StepCard, { STEP_FLOW } from '../../../../shared/ui/StepCard.vue'

/**
 * The walk-through to a person's own Enable Banking application: what it takes, the values its form asks for, its key, and
 * activating it. Shown while the book has no application, and until Done once the key is kept.
 */
/** `holding` asks the screen to keep the walk-through open from Check until Done, since a kept key sets bank sync up. */
const emit = defineEmits<{ holding: []; done: [] }>()

const STEPS = ['start', 'make', 'key', 'activate'] as const
type Step = (typeof STEPS)[number]

const step = ref<Step>('start')
const at = computed(() => STEPS.indexOf(step.value))
provide(STEP_FLOW, {
  step,
  canGoBack: computed(() => at.value > 0 && step.value !== 'activate'),
  back: () => {
    step.value = STEPS[at.value - 1] ?? 'start'
  },
})

// A new step takes focus, so a screen reader announces its card.
watch(step, () => void nextTick(() => document.querySelector<HTMLElement>('[data-testid="onboarding-step"]')?.focus()))

const key = useBankKey()
const answered = computed(() => (key.lastCheck.value?.kind === 'answered' ? key.lastCheck.value : null))
const problemLines = computed(() =>
  (answered.value?.problems ?? []).map((problem) => (problem === 'redirect-missing' ? words.application.problems[problem](bankRedirectUrl()) : words.application.problems[problem])),
)

const site = bankRedirectUrl()
const values = [
  { id: 'name', label: words.walk.make.fields.name, value: 'Kuna' },
  { id: 'description', label: words.walk.make.fields.description, value: words.walk.make.description },
  { id: 'privacy', label: words.walk.make.fields.privacy, value: `${site}privacy.html` },
  { id: 'terms', label: words.walk.make.fields.terms, value: `${site}terms.html` },
  { id: 'redirect', label: words.walk.make.fields.redirect, value: site },
]
const copied = ref<string | null>(null)
const copyFailed = ref(false)

function kept(): void {
  step.value = 'activate'
}

async function copy(id: string, value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = id
    copyFailed.value = false
  } catch {
    copied.value = null
    copyFailed.value = true
  }
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6" data-testid="spending-bank-sync-setup">
    <StepCard v-if="step === 'start'" :title="words.walk.start.title" :subtitle="words.walk.start.subtitle">
      <ul class="flex max-w-prose list-disc flex-col gap-1.5 ps-5 type-body">
        <li v-for="line in words.walk.start.lines" :key="line">{{ line }}</li>
      </ul>
      <template #actions>
        <UButton :label="words.walk.next" trailing-icon="i-lucide-arrow-right" data-testid="spending-bank-setup-next" @click="step = 'make'" />
      </template>
    </StepCard>

    <StepCard v-else-if="step === 'make'" :title="words.walk.make.title" :subtitle="words.walk.make.subtitle">
      <ol class="flex max-w-prose list-decimal flex-col gap-1.5 ps-5 type-body">
        <li v-for="line in words.walk.make.lines" :key="line">{{ line }}</li>
      </ol>
      <ul class="divide-y divide-default rounded-control border border-default" data-testid="spending-bank-setup-values">
        <li v-for="{ id, label, value } in values" :key="id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span class="type-label w-full sm:w-40 sm:shrink-0">{{ label }}<span class="sr-only">:</span></span>
          <span class="min-w-0 flex-1 font-mono wrap-anywhere type-caption">{{ value }}</span>
          <UButton
            :icon="copied === id ? 'i-lucide-check' : 'i-lucide-copy'"
            :aria-label="words.walk.copy(label)"
            :title="copied === id ? words.walk.copied : words.walk.copy(label)"
            color="neutral"
            variant="ghost"
            size="sm"
            :data-testid="`spending-bank-setup-copy-${id}`"
            @click="copy(id, value)"
          />
        </li>
      </ul>
      <NoteLine v-if="copyFailed" tone="error" size="body" data-testid="spending-bank-setup-copy-failed">{{ words.copyFailed }}</NoteLine>
      <template #actions>
        <UButton :label="words.walk.make.open" to="https://enablebanking.com/" target="_blank" rel="noopener noreferrer" trailing-icon="i-lucide-external-link" color="neutral" variant="outline" />
        <UButton :label="words.walk.next" trailing-icon="i-lucide-arrow-right" data-testid="spending-bank-setup-next" @click="step = 'key'" />
      </template>
    </StepCard>

    <StepCard v-else-if="step === 'key'" :title="words.walk.key.title" :subtitle="words.walk.key.subtitle">
      <BankKeyForm current="" @checking="emit('holding')" @kept="kept" />
    </StepCard>

    <StepCard v-else :title="words.walk.activate.title" :subtitle="words.walk.activate.subtitle">
      <NoteLine v-for="line in problemLines" :key="line" tone="warning" size="body" data-testid="spending-bank-application-problem">{{ line }}</NoteLine>
      <NoteLine v-if="answered !== null && answered.problems.length === 0" tone="success" size="body" data-testid="spending-bank-setup-ready">{{ words.walk.activate.ready }}</NoteLine>
      <template #actions>
        <UButton
          v-if="answered === null || answered.problems.length > 0"
          :label="words.application.check"
          icon="i-lucide-plug-zap"
          color="neutral"
          variant="outline"
          :loading="key.busy.value"
          data-testid="spending-bank-application-check"
          @click="key.recheck"
        />
        <UButton :label="words.walk.done" icon="i-lucide-check" data-testid="spending-bank-setup-done" @click="emit('done')" />
      </template>
    </StepCard>
  </div>
</template>
