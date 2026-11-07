<script setup lang="ts">
import { ref } from 'vue'

import { civilDate } from '../../../shared/calendar/civilDate'
import { anchorWindow } from '../../../shared/calendar/ledgerWindow'
import type { MailPlan, PlanEntry, PlannedMail } from '../../../shared/mail-filing/application/mailFiling'
import MailPlanList from '../../../shared/mail-filing/presentation/MailPlanList.vue'
import AppCard from '../../../shared/ui/AppCard.vue'
import type { FilterChip } from '../filters/domain/filterChips'
import type { Period } from '../filters/domain/filterState'
import AccountPicker from '../filters/presentation/AccountPicker.vue'
import FilterChipRow from '../filters/presentation/FilterChipRow.vue'
import PeriodBar from '../filters/presentation/PeriodBar.vue'

/** The company's own specimens in the gallery: the period bar, the account picker, the filter chips and the mail list. Only development and fake builds load it. */
const sampleWindow = anchorWindow(civilDate(2024, 3, 1), civilDate(2026, 10, 14))
const period = ref<Period>({ preset: 'l12' })
const accounts = ref<readonly string[]>([])
const ACCOUNTS = [
  { value: 'main', label: 'Main account' },
  { value: 'card', label: 'Card account' },
  { value: 'savings', label: 'Savings' },
]
const chips = ref<FilterChip[]>([
  { id: 'bucket', label: 'Bucket: operating' },
  { id: 'category', label: 'Category: software-subscriptions' },
  { id: 'counterparty', label: 'Counterparty: Cloud hosting' },
])
function removeChip(id: string): void {
  chips.value = chips.value.filter((chip) => chip.id !== id)
}

const STATEMENTS_FOLDER = ['finance', 'statements', '2026-statements']

/** A made-up statement mail of the bank, one per statement number. */
function statementMail(number: number, day: string): PlannedMail {
  return { id: `statement-${number}`, subject: `Izvadak ${number}, Example Studio d.o.o.`, date: Date.parse(`${day}T05:10:00Z`) }
}

/** The camt XML of one statement mail, filed or already there. */
function statementEntry(kind: 'filed' | 'already', number: number, day: string): PlanEntry {
  return { kind, mail: statementMail(number, day), attachment: `IZV_${day.replaceAll('-', '_')} 06_00_00_000_001.xml`, path: STATEMENTS_FOLDER, name: `${day}-statement-0${number}-main.xml` }
}

const TERMS_MAIL: PlannedMail = { id: 'bank-terms', subject: 'Izvadak 000, novi opći uvjeti poslovanja', date: Date.parse('2026-09-30T09:00:00Z') }

const FILED_DAYS = ['2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14']

/** A mail step with every kind of entry, more than ten of them so Show all appears, and a second source that failed. */
const MAIL_PLAN: MailPlan = {
  sources: [
    {
      kind: 'planned',
      id: 'statements',
      label: 'Bank statements',
      window: { from: Date.parse('2026-09-24T05:10:00Z'), after: 'newest' },
      query: 'from:(statements@bank.example.com) subject:"Izvadak" has:attachment after:1790226600',
      entries: [
        statementEntry('already', 21, '2026-10-01'),
        ...FILED_DAYS.map((day, index) => statementEntry('filed', 22 + index, day)),
        {
          kind: 'not-filed',
          mail: statementMail(30, '2026-10-14'),
          attachment: 'IZV_2026_10_14 06_00_00_000_001.pdf',
          path: STATEMENTS_FOLDER,
          name: '2026-10-14-statement-030.pdf',
          reason: 'Drive did not take the upload. Sync again later.',
        },
        { kind: 'unmatched', mail: TERMS_MAIL, attachment: 'Opći uvjeti poslovanja.xml', reason: 'It is not a camt.053 statement with a creation day and a number.' },
      ],
    },
    { kind: 'failed', id: 'savings-statements', label: 'Savings account statements', reason: 'Gmail did not answer the search. Sync again later.' },
  ],
}

const STOPPED = 'Gmail asked us to slow down. Sync again in a minute.'
</script>

<template>
  <div class="flex flex-col gap-4" data-dev-only="DEV-GALLERY-ONLY-DO-NOT-SHIP">
    <h3 class="type-label">Period and filters</h3>
    <PeriodBar v-model:period="period" :window="sampleWindow" />
    <AccountPicker v-model="accounts" :options="ACCOUNTS" class="w-fit" />
    <FilterChipRow :chips="chips" one-line @remove="removeChip" @clear="chips = []" />
    <p class="figure type-caption" aria-live="polite">Selected: {{ JSON.stringify(period) }}, {{ accounts.length ? accounts.join(' and ') : 'all accounts' }}</p>
    <h3 class="type-label">Mail list</h3>
    <AppCard data-testid="gallery-mail-plan">
      <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
        <MailPlanList :plan="MAIL_PLAN" :stopped="null" />
      </div>
    </AppCard>
    <h3 class="type-label">Mail list after a step that stopped</h3>
    <AppCard data-testid="gallery-mail-stopped">
      <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
        <MailPlanList :plan="null" :stopped="STOPPED" />
      </div>
    </AppCard>
  </div>
</template>
