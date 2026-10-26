<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { googleAccess, needScopes, requestAccess } from '../../../shared/google/googleAuth'
import { REDIRECT_SIGN_IN_QUERY } from '../../../shared/google/googleRedirect'
import type { GoogleScope } from '../../../shared/google/googleScopes'
import { useMediaQuery } from '../../../shared/layout/viewport'
import { mailDraftsOn, switchMailDrafts } from '../../invoicing/infrastructure/mailDraftSwitch'
import { scopesOfChoices } from '../application/onboardingScopes'
import type { StatementsSource } from '../domain/onboardingSteps'
import StepCard from './StepCard.vue'
import { useOnboarding } from './useOnboarding'

/**
 * What the app may do in the person's Google account, asked in one consent before any file is
 * opened: the books file always, and what the choices here switch on. On a phone the tap leaves for
 * Google and the route brings the person back to this step, which then says what Google allowed.
 */
const onboarding = useOnboarding()
const signInByRedirect = useMediaQuery(REDIRECT_SIGN_IN_QUERY)

const chooses = computed(() => onboarding.place.value.path === 'new' || onboarding.place.value.path === 'bring')
const statements = computed({
  get: () => onboarding.place.value.statements,
  set: (source: StatementsSource) => void onboarding.choose({ statements: source }),
})
const STATEMENT_CHOICES: { label: string; description: string; value: StatementsSource }[] = [
  { label: 'I import them by hand', description: 'No extra access.', value: 'hand' },
  { label: 'From a folder in my Drive', description: 'The app reads your Drive to find new ones. Google will say "See and download all your Google Drive files".', value: 'folder' },
]

const asked = computed(() => scopesOfChoices(onboarding.place.value, mailDraftsOn.value))
const restricted = computed(() => asked.value.some((scope) => scope !== 'drive.file'))
/** Whether the page holds a token, so Google answered and each line can say what it allowed. */
const answered = computed(() => googleAccess().scopes !== null)
const allowed = (scope: GoogleScope): boolean => googleAccess().scopes?.includes(scope) ?? false
const asking = ref(false)
const failure = ref<string | null>(null)

async function ask(): Promise<void> {
  asking.value = true
  failure.value = null
  needScopes(asked.value)
  try {
    await requestAccess([], 'none')
  } catch (refused) {
    failure.value = refused instanceof Error ? refused.message : String(refused)
  } finally {
    asking.value = false
  }
}
</script>

<template>
  <StepCard title="What the app may do in your Google account" subtitle="One Google screen asks for all of it. You can change each choice later in Settings.">
    <div class="access-line" data-scope="drive.file">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-highlighted">Always: your books file</p>
        <p class="text-sm text-muted">Only files this app makes or you pick.</p>
      </div>
      <UBadge v-if="answered" :label="allowed('drive.file') ? 'Allowed' : 'Not allowed'" :color="allowed('drive.file') ? 'success' : 'error'" variant="subtle" data-testid="access-status" />
    </div>

    <template v-if="chooses">
      <div class="flex flex-col gap-2">
        <URadioGroup v-model="statements" :items="STATEMENT_CHOICES" legend="How do statements reach the app?" :ui="{ legend: 'text-sm font-medium text-highlighted mb-2', fieldset: 'gap-3' }" data-testid="onboarding-statements" />
        <p v-if="answered && statements === 'folder'" class="flex items-center gap-2 text-sm">
          <UBadge :label="allowed('drive.readonly') ? 'Allowed' : 'Not allowed'" :color="allowed('drive.readonly') ? 'success' : 'error'" variant="subtle" data-testid="access-status" />
          <UButton v-if="!allowed('drive.readonly')" label="Ask again" color="neutral" variant="link" size="sm" :loading="asking" @click="ask" />
        </p>
      </div>
      <div class="flex flex-col gap-2">
        <UCheckbox
          :model-value="mailDraftsOn"
          label="Invoice mail drafts in Gmail"
          description='Google will say "Manage drafts and send emails".'
          data-testid="onboarding-drafts"
          @update:model-value="switchMailDrafts($event === true)"
        />
        <p v-if="answered && mailDraftsOn" class="flex items-center gap-2 text-sm">
          <UBadge :label="allowed('gmail.compose') ? 'Allowed' : 'Not allowed'" :color="allowed('gmail.compose') ? 'success' : 'error'" variant="subtle" data-testid="access-status" />
          <UButton v-if="!allowed('gmail.compose')" label="Ask again" color="neutral" variant="link" size="sm" :loading="asking" @click="ask" />
        </p>
      </div>
    </template>

    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" title="Google did not answer" :description="failure" />
    <div class="flex flex-col gap-1 text-xs text-muted">
      <p v-if="restricted && !answered">Google first says it has not verified this app. Choose Advanced, then Go to ledgerboard.</p>
      <p v-if="signInByRedirect" data-testid="redirect-sign-in-note">Google may ask about cookies first, then brings you back to this step.</p>
    </div>

    <template #actions>
      <UButton v-if="allowed('drive.file')" label="Continue" trailing-icon="i-lucide-arrow-right" data-testid="onboarding-continue" @click="onboarding.next()" />
      <UButton v-else label="Continue to Google" icon="i-lucide-log-in" :loading="asking" data-testid="onboarding-google" @click="ask" />
    </template>
  </StepCard>
</template>

<style scoped>
.access-line {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
</style>
