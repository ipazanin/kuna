<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { listInWords } from '../../../../shared/text/listInWords'
import { slugInWords } from '../../workbook/domain/slugInWords'
import type { SlugUses } from '../../workbook/domain/slug'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { NEW_ACCOUNT_DRAFT, accountDraftErrors, accountDraftsOf, accountsOfDrafts, sourcesOfDraft } from '../domain/accountDrafts'
import type { AccountDraft } from '../domain/accountDrafts'
import type { CompanyPeriod, CompanySource } from '../../workbook/domain/workbook'
import type { PeriodDraft } from '../../../../shared/app/periodDrafts'
import type { HandoverWords } from '../../../../shared/ui/sourceHandover'
import DayField from '../../../../shared/ui/DayField.vue'
import SourceHandoverAlert from '../../../../shared/ui/SourceHandoverAlert.vue'
import { storedOf } from '../../../../shared/storage/domain/recordsRead'
import { words } from './words'

const props = defineProps<{
  /** The accounts as stored, refused ones included, so they can be fixed here. */
  records: RecordsRead<AccountRecord>
  /** What names each account outside the tab. An account in use keeps its name and its row. */
  uses: SlugUses
  /** The workbook's currency, which a blank account currency means. */
  currency: string
  /** This form's save is running, which spins its Save. */
  saving: boolean
  /** The file takes no changes, which switches its Save off. */
  refused: boolean
  /** Where each account's rows come from on which days, by its name, as the workbook reads it. */
  sources: ReadonlyMap<string, readonly CompanyPeriod[]>
  /** Why a saved account's new periods may not be written, or the rows saving them takes out of the ledger. */
  periodsCheck: (account: string, after: readonly CompanyPeriod[]) => { readonly fault: string | null; readonly warning: HandoverWords | null }
}>()

const emit = defineEmits<{
  save: [made: readonly { readonly saved: number | null; readonly record: AccountRecord }[]]
}>()

const stored = computed(() => storedOf(props.records))
const savedDrafts = computed(() => accountDraftsOf(stored.value, props.sources))
const drafts = ref<AccountDraft[]>(savedDrafts.value)
watch(savedDrafts, (saved) => {
  drafts.value = saved
})

const SOURCE_ITEMS: { value: CompanySource; label: string }[] = [
  { value: 'mail', label: words.accounts.rowsFrom.mail },
  { value: 'provider-file', label: words.accounts.rowsFrom.providerFile },
  { value: 'by-hand', label: words.accounts.rowsFrom.byHand },
]

const usedNames = computed(() => new Set(props.uses.keys()))
const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(savedDrafts.value))
/** What saving each saved account's typed periods does, by its row: why the write would refuse them, or the rows it takes out. */
const checks = computed(
  () =>
    new Map(
      drafts.value.flatMap((draft, index) => {
        const after = sourcesOfDraft(draft).periods
        return draft.saved === null || after === null ? [] : [[index, props.periodsCheck(draft.savedName.trim().toLowerCase(), after)] as const]
      }),
    ),
)

/** Each row's faults, with periods the write would refuse said under them. */
const errors = computed(() => {
  const found = new Map(accountDraftErrors(drafts.value, usedNames.value))
  for (const [index, check] of checks.value) {
    if (check.fault !== null && found.get(index)?.sources === undefined) found.set(index, { ...found.get(index), sources: check.fault })
  }
  return found
})

function update<Field extends 'account' | 'label' | 'iban' | 'currency' | 'periods'>(index: number, field: Field, value: AccountDraft[Field]): void {
  drafts.value = drafts.value.map((draft, position) => (position === index ? { ...draft, [field]: value } : draft))
}

function changePeriod(index: number, place: number, change: Partial<PeriodDraft<CompanySource>>): void {
  update(
    index,
    'periods',
    drafts.value[index]!.periods.map((period, at) => (at === place ? { ...period, ...change } : period)),
  )
}

function addPeriod(index: number): void {
  const { periods } = drafts.value[index]!
  const last = periods[periods.length - 1]
  const source = SOURCE_ITEMS.find((item) => item.value !== last?.source)!.value
  update(index, 'periods', [...periods, { source, from: '' }])
}

function removePeriod(index: number, place: number): void {
  update(
    index,
    'periods',
    drafts.value[index]!.periods.filter((_period, at) => at !== place),
  )
}

function locked(draft: AccountDraft): boolean {
  return draft.savedName !== '' && usedNames.value.has(draft.savedName.trim().toLowerCase())
}

function inUse(draft: AccountDraft): string {
  return words.inUse(listInWords(props.uses.get(draft.savedName.trim().toLowerCase()) ?? []))
}

function addAccount(): void {
  drafts.value = [...drafts.value, NEW_ACCOUNT_DRAFT]
}

function remove(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
}

function save(): void {
  const made = accountsOfDrafts(stored.value, drafts.value)
  const records = made.flatMap((draft) => ('record' in draft ? [draft] : []))
  // A draft its kind refuses is shown with its error, so a save never leaves it out.
  if (records.length === made.length) emit('save', records)
}
</script>

