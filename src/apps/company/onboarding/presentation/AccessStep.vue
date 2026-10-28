<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { googleAccess, needScopes, requestAccess } from '../../../../shared/google/googleAuth'
import { REDIRECT_SIGN_IN_QUERY } from '../../../../shared/google/googleRedirect'
import type { GoogleScope } from '../../../../shared/google/googleScopes'
import { useMediaQuery } from '../../../../shared/layout/viewport'
import { mailDraftsOn, switchMailDrafts } from '../../invoicing/infrastructure/mailDraftSwitch'
import { BANK_PRESETS } from '../../mail/domain/bankPresets'
import { useSync } from '../../sync/presentation/useSync'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { scopesOfChoices } from '../application/onboardingScopes'
import { OTHER_BANK, offersMail } from '../domain/onboardingSteps'
import type { StatementMail, StatementsSource } from '../domain/onboardingSteps'
import { firstMailDay, statementMailProblems } from '../domain/statementsChoice'
import StepCard from './StepCard.vue'
import { useOnboarding } from './useOnboarding'

/**
 * What the app may do in the person's Google account, asked in one consent before any file is
 * opened: the books file always, and what the choices here switch on. On a phone the tap leaves for
 * Google and the route brings the person back to this step, which then says what Google allowed.
 */
const onboarding = useOnboarding()
const store = useWorkbook()
const sync = useSync()
const signInByRedirect = useMediaQuery(REDIRECT_SIGN_IN_QUERY)

const chooses = computed(() => onboarding.place.value.path === 'new' || onboarding.place.value.path === 'bring')
const statements = computed({
  get: () => onboarding.place.value.statements,
  set: (source: StatementsSource) => void onboarding.choose({ statements: source }),
})
const STATEMENT_CHOICES: { label: string; description: string; value: StatementsSource }[] = [
  { label: 'I import them by hand', description: 'No extra access.', value: 'hand' },
  { label: 'From my mail', description: 'The app finds the bank\'s mail when you sync and files it in Drive. Google will say "View your email messages and settings".', value: 'mail' },
  { label: 'From a folder in my Drive', description: 'The app reads your Drive to find new ones. Google will say "See and download all your Google Drive files".', value: 'folder' },
]
const statementChoices = computed(() => STATEMENT_CHOICES.filter((choice) => choice.value !== 'mail' || offersMail(onboarding.place.value)))

const BANKS = [...BANK_PRESETS.map((preset) => ({ label: preset.name, value: preset.id })), { label: 'Another bank', value: OTHER_BANK }]
const mail = computed(() => onboarding.place.value.mail)
const preset = computed(() => BANK_PRESETS.find((candidate) => candidate.id === mail.value.bank) ?? null)
const mailProblems = computed(() => (statements.value === 'mail' ? statementMailProblems(mail.value) : {}))
const mailReady = computed(() => mailProblems.value.from === undefined && mailProblems.value.subject === undefined)
const since = computed(() => mail.value.since ?? firstMailDay(today()))

/** Changes the mail in the address as it is typed, so a phone that leaves for Google comes back with it. */
function chooseMail(changes: Partial<StatementMail>): void {
  void onboarding.choose({ mail: { ...mail.value, ...changes } })
}

/** Books kept in this browser that move to Drive say what they need, so their first sync there asks Google nothing more. */
const moving = computed(() => (onboarding.place.value.path === 'move' ? store.state.workbook : null))
const asked = computed(() => (moving.value === null ? scopesOfChoices(onboarding.place.value, mailDraftsOn.value) : sync.scopesNeededBy(moving.value)))

/** What each scope beyond the books file lets books that move here do, as Google words it. */
const MOVED_BOOKS_NEED: Readonly<Record<Exclude<GoogleScope, 'drive.file'>, { readonly label: string; readonly description: string }>> = {
  'drive.readonly': { label: 'Your Drive folders', description: 'The books read folders from your Drive, such as the statements folder. Google will say "See and download all your Google Drive files".' },
  'gmail.readonly': { label: 'Your mail', description: 'The books find the mail they file in Drive when you sync. Google will say "View your email messages and settings".' },
  'gmail.compose': { label: 'Invoice mail drafts in Gmail', description: 'Google will say "Manage drafts and send emails".' },
}
const movedNeeds = computed(() => (moving.value === null ? [] : asked.value.flatMap((scope) => (scope === 'drive.file' ? [] : [{ scope, ...MOVED_BOOKS_NEED[scope] }]))))
const restricted = computed(() => asked.value.some((scope) => scope !== 'drive.file'))
/** Whether the page holds a token, so Google answered and each line can say what it allowed. */
const answered = computed(() => googleAccess().scopes !== null)
const allowed = (scope: GoogleScope): boolean => googleAccess().scopes?.includes(scope) ?? false
/** The scope the statements choice adds to the books file's: Gmail read for mail, Drive read for a folder. */
const statementScope = computed<GoogleScope>(() => (statements.value === 'mail' ? 'gmail.readonly' : 'drive.readonly'))
const asking = ref(false)
const failure = ref<string | null>(null)

