<script setup lang="ts">
import { ref } from 'vue'

import { civilDate } from '../../../shared/calendar/civilDate'
import { anchorWindow } from '../../../shared/calendar/ledgerWindow'
import type { PlannedMail } from '../../../shared/mail/application/mailReading'
import type { StatementMailEntry, StatementMailPlan } from '../mail/application/statementMail'
import StatementMailList from '../mail/presentation/StatementMailList.vue'
import AppCard from '../../../shared/ui/AppCard.vue'
import type { Period } from '../filters/domain/filterState'
import AccountPicker from '../filters/presentation/AccountPicker.vue'
import PeriodBar from '../filters/presentation/PeriodBar.vue'

/** The company's own specimens in the gallery: the period bar, the account picker and the mail list. Only development and fake builds load it. */
const sampleWindow = anchorWindow(civilDate(2024, 3, 1), civilDate(2026, 10, 14))
const period = ref<Period>({ preset: 'l12' })
const accounts = ref<readonly string[]>([])
const ACCOUNTS = [
  { value: 'main', label: 'Main account' },
  { value: 'card', label: 'Card account' },
  { value: 'savings', label: 'Savings' },
]

/** A made-up statement mail of the bank, one per statement number. */
function statementMail(number: number, day: string): PlannedMail {
  return { id: `statement-${number}`, subject: `Izvadak ${number}, Example Studio d.o.o.`, date: Date.parse(`${day}T05:10:00Z`) }
}

/** The camt XML of one statement mail, read. */
function statementEntry(number: number, day: string): StatementMailEntry {
  return { kind: 'read', mail: statementMail(number, day), attachment: `IZV_${day.replaceAll('-', '_')} 06_00_00_000_001.xml`, label: `${day}-statement-0${number}` }
}

const TERMS_MAIL: PlannedMail = { id: 'bank-terms', subject: 'Izvadak 000, novi opći uvjeti poslovanja', date: Date.parse('2026-09-30T09:00:00Z') }

const READ_DAYS = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14']

/** A mail step with every kind of entry, more than ten of them so Show all appears. */
const MAIL_PLAN: StatementMailPlan = {
  window: { from: Date.parse('2026-09-24T05:10:00Z'), after: 'newest' },
  query: 'from:(statements@bank.example.com) subject:"Izvadak" has:attachment after:1790226600',
  entries: [
    ...READ_DAYS.map((day, index) => statementEntry(21 + index, day)),
    { kind: 'passed-over', mail: statementMail(30, '2026-10-14'), attachment: 'IZV_2026_10_14 06_00_00_000_001.pdf' },
    { kind: 'not-read', mail: TERMS_MAIL, attachment: 'Opći uvjeti poslovanja.xml', reason: 'It is not a camt.053 statement with a creation day and a number.' },
  ],
  readings: [],
}

const STOPPED = 'Gmail asked us to slow down. Sync again in a minute.'
</script>

<template>
  <div class="flex flex-col gap-4" data-dev-only="DEV-GALLERY-ONLY-DO-NOT-SHIP">
    <h3 class="type-label">Period and filters</h3>
    <PeriodBar v-model:period="period" :window="sampleWindow" />
    <AccountPicker v-model="accounts" :options="ACCOUNTS" class="w-fit" />
    <p class="figure type-caption" aria-live="polite">Selected: {{ JSON.stringify(period) }}, {{ accounts.length ? accounts.join(' and ') : 'all accounts' }}</p>
    <h3 class="type-label">Mail list</h3>
    <AppCard data-testid="gallery-mail-plan">
      <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
        <StatementMailList :plan="MAIL_PLAN" :stopped="null" />
      </div>
    </AppCard>
    <h3 class="type-label">Mail list after a step that stopped</h3>
    <AppCard data-testid="gallery-mail-stopped">
      <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
        <StatementMailList :plan="null" :stopped="STOPPED" />
      </div>
    </AppCard>
  </div>
</template>
