<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import type { Settings, SettingsField } from '../../settings/domain/settings'
import { mailAddressesOf } from '../domain/mailSource'
import MailPlanList from './MailPlanList.vue'
import { useMailSync } from './useMailSync'

/**
 * The mail card of Settings, General: where each sync looks in Gmail for the bank's statements,
 * edited in the settings form's draft and saved by its Save, and what the last sync's mail step
 * found and filed for every kind of mail. A link to `#mail`, as the mail step's line gives, opens it.
 */
const props = defineProps<{
  /** The settings as drafted. */
  settings: Settings
  /** The settings as the workbook holds them, which the collapsed card sums up. */
  saved: Settings
  errors: Partial<Record<SettingsField, string>>
}>()

const emit = defineEmits<{
  update: [settings: Settings]
}>()

const mail = useMailSync()
const route = useRoute()
const revealed = computed(() => route.hash === '#mail' || props.errors.statementsMailFrom !== undefined || props.errors.statementsMailSubject !== undefined)

const summary = computed(() => {
  const { statementsMailFrom, mailSince } = props.saved
  const since = mailSince === null ? 'the start of last year' : dayLabel(mailSince)
  return statementsMailFrom.length === 0 ? 'Bank mail is not read.' : `Bank mail from ${statementsMailFrom.join(', ')}, since ${since}.`
})

/** The senders as typed, so a trailing comma survives until the next address is written. */
const sendersText = ref(props.settings.statementsMailFrom.join(', '))
watch(
  () => props.settings.statementsMailFrom,
  (senders) => {
    if (JSON.stringify(mailAddressesOf(sendersText.value)) !== JSON.stringify(senders)) sendersText.value = senders.join(', ')
  },
)

function update<Field extends keyof Settings>(field: Field, value: Settings[Field]): void {
  emit('update', { ...props.settings, [field]: value })
}

function updateSenders(text: string): void {
  sendersText.value = text
  update('statementsMailFrom', mailAddressesOf(text))
}
</script>

<template>
  <AppCard
    id="mail"
    title="Mail"
    subtitle="Where each sync looks in Gmail for the bank's statements, which it files into the statements folder."
    collapse-id="settings.mail"
    start-collapsed
    :summary="summary"
    :reveal="revealed"
    data-testid="mail-settings"
  >
    <div class="flex flex-col gap-6 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
      <FormGrid>
        <UFormField
          label="The bank mails statements from"
          :error="errors.statementsMailFrom ?? false"
          help="Mail addresses, comma separated. Blank leaves the bank's mail unread, and Gmail is not asked for."
          class="sm:col-span-2"
          data-testid="statements-mail-from"
        >
          <UInput :model-value="sendersText" inputmode="email" autocapitalize="off" :spellcheck="false" placeholder="Not read" class="w-full" @update:model-value="updateSenders(String($event))" />
        </UFormField>
        <UFormField label="Subject words" :error="errors.statementsMailSubject ?? false" help="The words before the statement number, such as Izvadak." data-testid="statements-mail-subject">
          <UInput :model-value="settings.statementsMailSubject" class="w-full" @update:model-value="update('statementsMailSubject', String($event))" />
        </UFormField>
        <UFormField
          label="Mail since"
          help="The earliest mail a sync reads. Once a folder holds files, a sync starts a week before the newest one. Blank is the start of last year, so a sync early in January still finds mail from December."
          data-testid="mail-since"
        >
          <UInput :model-value="settings.mailSince ?? ''" type="date" class="w-full" @update:model-value="update('mailSince', parseCivilDate(String($event ?? '')))" />
        </UFormField>
      </FormGrid>
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-highlighted">What the last sync found</h3>
        <MailPlanList :plan="mail.state.plan" :stopped="mail.state.stopped" />
      </div>
    </div>
  </AppCard>
</template>