async function ask(): Promise<void> {
  asking.value = true
  failure.value = null
  needScopes(asked.value)
  try {
    await requestAccess([], { resume: 'none' })
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

    <div v-for="need in movedNeeds" :key="need.scope" class="access-line" :data-scope="need.scope">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-highlighted">{{ need.label }}</p>
        <p class="text-sm text-muted">{{ need.description }}</p>
      </div>
      <template v-if="answered">
        <UBadge :label="allowed(need.scope) ? 'Allowed' : 'Not allowed'" :color="allowed(need.scope) ? 'success' : 'error'" variant="subtle" data-testid="access-status" />
        <UButton v-if="!allowed(need.scope)" label="Ask again" color="neutral" variant="link" size="sm" :loading="asking" @click="ask" />
      </template>
    </div>

    <template v-if="chooses">
      <div class="flex flex-col gap-2">
        <URadioGroup v-model="statements" :items="statementChoices" legend="How do statements reach the app?" :ui="{ legend: 'text-sm font-medium text-highlighted mb-2', fieldset: 'gap-3' }" data-testid="onboarding-statements" />
        <div v-if="statements === 'mail'" class="grid gap-4 sm:grid-cols-2" data-testid="onboarding-mail">
          <UFormField label="Your bank" :help="preset ? `Mail from ${preset.senders.join(', ')} with ${preset.subject} in the subject.` : 'Type its address and subject words below.'">
            <USelect :model-value="mail.bank" :items="BANKS" class="w-full" data-testid="onboarding-bank" @update:model-value="chooseMail({ bank: String($event) })" />
          </UFormField>
          <UFormField label="Mail since" help="The earliest mail the first sync reads.">
            <UInput :model-value="since" type="date" class="w-full" data-testid="onboarding-mail-since" @update:model-value="chooseMail({ since: parseCivilDate(String($event ?? '')) })" />
          </UFormField>
          <template v-if="mail.bank === OTHER_BANK">
            <UFormField label="The bank mails statements from" :error="mailProblems.from ?? false" class="sm:col-span-2">
              <UInput
                :model-value="mail.from"
                inputmode="email"
                autocapitalize="off"
                :spellcheck="false"
                placeholder="statements@bank.example"
                class="w-full"
                data-testid="onboarding-mail-from"
                @update:model-value="chooseMail({ from: String($event) })"
              />
            </UFormField>
            <UFormField label="Subject words" help="The words before the statement number." :error="mailProblems.subject ?? false" class="sm:col-span-2">
              <UInput :model-value="mail.subject" placeholder="Statement" class="w-full" data-testid="onboarding-mail-subject" @update:model-value="chooseMail({ subject: String($event) })" />
            </UFormField>
          </template>
        </div>
        <p v-if="answered && statements !== 'hand'" class="flex items-center gap-2 text-sm">
          <UBadge :label="allowed(statementScope) ? 'Allowed' : 'Not allowed'" :color="allowed(statementScope) ? 'success' : 'error'" variant="subtle" data-testid="access-status" />
          <UButton v-if="!allowed(statementScope)" label="Ask again" color="neutral" variant="link" size="sm" :loading="asking" @click="ask" />
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
      <p v-if="restricted && !answered">Google first says it has not verified this app. Choose Advanced, then Go to Kuna.</p>
      <p v-if="signInByRedirect" data-testid="redirect-sign-in-note">Google may ask about cookies first, then brings you back to this step.</p>
    </div>

    <template #actions>
      <UButton v-if="allowed('drive.file')" label="Continue" trailing-icon="i-lucide-arrow-right" :disabled="!mailReady" data-testid="onboarding-continue" @click="onboarding.next()" />
      <UButton v-else label="Continue to Google" icon="i-lucide-log-in" :loading="asking" :disabled="!mailReady" data-testid="onboarding-google" @click="ask" />
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
