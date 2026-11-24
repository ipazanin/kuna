<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

import { words } from './words'
import { clearPayee, mergePayees, savePayee } from '../application/payeeWrites'
import { editedPayee, keyOfPayee, mergedPayees, newPayee, payeeEditProblem, saysOnlyItsName, tidiedPayee } from '../domain/payeeDetails'
import type { PayeeProblem } from '../domain/payeeDetails'
import { knownPayees } from '../domain/knownPayees'
import { payeeKey } from '../domain/payeeKey'
import { payeeSpellings } from '../domain/payeeSpellings'
import { countedRows } from '../../analytics/domain/countedRow'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { PAYEE_PARTIES } from '../../workbook/domain/payee'
import type { Payee, PayeeParty } from '../../workbook/domain/payee'
import { payeeReason, words as bookWords } from '../../workbook/domain/words'
import { words as spendingWords } from '../../words'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { capitalised } from '../../../../shared/text/capitalised'
import { plural } from '../../../../shared/text/translation'
import { withFullStop } from '../../../../shared/text/withFullStop'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import IbanTagsField from '../../../../shared/ui/IbanTagsField.vue'
import OptionalSelect from '../../../../shared/ui/OptionalSelect.vue'
import RemovableChip from '../../../../shared/ui/RemovableChip.vue'

/**
 * A payee's name, the other spellings their entries count under and every detail you keep of them, with another payee to join
 * into this one. Save writes the lot in one write with one Undo, and Clear details takes off every detail and keeps the names.
 * No entry changes.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The payee as their page names them, by their key and the name they show under. */
  payee: { readonly key: string; readonly name: string }
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const rates = useRates()

const record = computed(() => store.state.workbook?.payees.find((held) => keyOfPayee(held) === props.payee.key) ?? null)
/** The record the dialog edits: the one you keep, or a new one of the name the entries spell. */
const base = computed(() => record.value ?? newPayee(props.payee.name))

/** No party is said, which `ChoiceButtons` holds as a blank value. */
const NOT_SAID = ''
const name = ref('')
const otherNames = ref<string[]>([])
const party = ref<PayeeParty | typeof NOT_SAID>(NOT_SAID)
const ibans = ref<string[]>([])
const taxId = ref('')
const website = ref('')
const note = ref('')
const sameAs = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const held = base.value
  name.value = held.names[0] ?? ''
  otherNames.value = held.names.slice(1)
  party.value = held.party ?? NOT_SAID
  ibans.value = [...held.ibans]
  taxId.value = held.taxId
  website.value = held.website
  note.value = held.note
  sameAs.value = ''
  tried.value = false
})

const partyOptions = [...PAYEE_PARTIES.map((value) => ({ value, label: value === 'person' ? words.person : words.page.business })), { value: NOT_SAID, label: words.dialog.notSaid }]

/** Each other spelling still kept, with how many entries stop counting under the payee when it is taken off. */
const spellings = computed(() => {
  const book = store.state.workbook
  const held = record.value
  if (book === null || held === null) return []
  return payeeSpellings(countedRows(book, everydayRates(rates.value)), book.payees, held).filter((spelling) => otherNames.value.includes(spelling.name))
})

function takeOff(spelling: string): void {
  otherNames.value = otherNames.value.filter((kept) => kept !== spelling)
}

/** Every other payee, a record by its first name and another by the newest spelling of its entries, as the entry dialog offers them. */
const others = computed(() => {
  const book = store.state.workbook
  if (book === null) return []
  const names = [...knownPayees(book.transactions, book.payees), ...book.payees.flatMap((held) => held.names.slice(0, 1))]
  return names
    .map((shown) => ({ label: shown, value: payeeKey(shown) }))
    .filter((choice, place, all) => choice.value !== props.payee.key && all.findIndex((other) => other.value === choice.value) === place)
})
const joined = computed((): Payee | null => {
  const key = sameAs.value
  if (key === '') return null
  const held = store.state.workbook?.payees.find((other) => keyOfPayee(other) === key)
  return held ?? newPayee(others.value.find((choice) => choice.value === key)?.label ?? key)
})

const edited = computed(() =>
  editedPayee(base.value, {
    name: name.value,
    otherNames: otherNames.value,
    party: party.value === NOT_SAID ? null : party.value,
    ibans: ibans.value,
    taxId: taxId.value,
    website: website.value,
    note: note.value,
  }),
)
const kept = computed(() => (joined.value === null ? edited.value : mergedPayees(edited.value, joined.value)))
const problem = computed(() => {
  const leaving = joined.value?.id
  return payeeEditProblem(kept.value, name.value, store.state.workbook?.payees.filter((held) => held.id !== leaving) ?? [])
})

/** The problem in the words a refused write uses, with the way out a merge offers when another payee holds the name or IBAN. */
function problemWords(found: PayeeProblem): string {
  const reason = payeeReason(found)
  if (found.kind === 'no-name') return bookWords.payeeRefused('', reason)
  const sentence = withFullStop(capitalised(reason))
  return found.kind === 'name-taken' || found.kind === 'iban-taken' ? `${sentence} ${words.dialog.joinInstead(found.holder)}` : sentence
}

