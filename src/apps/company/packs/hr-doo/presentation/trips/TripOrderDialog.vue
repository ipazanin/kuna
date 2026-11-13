<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

import { parseCivilDate, today } from '../../../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import { amountForTyping, typedAmount } from '../../../../../../shared/money/typedAmount'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../../../shared/storage/presentation/useRecordWrites'
import { countryName } from '../../../../../../shared/text/countryName'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../../../shared/ui/MoneyInput.vue'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { orderDraftOf, removeTrip, saveTripOrder, tripOfOrder } from '../../application/tripWrites'
import type { TripOrderDraft } from '../../application/tripWrites'
import type { Employee } from '../../domain/employees/employees'
import { HOME_COUNTRY, OTHER_COUNTRIES, TRANSPORTS } from '../../domain/trips/trip'
import type { Trip } from '../../domain/trips/trip'
import type { TripFile } from '../../domain/trips/tripReading'
import { nextTripNumber, tripDefaults } from '../../domain/trips/tripDefaults'
import { ruleValue } from '../../ruleset/ruleset'
import { employeeName } from '../salaries/salariesView'
import { draftAmount, fieldsValid, typingAmount } from './tripsView'
import { words } from './words'

/** A new travel order, which starts from the traveller's last order, or a change to one. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  trips: readonly Trip[]
  employees: readonly Employee[]
  /** The traveller a new order starts with. */
  defaultTraveller: string | null
  /** The order the dialog changes, with its legs and costs, which Delete takes with it. Null adds a new one. */
  editing: TripFile | null
}>()

const emit = defineEmits<{
  saved: [trip: RecordId]
  deleted: []
}>()

const writes = useRecordWrites(useWorkbook())

const BLANK: TripOrderDraft = {
  number: '',
  issued: '',
  traveller: '',
  role: '',
  destination: '',
  country: HOME_COUNTRY,
  task: '',
  departs: '',
  days: '1',
  transport: 'private-car',
  car: '',
  plate: '',
  kmRate: '',
  advance: '',
  settleBy: '',
  note: '',
}

const fields = reactive<{ -readonly [Field in keyof TripOrderDraft]: string }>({ ...BLANK })
const tried = ref(false)
/** Whether the person typed a number of their own, which a new issue day then leaves alone. */
const numberTyped = ref(false)

function startFrom(traveller: string): void {
  const issued = parseCivilDate(fields.issued) ?? today()
  const defaults = tripDefaults(traveller, issued, props.trips, ruleValue)
  fields.role = defaults.role
  fields.country = defaults.country
  fields.transport = defaults.transport
  fields.car = defaults.car?.make ?? ''
  fields.plate = defaults.car?.plate ?? ''
  const rate = defaults.kmRateCap ?? defaults.car?.kmRate ?? null
  fields.kmRate = rate === null ? '' : amountForTyping(rate)
}

watch(open, (opened) => {
  if (!opened) return
  tried.value = false
  numberTyped.value = props.editing !== null
  if (props.editing !== null) {
    const draft = orderDraftOf(props.editing.trip)
    Object.assign(fields, { ...draft, kmRate: typingAmount(draft.kmRate), advance: typingAmount(draft.advance) })
    return
  }
  const day = today()
  Object.assign(fields, { ...BLANK, issued: day, departs: day, number: nextTripNumber(day, props.trips), traveller: props.defaultTraveller ?? '' })
  if (fields.traveller !== '') startFrom(fields.traveller)
})

/** The traveller, whose last order a new order starts from once picked. */
const traveller = computed({
  get: () => fields.traveller,
  set: (slug: string) => {
    fields.traveller = slug
    if (props.editing === null) startFrom(slug)
  },
})

watch(
  () => fields.issued,
  (issued) => {
    const day = parseCivilDate(issued)
    if (day !== null && !numberTyped.value) fields.number = nextTripNumber(day, props.trips)
  },
)

const travellerItems = computed(() => props.employees.map((employee) => ({ label: employeeName(employee), value: employee.slug })))
const transportItems = TRANSPORTS.map((transport): { label: string; value: string } => ({ label: words.transports[transport], value: transport }))

