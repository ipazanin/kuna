<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import UButton from '@nuxt/ui/components/Button.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import CutText from '../../../../shared/ui/CutText.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import type { Settings, SettingsField } from '../../settings/domain/settings'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { displayNamesOf } from '../../workbook/domain/displayName'
import { mailAddressesOf } from '../../../../shared/mail/domain/mailSource'
import StatementMailList from './StatementMailList.vue'
import { ACCOUNTS_LINK, useMailSync } from './useMailSync'
import { words } from './words'

/**
 * The mail card of Settings, General: where each sync looks in Gmail for the bank's statements,
 * edited in the settings form's draft and saved by its Save, the accounts those statements fill
 * from their start day, and what the last sync's mail step read of them. A link to
 * `#mail`, as the mail step's line gives, opens it.
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
const store = useWorkbook()
const route = useRoute()
const revealed = computed(() => route.hash === '#mail' || props.errors.statementsMailFrom !== undefined || props.errors.statementsMailSubject !== undefined)

/** The accounts the bank's statements fill, by name, with the day each starts from. */
const filled = computed(() => {
  const workbook = store.state.workbook
  if (workbook === null) return []
  const names = displayNamesOf(workbook)
  return workbook.accounts.flatMap((account) => {
    if (account.intake.rowsFrom !== 'mail') return []
    const from = dayLabel(account.intake.startsOn)
    const startsOn = words.card.accountFrom(from)
    return [{ slug: account.slug, name: names.account(account.slug), from, caption: account.iban === '' ? startsOn : `${startsOn} · ${account.iban}` }]
  })
})

const summary = computed(() => {
  const { statementsMailFrom } = props.saved
  return statementsMailFrom.length === 0
    ? words.card.notRead
    : words.card.readFrom(
        statementsMailFrom,
        filled.value.map((account) => words.card.fillsFrom(account.name, account.from)),
      )
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
  <AppCard id="mail" :title="words.card.title" :subtitle="words.card.subtitle" collapse-id="settings.mail" start-collapsed :summary="summary" :reveal="revealed" data-testid="mail-settings">
    <div class="flex flex-col gap-6 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
      <FormGrid>
        <UFormField :label="words.card.senders" :error="errors.statementsMailFrom ?? false" :help="words.card.sendersHelp" class="sm:col-span-2" data-testid="statements-mail-from">
          <UInput
            :model-value="sendersText"
            inputmode="email"
            autocapitalize="off"
            :spellcheck="false"
            :placeholder="words.card.sendersPlaceholder"
            class="w-full"
            @update:model-value="updateSenders(String($event))"
          />
        </UFormField>
        <UFormField :label="words.card.subject" :error="errors.statementsMailSubject ?? false" :help="words.card.subjectHelp" class="sm:col-span-2" data-testid="statements-mail-subject">
          <UInput :model-value="settings.statementsMailSubject" class="w-full" @update:model-value="update('statementsMailSubject', String($event))" />
        </UFormField>
      </FormGrid>
      <div class="flex flex-col gap-1" data-testid="mail-accounts">
        <h3 class="type-card-title">{{ words.card.accounts }}</h3>
        <ul v-if="filled.length > 0" class="row-list flex flex-col">
          <li v-for="account in filled" :key="account.slug" class="border-t border-default first:border-t-0">
            <ListRow :to="ACCOUNTS_LINK.to" flush :title="account.name">
              <template #caption>
                <CutText class="block">{{ account.caption }}</CutText>
              </template>
            </ListRow>
          </li>
        </ul>
        <template v-else>
          <p class="type-caption">{{ words.card.noAccount }}</p>
          <UButton :to="ACCOUNTS_LINK.to" :label="ACCOUNTS_LINK.label" trailing-icon="i-lucide-arrow-right" color="neutral" variant="link" class="self-start px-0" />
        </template>
      </div>
      <div class="flex flex-col gap-3">
        <h3 class="type-card-title">{{ words.card.lastSync }}</h3>
        <StatementMailList :plan="mail.state.plan" :stopped="mail.state.stopped" />
      </div>
    </div>
  </AppCard>
</template>
