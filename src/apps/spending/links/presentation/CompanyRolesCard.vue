<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { putOffCompanyRoles, writeCompanyRoles } from '../../categories/application/companyRoleWrites'
import type { RolePick } from '../../categories/application/companyRoleWrites'
import { starterNamesOf } from '../../categories/domain/starterCategories'
import { likelyCategoryOf } from '../domain/companyRoles'
import type { CompanyRolesAsk } from '../domain/companyRoles'
import { words } from './words'
import { words as statementWords } from '../../statements/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { CompanyMoneyRole } from '../../workbook/domain/category'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { language } from '../../../../shared/text/language'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** Asks once which income category takes each kind of money your company pays you, preselecting the one a file from before roles names so, or offering to add it. */
const props = defineProps<{ ask: CompanyRolesAsk }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const categories = computed(() => store.state.workbook?.categories ?? [])

/** The income categories a role can go to, which hold no role yet, each under its group's name. */
const choices = computed(() => {
  const groupOf = (parent: string | null) => categories.value.find((category) => category.id === parent)?.name ?? ''
  return categories.value
    .filter((category) => category.kind === 'income' && category.parent !== null && category.role === null && !category.hidden)
    .map((category) => ({ label: category.name, description: groupOf(category.parent), value: category.id }))
})

const ADD = 'add' as const
const itemsOf = (role: CompanyMoneyRole) => [...choices.value, { label: words.roles.add(starterNamesOf(role)[language === 'hr' ? 1 : 0]!), value: ADD }]

/** Each role's pick, the likely category or Add while you have not picked one. */
const picked = ref<Record<CompanyMoneyRole, RolePick['category']>>({ salary: ADD, 'rental-income': ADD, 'profit-payout': ADD, 'travel-allowance': ADD })
watch(
  () => props.ask.roles,
  (roles) => {
    for (const role of roles) picked.value[role] = likelyCategoryOf(categories.value, role) ?? ADD
  },
  { immediate: true },
)

/** Two roles in one category would leave one of them with nowhere to file. */
const clash = computed(() => {
  const chosen = props.ask.roles.map((role) => picked.value[role]).filter((value) => value !== ADD)
  return new Set(chosen).size !== chosen.length
})

async function save(): Promise<void> {
  const picks = props.ask.roles.map((role): RolePick => ({ role, category: picked.value[role] }))
  await writes.write(words.roles.saved, (unit) => writeCompanyRoles(unit, categories.value, picks, language), { key: 'company-roles', failedTitle: statementWords.review.notWritten })
}

async function notNow(): Promise<void> {
  const book = store.state.workbook
  if (book !== null)
    await writes.write(words.roles.putOff, (unit) => putOffCompanyRoles(unit, book, props.ask.through), { key: 'company-roles-not-now', failedTitle: statementWords.review.notWritten })
}
</script>

<template>
  <AppCard :title="words.roles.title" :subtitle="words.roles.subtitle" data-testid="spending-review-company-roles">
    <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
      <FormGrid>
        <UFormField v-for="role in ask.roles" :key="role" :label="words.roles.names[role]">
          <USelectMenu v-model="picked[role]" :items="itemsOf(role)" value-key="value" class="w-full" :data-testid="`spending-review-company-role-${role}`" />
        </UFormField>
      </FormGrid>
      <NoteLine v-if="clash" tone="warning" data-testid="spending-review-company-roles-clash">{{ words.roles.clash }}</NoteLine>
      <div class="flex flex-wrap gap-2">
        <UButton
          :label="words.roles.save"
          icon="i-lucide-check"
          :loading="writes.saving('company-roles')"
          :disabled="clash || writes.refused.value"
          data-testid="spending-review-company-roles-save"
          @click="save"
        />
        <UButton
          :label="words.past.notNow"
          color="neutral"
          variant="ghost"
          :loading="writes.saving('company-roles-not-now')"
          :disabled="writes.refused.value"
          data-testid="spending-review-company-roles-not-now"
          @click="notNow"
        />
      </div>
    </div>
  </AppCard>
</template>
