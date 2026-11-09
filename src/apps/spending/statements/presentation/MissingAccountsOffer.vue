<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { ACCOUNT_WRITES, newAccount } from '../../accounts/application/accountWrites'
import { words as accountWords } from '../../accounts/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import { words as spendingWords } from '../../words'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'

/** The accounts a file needs that Kuna does not keep, drafted from the file, added with one tap. The file's dry run then reads again on its own. */
const props = defineProps<{ title: string; missing: readonly Omit<Account, 'id'>[] }>()

const writes = useRecordWrites(useSpendingBooks())

async function add(): Promise<void> {
  const accounts = props.missing.map((draft) => newAccount(draft))
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
      <ul class="flex flex-col gap-1">
        <li v-for="draft in missing" :key="`${draft.kind} ${draft.currency}`" data-testid="spending-import-missing-account">
          {{ words.import.draftLine(draft.name, draft.openedOn, formatAccountMoney(draft.opening, draft.currency)) }}
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