<template>
  <div class="@container relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
    <table class="data-table editor-table w-full" data-testid="accounts-editor">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.accounts.columns.account }}</th>
          <th scope="col" class="text-start">{{ words.accounts.columns.label }}</th>
          <th scope="col" class="text-start">{{ words.accounts.columns.iban }}</th>
          <th scope="col" class="text-start">{{ words.accounts.columns.currency }}</th>
          <th scope="col">
            <span class="sr-only">{{ words.accounts.columns.delete }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="drafts.length === 0">
          <td colspan="5" class="text-muted">{{ words.accounts.none }}</td>
        </tr>
        <template v-for="(draft, index) in drafts" :key="draft.saved ?? `new-${index}`">
          <tr data-testid="account-row">
            <td>
              <UInput
                :model-value="draft.account"
                :disabled="locked(draft)"
                :title="locked(draft) ? inUse(draft) : undefined"
                :color="errors.get(index)?.account ? 'error' : 'neutral'"
                :highlight="Boolean(errors.get(index)?.account)"
                :aria-label="words.accounts.columns.account"
                size="sm"
                class="w-40"
                @update:model-value="update(index, 'account', String($event))"
              />
              <p v-if="errors.get(index)?.account" class="field-error">{{ errors.get(index)?.account }}</p>
            </td>
            <td>
              <UInput
                :model-value="draft.label"
                :placeholder="slugInWords(draft.account)"
                :aria-label="words.accounts.columns.label"
                size="sm"
                class="w-40"
                @update:model-value="update(index, 'label', String($event))"
              />
            </td>
            <td>
              <UInput :model-value="draft.iban" :aria-label="words.accounts.columns.iban" size="sm" class="identifier w-64" @update:model-value="update(index, 'iban', String($event))" />
            </td>
            <td>
              <UInput
                :model-value="draft.currency"
                :placeholder="currency"
                :color="errors.get(index)?.currency ? 'error' : 'neutral'"
                :highlight="Boolean(errors.get(index)?.currency)"
                :aria-label="words.accounts.columns.currency"
                size="sm"
                class="w-24"
                @update:model-value="update(index, 'currency', String($event).toUpperCase())"
              />
              <p v-if="errors.get(index)?.currency" class="field-error">{{ errors.get(index)?.currency }}</p>
            </td>
            <td>
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="locked(draft)"
                :title="locked(draft) ? inUse(draft) : undefined"
                :aria-label="draft.saved === null ? words.accounts.removeNew : words.accounts.deleteName(draft.savedName)"
                @click="remove(index)"
              />
            </td>
          </tr>
          <tr class="sources-row" data-testid="account-sources">
            <td colspan="5" class="cell-wraps">
              <div class="sources sticky left-3 flex flex-col gap-2">
                <div v-for="(period, place) in draft.periods" :key="place" class="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" :aria-label="words.accounts.sources.source(place + 1)">
                  <div class="flex items-center gap-2">
                    <span class="type-label" aria-hidden="true">{{ place === 0 ? words.accounts.columns.rowsFrom : words.accounts.sources.then }}</span>
                    <USelect
                      :model-value="period.source"
                      :items="SOURCE_ITEMS"
                      :aria-label="words.accounts.sources.source(place + 1)"
                      size="sm"
                      class="w-48"
                      :data-testid="place === 0 ? 'account-rows-from' : 'account-source'"
                      @update:model-value="changePeriod(index, place, { source: $event as CompanySource })"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="type-label" aria-hidden="true">{{ words.accounts.columns.startsOn }}</span>
                    <DayField
                      :model-value="period.from"
                      size="sm"
                      :aria-label="place === 0 ? words.accounts.sources.firstFrom : words.accounts.columns.startsOn"
                      :data-testid="place === 0 ? 'account-starts-on' : 'account-source-from'"
                      @update:model-value="changePeriod(index, place, { from: $event })"
                    />
                    <UButton
                      v-if="place > 0"
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :aria-label="words.accounts.sources.remove"
                      data-testid="account-source-remove"
                      @click="removePeriod(index, place)"
                    />
                  </div>
                </div>
                <UButton
                  :label="words.accounts.sources.add"
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  class="self-start"
                  data-testid="account-source-add"
                  @click="addPeriod(index)"
                />
                <SourceHandoverAlert v-if="checks.get(index)?.warning" :handover="checks.get(index)!.warning!" data-testid="account-handover" />
              </div>
              <p v-if="errors.get(index)?.sources" class="field-error sticky left-3">{{ errors.get(index)?.sources }}</p>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
  <div class="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
    <UButton :label="words.accounts.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="addAccount" />
    <span class="flex-1" />
    <UButton :label="words.accounts.discard" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving || refused" @click="drafts = savedDrafts" />
    <UButton :label="words.accounts.save" icon="i-lucide-save" size="sm" :loading="saving" :disabled="!dirty || errors.size > 0 || saving || refused" @click="save" />
  </div>
</template>

<style scoped>
.editor-table td {
  vertical-align: top;
}

.editor-table tbody .sources-row > td {
  border-top: 0;
  padding-top: 0;
}

/* The table scrolls sideways on a narrow card, so an account's sources stay in view and wrap at the card's width. */
.sources {
  max-width: calc(100cqw - 1.5rem);
}

.field-error {
  margin-top: 0.25rem;
  max-width: 16rem;
  white-space: normal;
  font-size: 0.75rem;
  color: var(--tone-negative);
}
</style>