/** Croatia and every country the foreign per-diem table lists on the day of issue, by name. */
const countryItems = computed(() => {
  const day = parseCivilDate(fields.issued) ?? today()
  const listed = ruleValue('hr.pit.foreign-per-diem', day)
    .value.perDiems.rows.map((row) => row.country.text)
    .filter((code) => code !== OTHER_COUNTRIES && code !== HOME_COUNTRY)
  const codes = [...new Set([...listed, ...(fields.country === HOME_COUNTRY ? [] : [fields.country])])]
  const abroad = codes.map((code) => ({ label: countryName(code), value: code })).sort((first, second) => first.label.localeCompare(second.label))
  return [{ label: countryName(HOME_COUNTRY), value: HOME_COUNTRY }, ...abroad]
})

const byPrivateCar = computed(() => fields.transport === 'private-car')

const kmRateCap = computed(() => {
  const day = parseCivilDate(fields.issued) ?? today()
  return tripDefaults(fields.traveller, day, props.trips, ruleValue).kmRateCap
})

const kmRateAbove = computed(() => {
  const rate = typedAmount(fields.kmRate)
  return kmRateCap.value !== null && rate !== null && rate > kmRateCap.value
})

/** The tax-free rate under the field, in the warning tone once the typed rate is above it. */
const kmRateHint = computed(() => {
  const cap = kmRateCap.value
  if (cap === null) return {}
  return kmRateAbove.value ? { help: words.orderDialog.kmRateAbove(formatMoney(cap)), ui: { help: 'text-warning' } } : { help: words.orderDialog.kmRateHelp(formatMoney(cap)) }
})

const draft = computed((): TripOrderDraft => ({
  ...fields,
  country: fields.country === HOME_COUNTRY ? '' : fields.country,
  car: byPrivateCar.value ? fields.car : '',
  plate: byPrivateCar.value ? fields.plate : '',
  kmRate: byPrivateCar.value ? draftAmount(fields.kmRate) : '',
  advance: draftAmount(fields.advance),
}))

const errors = computed(() => ({
  number: fields.number.trim() === '' ? words.dialog.required : null,
  issued: parseCivilDate(fields.issued) === null ? words.dialog.notADay : null,
  traveller: fields.traveller === '' ? words.dialog.required : null,
  destination: fields.destination.trim() === '' ? words.dialog.required : null,
  departs: parseCivilDate(fields.departs) === null ? words.dialog.notADay : null,
  kmRate: byPrivateCar.value && typedAmount(fields.kmRate) === null ? words.dialog.notAnAmount : null,
  advance: fields.advance.trim() !== '' && typedAmount(fields.advance) === null ? words.dialog.notAnAmount : null,
}))

const refusal = computed(() => {
  const made = tripOfOrder(draft.value, props.editing?.trip ?? null)
  return 'refused' in made ? made.refused : null
})

const valid = computed(() => fieldsValid(errors.value) && refusal.value === null)

async function save(): Promise<void> {
  tried.value = true
  if (!valid.value) return
  const before = props.editing?.trip ?? null
  const saved: { trip: Trip | null } = { trip: null }
  const written = await writes.write(
    before === null ? words.orderDialog.added : words.orderDialog.changed,
    (unit) => {
      saved.trip = saveTripOrder(unit, draft.value, before)
    },
    { failedTitle: before === null ? words.orderDialog.notAdded : words.orderDialog.notChanged },
  )
  if (!written || saved.trip === null) return
  open.value = false
  emit('saved', saved.trip.id)
}

