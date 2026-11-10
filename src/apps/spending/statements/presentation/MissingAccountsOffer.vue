<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { words } from './words'
import { ACCOUNT_WRITES, newAccount } from '../../accounts/application/accountWrites'
import { openingOn, startDays, startsWithin } from '../../accounts/domain/bankOpening'
import { words as accountWords } from '../../accounts/presentation/words'
import type { DraftedAccount } from '../domain/statementRows'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import { words as spendingWords } from '../../words'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'

/**
 * The accounts a file needs that Kuna does not keep, drafted from the file, each starting on the day typed beside it, added with one tap.
 * The file's dry run then reads again on its own.
 */
const props = defineProps<{ title: string; missing: readonly DraftedAccount[] }>()

const writes = useRecordWrites(useSpendingBooks())

/** The start day typed for each draft, by its kind and currency. One not typed starts on the earliest day its rows allow. */
const typedStarts = ref<Readonly<Record<string, string>>>({})
const tried = ref(false)

function keyOf({ account }: DraftedAccount): string {
  return `${account.kind} ${account.currency}`
}

function typedStart(drafted: DraftedAccount): string {
  return typedStarts.value[keyOf(drafted)] ?? drafted.account.openedOn
}

function typeStart(drafted: DraftedAccount, typed: string): void {
  typedStarts.value = { ...typedStarts.value, [keyOf(drafted)]: typed }
}

/** The typed day, or null while it is not one the draft can start on, which runs to today. */
function startOf(drafted: DraftedAccount): CivilDate | null {
  const startsOn = parseCivilDate(typedStart(drafted))
  return startsOn !== null && startsWithin(drafted.evidence, startsOn, today()) ? startsOn : null
}

/** The draft starting on the typed day, at the file's last balance less its rows from that day on, or null while the day is out of range. */
function startedDraft(drafted: DraftedAccount): Omit<Account, 'id'> | null {
  const startsOn = startOf(drafted)
  if (startsOn === null) return null
  const { opening, openedOn } = openingOn(drafted.evidence, startsOn)
  return { ...drafted.account, opening, openedOn }
}

/** Each draft as the typed day starts it. */
const shown = computed(() => props.missing.map((drafted) => ({ drafted, started: startedDraft(drafted) })))

function startError(drafted: DraftedAccount): string | false {
  if (!tried.value || startOf(drafted) !== null) return false
  const { earliest, latest } = startDays(drafted.evidence, today())
  return accountWords.startDay.between(earliest, latest)
}

async function add(): Promise<void> {
  tried.value = true
  const drafts = props.missing.flatMap((drafted) => startedDraft(drafted) ?? [])
  if (drafts.length < props.missing.length) return
  const accounts = drafts.map((draft) => newAccount(draft))
  await writes.write(plural(accountWords.addedCount(accounts.length), accounts.length), (unit) => accounts.forEach((account) => unit.of(ACCOUNT_WRITES).add(account)), {
    description: listInWords(accounts.map((account) => account.name)),
    key: 'import-accounts',
    failedTitle: spendingWords.form.notAdded,
  })
}
</script>

<template>
  <UAlert icon="i-lucide-wallet" color="info" variant="subtle" :title="title" data-testid="spending-import-missing-accounts">
    <template #description>
      <ul class="flex flex-col gap-3">
        <li v-for="{ drafted, started } in shown" :key="keyOf(drafted)" class="flex flex-col gap-1.5" data-testid="spending-import-missing-account">
          <span data-testid="spending-import-missing-account-draft">{{
            started === null ? drafted.account.name : words.import.draftLine(started.name, started.openedOn, formatAccountMoney(started.opening, started.currency))
          }}</span>
          <UFormField :label="accountWords.startDay.label" :error="startError(drafted)" data-testid="spending-import-missing-account-start-field">
            <UInput
              :model-value="typedStart(drafted)"
              type="date"
              :min="startDays(drafted.evidence, today()).earliest"
              :max="today()"
              class="w-full max-w-60"
              data-testid="spending-import-missing-account-start"
              @update:model-value="typeStart(drafted, String($event))"
            />
          </UFormField>
        </li>
      </ul>
    </template>
    <template #actions>
      <UButton
        :label="missing.length === 1 ? words.import.addAccount : words.import.addAccounts"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="writes.saving('import-accounts')"
        data-testid="spending-import-add-accounts"
        @click="add"
      />
    </template>
  </UAlert>
</template>
