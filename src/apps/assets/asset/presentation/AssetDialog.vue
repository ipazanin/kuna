<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { ASSET_WRITES, newAsset, removeAsset } from '../application/assetWrites'
import { loanChoices, NO_LOAN } from './loanChoices'
import { assetLoans } from '../../loans/application/assetLoans'
import { assetLink, ASSETS_OVERVIEW_ROUTE } from '../../overview/presentation/assetLinks'
import { words as valueWords } from '../../values/presentation/words'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import { ASSET_KINDS, HOUSE_REGIONS } from '../../workbook/domain/asset'
import type { AssetKind, HouseRegion } from '../../workbook/domain/asset'
import type { AssetWithValuations } from '../../workbook/domain/readAssetBook'
import { words as assetsWords } from '../../words'
import { words } from './words'
import { civilDate, parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** Something you own: what it is, when it was bought and for how much, a flat's region or a car's first registration, and the bank loan on it, picked from Loans. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The asset to change, or null to add one. */
  entry: AssetWithValuations | null
}>()

const store = useAssetsBooks()
const writes = useRecordWrites(store)
const router = useRouter()

/** What the region select holds for no region, since a select's value cannot be empty. */
const NONE = 'none'

const KIND_OPTIONS = ASSET_KINDS.map((kind) => ({ value: kind, label: valueWords.kinds[kind] }))
const REGION_ITEMS = [{ label: words.assetDialog.noRegion, value: NONE }, ...HOUSE_REGIONS.map((region) => ({ label: valueWords.regions[region], value: region }))]

const loans = computed(() => assetLoans(today()))
const loanItems = computed(() => loanChoices(loans.value, store.state.workbook ?? { assets: [] }, props.entry?.asset ?? null))
const loanReason = computed(() =>
  loans.value === null ? words.assetDialog.loansNotSetUp : loans.value === 'opening' ? words.assetDialog.loansOpening : loans.value === 'failed' ? words.assetDialog.loansFailed : '',
)

const name = ref('')
const kind = ref<AssetKind>('home')
const bought = ref('')
const price = ref('')
const region = ref<HouseRegion | typeof NONE>(NONE)
const firstRegistration = ref('')
const loan = ref(NO_LOAN)
const note = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const asset = props.entry?.asset ?? null
  name.value = asset?.name ?? ''
  kind.value = asset?.kind ?? 'home'
  bought.value = asset?.bought ?? ''
  price.value = asset === null || asset.price === null ? '' : plainAmount(asset.price)
  region.value = asset?.region ?? NONE
  firstRegistration.value = asset?.firstRegistration ?? ''
  loan.value = asset?.loan ?? NO_LOAN
  note.value = asset?.note ?? ''
  tried.value = false
})

/** A typed day, null for a blank field, or undefined for text that is no day. */
function typedDay(text: string): CivilDate | null | undefined {
  return text.trim() === '' ? null : (parseCivilDate(text) ?? undefined)
}

const boughtDay = computed(() => typedDay(bought.value))
const registrationDay = computed(() => typedDay(firstRegistration.value))
const pricePaid = computed(() => (price.value.trim() === '' ? null : typedAmount(price.value)))

const errors = computed(() => ({
  name: name.value.trim() === '' ? words.assetDialog.nameError : null,
  bought: boughtDay.value === undefined ? assetsWords.form.aDate(civilDate(2025, 3, 15)) : null,
  price:
    pricePaid.value === undefined || (pricePaid.value !== null && pricePaid.value <= 0)
      ? words.assetDialog.anAmount
      : pricePaid.value !== null && boughtDay.value === null
        ? words.assetDialog.priceNeedsBought
        : null,
  firstRegistration: kind.value === 'car' && registrationDay.value === undefined ? assetsWords.form.aDate(civilDate(2024, 1, 15)) : null,
}))

