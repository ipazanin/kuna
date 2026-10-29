<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { needsReview } from '../../workbook/domain/needsReview'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { writeImport } from '../application/importStatements'
import { filedTitle, stillHeld } from '../application/statementSync'
import DryRunStatementCard from './DryRunStatementCard.vue'
import { useDryRun } from './useDryRun'
import { useStatementSync } from './useStatementSync'

const store = useWorkbook()
const statements = useStatementSync()
const writes = useRecordWrites(store)
const names = useDisplayNames()

const outcome = computed(() => statements.state.outcome)
const folder = computed(() => store.state.workbook?.settings.statementsFolder.join('/') ?? '')

const heldReadings = computed(() => outcome.value?.held ?? [])
const starts = useDryRun(heldReadings)
const { dryRun, started, typedOpenings, accountNames, accountNameProblems } = starts

const held = computed(() => dryRun.value?.statements.filter(stillHeld) ?? [])

/** What the last sync filed that is on the ledger still, so Undo takes a statement off the list. */
const filed = computed(() => {
  const transactions = store.state.workbook?.transactions ?? []
  return (outcome.value?.filed ?? []).flatMap((statement) => {
    const references = new Set(statement.rows.filter((row) => row.verdict !== null).map((row) => row.reference))
    const rows = transactions.filter((row) => row.account === statement.account && references.has(row.reference))
    return rows.length === 0 ? [] : [{ label: statement.label, account: statement.account, rows: rows.length, waiting: rows.filter(needsReview).length }]
  })
})

const shows = computed(() => store.state.choice?.source === 'drive' && (outcome.value?.problem || held.value.length > 0 || filed.value.length > 0))

const summary = computed(() => {
  const count = held.value.length
  if (count === 0) return ''
  const newRows = dryRun.value?.newRows ?? 0
  return [
    `${count === 1 ? '1 statement was' : `${count} statements were`} not filed. Nothing after a held statement is filed for its account, so the next sync tries again.`,
    newRows > 0 ? `Confirming files ${newRows === 1 ? '1 row' : `${newRows} rows`}.` : '',
  ]
    .filter((sentence) => sentence !== '')
    .join(' ')
})

async function confirm(): Promise<void> {
  const run = dryRun.value
  if (run === null || run.newRows === 0) return
  const filing = run.statements.filter((statement) => statement.rows.some((row) => row.verdict !== null))
  await writes.write(filedTitle(filing, run.newRows), (unit) => writeImport(unit, run), { failedTitle: 'Not filed' })
}
</script>

<template>
  <section v-if="shows" class="flex flex-col gap-4" data-testid="statement-folder">
    <AppCard title="From the statements folder" :subtitle="`${folder} in Drive. Each sync files the statements there that the ledger lacks.`">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
        <UAlert v-if="outcome?.problem" icon="i-lucide-folder-x" color="error" variant="subtle" :title="outcome.problem" data-testid="statement-folder-problem" />
        <div v-if="filed.length" class="flex flex-col gap-1" data-testid="statement-folder-filed">
          <p class="text-sm font-medium text-highlighted">Filed by the last sync</p>
          <ul class="flex flex-col gap-1 text-sm text-toned">
            <li v-for="statement in filed" :key="`${statement.account}-${statement.label}`" class="flex items-start gap-2">
              <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <span class="min-w-0 flex-1 break-words">
                {{ statement.label }}, {{ names.account(statement.account) }}, {{ statement.rows === 1 ? '1 row' : `${statement.rows} rows`
                }}<template v-if="statement.waiting">, {{ statement.waiting }} on Review</template>
              </span>
            </li>
          </ul>
          <DrillLink v-if="filed.some((statement) => statement.waiting > 0)" to="/company/review" class="text-sm font-medium text-highlighted">Open Review</DrillLink>
        </div>
        <p v-if="summary" class="text-sm text-toned" data-testid="statement-folder-summary">{{ summary }}</p>
      </div>
    </AppCard>

    <DryRunStatementCard
      v-for="(statement, index) in held"
      :key="`${statement.fileName}-${statement.label}`"
      :statement="statement"
      :collapse-id="`import.folder-statement-${index + 1}`"
      :started="started[statement.account] === true"
      :typed-opening="typedOpenings[statement.account] ?? ''"
      :account-name="statement.newAccount ? accountNames[statement.newAccount.iban] : undefined"
      :account-name-problem="statement.newAccount ? accountNameProblems[statement.newAccount.iban] : undefined"
      @update:started="starts.start(statement.account, $event)"
      @update:typed-opening="starts.typeOpening(statement.account, $event)"
      @update:account-name="statement.newAccount && starts.nameAccount(statement.newAccount.iban, $event)"
    />

    <div v-if="held.length && (dryRun?.newRows ?? 0) > 0" class="flex justify-end">
      <UButton label="Confirm and file" icon="i-lucide-file-input" :loading="writes.busy.value" :disabled="writes.busy.value" data-testid="statement-folder-confirm" @click="confirm" />
    </div>
  </section>
</template>