const errors = computed(() => {
  const found = problem.value
  const said = found === null ? null : problemWords(found)
  return {
    name: found?.kind === 'no-name' || found?.kind === 'name-taken' ? said : null,
    ibans: found?.kind === 'not-an-iban' || found?.kind === 'iban-taken' ? said : null,
    taxId: found?.kind === 'not-an-oib' ? said : null,
  }
})

/** Whether Save would leave the books as they are: the details unchanged, or a new payee that says only its name. */
const unchanged = computed(() => {
  if (joined.value !== null) return false
  const held = record.value
  return held === null ? saysOnlyItsName(edited.value) : JSON.stringify(tidiedPayee(held)) === JSON.stringify(edited.value)
})

const hasDetails = computed(() => record.value !== null && !saysOnlyItsName({ ...record.value, names: record.value.names.slice(0, 1) }))

async function save(): Promise<void> {
  tried.value = true
  const records = store.state.records
  if (records === null || problem.value !== null) return
  if (unchanged.value) {
    open.value = false
    return
  }
  const payee = edited.value
  const other = joined.value
  const done =
    other === null
      ? await writes.write(words.dialog.saved, (unit) => savePayee(unit, records, payee), { description: payee.names[0] ?? '', failedTitle: spendingWords.form.notSaved })
      : await writes.write(words.dialog.joined, (unit) => mergePayees(unit, records, payee, other), { description: kept.value.names.join(', '), failedTitle: spendingWords.form.notSaved })
  if (done) open.value = false
}

async function clear(): Promise<void> {
  const records = store.state.records
  const held = record.value
  if (records === null || held === null) return
  const done = await writes.write(words.dialog.cleared, (unit) => clearPayee(unit, records, held), { key: 'clear', description: held.names[0] ?? '', failedTitle: spendingWords.form.notSaved })
  if (done) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="words.dialog.title" width="xl">
    <FormGrid id="spending-payee" as="form" data-testid="spending-payee-dialog" @submit.prevent="save">
      <UFormField :label="words.dialog.name" :error="(tried && errors.name) || false" class="sm:col-span-2">
        <UInput v-model="name" class="w-full" data-testid="spending-payee-name" />
      </UFormField>
      <UFormField v-if="base.names.length > 1" :label="words.dialog.otherNames" :help="words.dialog.otherNamesHelp" class="sm:col-span-2">
        <ul v-if="spellings.length > 0" class="flex flex-wrap gap-2" data-testid="spending-payee-other-names">
          <li v-for="spelling in spellings" :key="spelling.name">
            <RemovableChip
              :label="words.dialog.spelling(spelling.name, plural(words.entries(spelling.leaving), spelling.leaving))"
              :remove-label="words.dialog.takeOff(spelling.name)"
              :data-name="spelling.name"
              @remove="takeOff(spelling.name)"
            />
          </li>
        </ul>
        <p v-else class="type-caption">{{ words.dialog.noOtherNames }}</p>
      </UFormField>
      <UFormField :label="words.dialog.party" :help="words.dialog.partyHelp" class="sm:col-span-2">
        <ChoiceButtons v-model="party" :options="partyOptions" :label="words.dialog.party" data-testid="spending-payee-party" />
      </UFormField>
      <UFormField :label="words.page.ibans" :help="words.dialog.ibansHelp" :error="(tried && errors.ibans) || false" class="sm:col-span-2">
        <IbanTagsField v-model="ibans" class="w-full" data-testid="spending-payee-ibans" />
      </UFormField>
      <UFormField :label="words.page.taxId" :error="(tried && errors.taxId) || false">
        <UInput v-model="taxId" class="w-full identifier" data-testid="spending-payee-tax-id" />
      </UFormField>
      <UFormField :label="words.page.website">
        <UInput v-model="website" inputmode="url" class="w-full" data-testid="spending-payee-website" />
      </UFormField>
      <UFormField :label="words.page.note" class="sm:col-span-2">
        <UTextarea v-model="note" :rows="2" autoresize class="w-full" data-testid="spending-payee-note" />
      </UFormField>
      <UFormField :label="words.dialog.sameAs" :help="joined === null ? words.dialog.sameAsHelp : words.dialog.joins(joined.names[0] ?? '')" class="sm:col-span-2">
        <OptionalSelect v-model="sameAs" :items="others" :none="words.dialog.noOther" :search="words.dialog.findPayee" class="w-full" data-testid="spending-payee-same-as" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="hasDetails"
        :label="words.dialog.clear"
        icon="i-lucide-eraser"
        color="error"
        variant="ghost"
        :loading="writes.saving('clear')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-payee-clear"
        @click="clear"
      />
    </template>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-payee"
        :label="words.dialog.save"
        icon="i-lucide-save"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-payee-save"
      />
    </template>
  </AppDialog>
</template>