async function save(): Promise<void> {
  tried.value = true
  const boughtOn = boughtDay.value
  const registered = registrationDay.value
  const paid = pricePaid.value
  if (Object.values(errors.value).some((error) => error !== null) || boughtOn === undefined || registered === undefined || paid === undefined) return
  const typed = newAsset({
    name: name.value,
    kind: kind.value,
    bought: boughtOn,
    price: paid,
    region: kind.value === 'home' && region.value !== NONE ? region.value : null,
    firstRegistration: kind.value === 'car' ? registered : null,
    loan: loan.value === NO_LOAN ? null : loan.value,
    note: note.value,
  })
  const before = props.entry?.asset ?? null
  if (before === null) {
    if (await writes.write(words.assetDialog.added, (unit) => unit.of(ASSET_WRITES).add(typed), { failedTitle: assetsWords.form.notAdded })) {
      open.value = false
      await router.push(assetLink(typed))
    }
    return
  }
  if (await writes.write(words.assetDialog.saved, (unit) => unit.of(ASSET_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: assetsWords.form.notSaved })) open.value = false
}

async function remove(): Promise<void> {
  const asset = props.entry?.asset ?? null
  const records = store.state.records
  if (asset === null || records === null) return
  if (await writes.write(words.assetDialog.deleted, (unit) => removeAsset(unit, records, asset), { key: 'delete', failedTitle: assetsWords.form.notDeleted })) {
    open.value = false
    await router.push(ASSETS_OVERVIEW_ROUTE)
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="entry === null ? words.assetDialog.addTitle : words.assetDialog.changeTitle" :description="words.assetDialog.description">
    <FormGrid id="asset" as="form" data-testid="asset-form" @submit.prevent="save">
      <UFormField :label="words.assetDialog.name" :error="(tried && errors.name) || false">
        <UInput v-model="name" :placeholder="words.assetDialog.namePlaceholder" class="w-full" data-testid="asset-name" />
      </UFormField>
      <UFormField :label="words.assetDialog.kind">
        <ChoiceButtons v-model="kind" :options="KIND_OPTIONS" :label="words.assetDialog.kind" data-testid="asset-kind" />
      </UFormField>
      <UFormField :label="words.assetDialog.bought" :error="(tried && errors.bought) || false">
        <UInput v-model="bought" type="date" class="w-full" data-testid="asset-bought" />
      </UFormField>
      <UFormField :label="words.assetDialog.price" :help="words.assetDialog.priceHelp" :error="(tried && errors.price) || false">
        <MoneyInput v-model="price" :placeholder="assetsWords.form.amountPlaceholder" class="w-full" data-testid="asset-price" />
      </UFormField>
      <UFormField v-if="kind === 'home'" :label="words.assetDialog.region" :help="valueWords.indexDefinition" class="sm:col-span-2">
        <USelect v-model="region" :items="REGION_ITEMS" class="w-full" data-testid="asset-region" />
      </UFormField>
      <UFormField
        v-if="kind === 'car'"
        :label="words.assetDialog.firstRegistration"
        :help="words.assetDialog.firstRegistrationHelp"
        :error="(tried && errors.firstRegistration) || false"
        class="sm:col-span-2"
      >
        <UInput v-model="firstRegistration" type="date" class="w-full" data-testid="asset-first-registration" />
      </UFormField>
      <UFormField :label="words.assetDialog.loan" :help="loanReason" class="sm:col-span-2">
        <USelect v-model="loan" :items="loanItems" :disabled="loanReason !== ''" class="w-full" data-testid="asset-loan" />
      </UFormField>
      <UFormField :label="assetsWords.form.note" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="asset-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="entry !== null"
        :label="words.assetDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value"
        data-testid="asset-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="assetsWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="asset"
        :label="entry === null ? words.assetDialog.add : words.assetDialog.save"
        :icon="entry === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value"
        data-testid="asset-save"
      />
    </template>
  </AppDialog>
</template>