/** Deletes the order with its legs and costs in one write, which one Undo puts back. */
async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  const removed = await writes.write(words.orderDialog.deleted, (unit) => removeTrip(unit, before), { key: 'delete', failedTitle: words.orderDialog.notDeleted })
  if (!removed) return
  open.value = false
  emit('deleted')
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    changes
    :title="editing ? words.orderDialog.changeTitle : words.orderDialog.addTitle"
    :description="editing ? words.orderDialog.changeDescription : words.orderDialog.addDescription"
    width="2xl"
  >
    <FormGrid id="trip-order" as="form" data-testid="trip-order-form" @submit.prevent="save">
      <UFormField :label="words.orderDialog.traveller" :error="(tried && errors.traveller) || false">
        <USelect v-model="traveller" :items="travellerItems" class="w-full" data-testid="trip-traveller" />
      </UFormField>
      <UFormField :label="words.orderDialog.role">
        <UInput v-model="fields.role" class="w-full" />
      </UFormField>
      <UFormField :label="words.orderDialog.issued" :error="(tried && errors.issued) || false">
        <DayField v-model="fields.issued" class="w-full" />
      </UFormField>
      <UFormField :label="words.orderDialog.number" :error="(tried && errors.number) || false">
        <UInput v-model="fields.number" class="w-full" data-testid="trip-number" @input="numberTyped = true" />
      </UFormField>
      <UFormField :label="words.orderDialog.destination" :error="(tried && errors.destination) || false">
        <UInput v-model="fields.destination" class="w-full" data-testid="trip-destination" />
      </UFormField>
      <UFormField :label="words.orderDialog.country">
        <USelectMenu v-model="fields.country" :items="countryItems" value-key="value" class="w-full" data-testid="trip-country" />
      </UFormField>
      <UFormField :label="words.orderDialog.task" class="sm:col-span-2">
        <UInput v-model="fields.task" class="w-full" />
      </UFormField>
      <UFormField :label="words.orderDialog.departs" :error="(tried && errors.departs) || false">
        <DayField v-model="fields.departs" class="w-full" />
      </UFormField>
      <UFormField :label="words.orderDialog.days">
        <UInput v-model="fields.days" inputmode="numeric" class="w-full" />
      </UFormField>
      <UFormField :label="words.orderDialog.transport">
        <USelect v-model="fields.transport" :items="transportItems" class="w-full" data-testid="trip-transport" />
      </UFormField>
      <template v-if="byPrivateCar">
        <UFormField :label="words.orderDialog.car">
          <UInput v-model="fields.car" class="w-full" />
        </UFormField>
        <UFormField :label="words.orderDialog.plate">
          <UInput v-model="fields.plate" class="w-full" />
        </UFormField>
        <UFormField :label="words.orderDialog.kmRate" :error="(tried && errors.kmRate) || false" v-bind="kmRateHint" data-testid="trip-km-rate">
          <MoneyInput v-model="fields.kmRate" class="w-full" />
        </UFormField>
      </template>
      <UFormField :label="words.orderDialog.advance" :error="(tried && errors.advance) || false">
        <MoneyInput v-model="fields.advance" class="w-full" />
      </UFormField>
      <UFormField :label="words.orderDialog.settleBy">
        <DayField v-model="fields.settleBy" class="w-full" />
      </UFormField>
      <UFormField :label="words.orderDialog.note" class="sm:col-span-2">
        <UTextarea v-model="fields.note" :rows="2" autoresize class="w-full" />
      </UFormField>
      <UAlert
        v-if="tried && fieldsValid(errors) && refusal"
        icon="i-lucide-circle-alert"
        color="error"
        variant="subtle"
        :description="refusal"
        class="sm:col-span-2"
        data-testid="trip-order-refusal"
      />
    </FormGrid>
    <template #start>
      <UButton v-if="editing" :label="words.dialog.delete" icon="i-lucide-trash-2" color="error" variant="ghost" :loading="writes.saving('delete')" data-testid="trip-order-delete" @click="remove" />
    </template>
    <template #end>
      <UButton :label="words.dialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="trip-order"
        :label="editing ? words.dialog.save : words.dialog.add"
        :icon="editing ? 'i-lucide-save' : 'i-lucide-plus'"
        :loading="writes.saving('save')"
        :disabled="writes.refused.value"
        data-testid="trip-order-save"
      />
    </template>
  </AppDialog>
</template>
