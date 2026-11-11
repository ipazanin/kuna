<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { MAIL_READER_WRITES, heldOrNewReader } from '../application/mailReaderWrites'
import type { ReportMail } from '../application/mailReports'
import { mailReaderFaults, mailReaderTexts, withMailField } from '../domain/mailReaderTexts'
import type { MailReaderField } from '../domain/mailReaderTexts'
import MailReportReview from './MailReportReview.vue'
import MailReportUpload from './MailReportUpload.vue'
import { MAIL_SCOPE, misfitLine, useMailReports } from './useMailReports'
import { mailReaderErrors, words } from './words'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { MailReader } from '../../workbook/domain/mailReader'
import { dateFormat } from '../../../../shared/calendar/dateFormat'
import MailSearchResults from '../../../../shared/mail-filing/presentation/MailSearchResults.vue'
import type { MailResultRow, MailSearchShown } from '../../../../shared/mail-filing/presentation/MailSearchResults.vue'
import { words as mailFilingWords } from '../../../../shared/mail-filing/presentation/words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { usePageSync } from '../../../../shared/sync/presentation/pageSync'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/**
 * Where each sync looks in Gmail for IBKR's report, written when a field is left or the switch turns, with Undo, what the
 * last sync found, the way to its review, and the upload of a report saved by hand. A link to `#mail`, as the step's line gives, opens it.
 */
const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const page = usePageSync()
const route = useRoute()
const { state, reader, confirmed } = useMailReports()

const dayFormat = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' })

/** A write or an Undo resets only the field it changed, so what another field holds stays. */
const shown = computed(() => mailReaderTexts(reader.value))
const texts = ref({ ...mailReaderTexts(reader.value) })
watch(shown, (now, before) => {
  for (const field of Object.keys(now) as MailReaderField[]) {
    if (now[field] !== before[field]) texts.value[field] = now[field]
  }
})

const on = computed(() => reader.value?.on === true)
const errors = computed(() => mailReaderErrors(mailReaderFaults(texts.value, on.value)))

const summary = computed(() => (on.value ? words.card.readFrom(reader.value?.senders ?? []) : words.card.off))
const revealed = computed(() => route.hash === '#mail')
const switchHelp = `${words.card.onHelp} ${words.card.format}`

async function writeReader(after: MailReader, key: string): Promise<void> {
  const before = reader.value
  const turningOn = after.on && before?.on !== true
  await page.saveAllowing(turningOn ? [MAIL_SCOPE] : [], () =>
    writes.write(
      words.card.saved,
      (unit) => {
        const readers = unit.of(MAIL_READER_WRITES)
        if (before === null) readers.add(after)
        else readers.change(before, after)
      },
      { key, failedTitle: words.card.notSaved, shownAtOnce: true },
    ),
  )
}

function changed(field: MailReaderField): MailReader | null {
  if (errors.value[field] !== null || errors.value.since !== null || texts.value[field] === shown.value[field]) return null
  return withMailField(heldOrNewReader(reader.value), field, texts.value)
}

async function commit(field: MailReaderField): Promise<void> {
  const after = changed(field)
  if (after !== null) await writeReader(after, field)
}

async function switchTo(turnedOn: boolean): Promise<void> {
  const current = heldOrNewReader(reader.value)
  if (turnedOn && current.senders.length === 0) return
  await writeReader({ ...current, on: turnedOn }, 'on')
}

const search = computed((): MailSearchShown | null => (state.plan === null ? null : { window: state.plan.window, query: state.plan.query, why: words.card.searchedFrom }))

function outcome(entry: ReportMail): string {
  if (entry.kind === 'no-file') return words.card.noFile('XML')
  if (entry.kind === 'misfit') return misfitLine(entry.fileName, entry.misfit)
  const rows = entry.file.run.rows.length + entry.file.run.asked.length
  return `${plural(words.card.rowsRead(entry.file.fileName, rows), rows)}.`
}

const ICONS: Readonly<Record<ReportMail['kind'], { readonly name: string; readonly tone: string }>> = {
  read: { name: 'i-lucide-file-check', tone: 'text-success' },
  misfit: { name: 'i-lucide-file-x', tone: 'text-error' },
  'no-file': { name: 'i-lucide-mail-x', tone: 'text-warning' },
}

function rowOf(entry: ReportMail, index: number): MailResultRow {
  return {
    key: `${entry.mail.id}-${index}`,
    kind: entry.kind,
    icon: ICONS[entry.kind].name,
    tone: ICONS[entry.kind].tone,
    first: outcome(entry),
    mailLine: mailFilingWords.plan.mail(entry.mail.subject, dayFormat(new Date(entry.mail.date))),
    note: '',
  }
}
</script>

<template>
  <AppCard
    v-if="store.state.workbook !== null"
    id="mail"
    :title="words.card.title"
    :subtitle="words.card.subtitle"
    collapse-id="investments.settings.mail"
    start-collapsed
    :summary="summary"
    :reveal="revealed"
    data-testid="investments-mail"
  >
    <div class="flex flex-col gap-6 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
      <MailReportReview />
      <USwitch :model-value="on" :loading="writes.saving('on')" :label="words.card.on" :description="switchHelp" data-testid="investments-mail-on" @update:model-value="switchTo($event)" />
      <UAlert
        v-if="!confirmed"
        icon="i-lucide-circle-help"
        color="warning"
        variant="subtle"
        :title="words.card.unconfirmed"
        :description="words.card.unconfirmedWhy"
        data-testid="investments-mail-unconfirmed"
      />
      <FormGrid>
        <UFormField :label="words.card.senders" :help="words.card.sendersHelp" :error="errors.senders ?? false" class="sm:col-span-2" data-testid="investments-mail-senders">
          <UInput v-model="texts.senders" inputmode="email" autocapitalize="off" :spellcheck="false" :loading="writes.saving('senders')" class="w-full" @change="commit('senders')" />
        </UFormField>
        <UFormField :label="words.card.subject" :help="words.card.subjectHelp" :error="errors.subject ?? false" data-testid="investments-mail-subject">
          <UInput v-model="texts.subject" :loading="writes.saving('subject')" class="w-full" @change="commit('subject')" />
        </UFormField>
        <UFormField :label="words.card.contents" :help="words.card.contentsHelp" :error="errors.contents ?? false" data-testid="investments-mail-contents">
          <UInput v-model="texts.contents" :loading="writes.saving('contents')" class="w-full" @change="commit('contents')" />
        </UFormField>
        <UFormField :label="words.card.since" :help="words.card.sinceHelp" :error="errors.since ?? false" data-testid="investments-mail-since">
          <DayField v-model="texts.since" :loading="writes.saving('since')" class="w-full" @change="commit('since')" />
        </UFormField>
      </FormGrid>
      <div class="flex flex-col gap-3">
        <h3 class="type-card-title">{{ words.card.lastSync }}</h3>
        <p v-if="state.stopped !== null" class="type-body text-muted" data-testid="investments-mail-stopped">{{ state.stopped }}</p>
        <p v-else-if="state.plan === null" class="type-body text-muted">{{ mailFilingWords.plan.noSyncYet }}</p>
        <template v-else>
          <MailSearchResults :search="search" :entries="state.plan.mails" :row-of="rowOf" />
          <p v-if="state.plan.mails.length === 0" class="type-body" data-testid="investments-mail-none">{{ words.card.noMailFound }}</p>
        </template>
      </div>
      <MailReportUpload />
    </div>
  </AppCard>
</template>
