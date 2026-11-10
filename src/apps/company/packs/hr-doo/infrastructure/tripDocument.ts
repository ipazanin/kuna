import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { decimalText } from '../../../../../shared/money/decimal'
import { absMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import type { MoneyFormat } from '../../../../../shared/money/moneyFormat'
import { INTL_LOCALES } from '../../../../../shared/text/language'
import { countryName } from '../../../../../shared/text/countryName'
import { printedDate } from '../../../invoicing/infrastructure/invoicePdf'
import type { PerDiemLine } from '../domain/trips/perDiems'
import { HOME_COUNTRY, legKilometres } from '../domain/trips/trip'
import type { TripCost, TripCostPayer } from '../domain/trips/trip'
import { MINUTES_IN_HOUR, clockText } from '../domain/trips/tripMoment'
import type { TripMoment } from '../domain/trips/tripMoment'
import type { TripFile } from '../domain/trips/tripReading'
import { costsPaidBy } from '../domain/trips/tripSettlement'
import type { TripSettlement, WorkedSettlement } from '../domain/trips/tripSettlement'
import { hr as tripWords } from '../presentation/trips/words'
import { tripDocumentWords as words } from './tripDocumentWords'

/** Euros as a Croatian document writes them, such as 1.234,56 €. */
export const CROATIAN_EUROS: MoneyFormat = { currency: 'EUR', locale: INTL_LOCALES.hr }

/** The company that issues the order, as its header prints it. */
export interface TripIssuer {
  readonly name: string
  readonly oib: string
  readonly address: string
}

/** What the order prints beside the trip: the company, the traveller's full name and the place the order is signed in. */
export interface TripDocumentContext {
  readonly issuer: TripIssuer
  readonly traveller: string
  readonly place: string
}

/** One value of the order. A blank is left for a hand to fill in. */
export type TripCell =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'day'; readonly day: CivilDate }
  | { readonly kind: 'euros'; readonly amount: Money }
  | { readonly kind: 'count'; readonly count: number }
  | null

export type TripCellKind = Exclude<TripCell, null>['kind']

export interface TripField {
  readonly label: string
  readonly cell: TripCell
  /** Printed in bold, as the payout is. */
  readonly strong?: boolean
}

export interface TripColumn {
  readonly heading: string
  readonly kind: TripCellKind
}

export type TripPart =
  /** Fields that add up, such as the totals, print one under another with the amounts lined up on the right. */
  | { readonly kind: 'fields'; readonly title: string; readonly fields: readonly TripField[]; readonly adds: boolean }
  | { readonly kind: 'table'; readonly title: string; readonly columns: readonly TripColumn[]; readonly rows: readonly (readonly TripCell[])[]; readonly total: TripField | null }
  | { readonly kind: 'text'; readonly title: string; readonly text: string }
  | { readonly kind: 'signatures'; readonly place: string; readonly day: CivilDate; readonly signers: readonly string[] }

/** The travel order as parts in print order, which the PDF draws and the xlsx writes as rows. */
export interface TripDocument {
  readonly title: string
  readonly issuer: TripIssuer
  readonly parts: readonly TripPart[]
}

function text(value: string): TripCell {
  return value.trim() === '' ? null : { kind: 'text', text: value }
}

function day(value: CivilDate | null): TripCell {
  return value === null ? null : { kind: 'day', day: value }
}

function euros(amount: Money | null): TripCell {
  return amount === null ? null : { kind: 'euros', amount }
}

function count(value: number): TripCell {
  return { kind: 'count', count: value }
}

/** A day and a time as the order prints them, such as 12.03.2026. 07:30. */
export function momentText(moment: TripMoment): string {
  return `${printedDate(moment.day)} ${clockText(moment.minute)}`
}

/** A cell as the PDF prints it. Euros keep their sign. */
export function cellText(cell: TripCell): string {
  if (cell === null) return ''
  if (cell.kind === 'text') return cell.text
  if (cell.kind === 'day') return printedDate(cell.day)
  if (cell.kind === 'euros') return formatMoney(cell.amount, 'negative', CROATIAN_EUROS)
  return String(cell.count)
}

function moment(value: TripMoment | null): TripCell {
  return value === null ? null : text(momentText(value))
}

function hoursText(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_IN_HOUR)
  return words.perDiems.hours(hours, String(minutes - hours * MINUTES_IN_HOUR).padStart(2, '0'))
}

function orderPart(file: TripFile, context: TripDocumentContext): TripPart {
  const { trip } = file
  const car = trip.car
  return {
    kind: 'fields',
    title: words.order.title,
    adds: false,
    fields: [
      { label: words.order.number, cell: text(trip.number) },
      { label: words.order.issued, cell: day(trip.issued) },
      { label: words.order.traveller, cell: text(context.traveller) },
      { label: words.order.role, cell: text(trip.role) },
      { label: words.order.destination, cell: text(trip.destination) },
      { label: words.order.country, cell: text(countryName(trip.country)) },
      { label: words.order.task, cell: text(trip.task) },
      { label: words.order.departs, cell: day(trip.departs) },
      { label: words.order.days, cell: count(trip.days) },
      { label: words.order.transport, cell: text(tripWords.transports[trip.transport]) },
      ...(car === null
        ? []
        : [
            { label: words.order.car, cell: text(car.make) },
            { label: words.order.plate, cell: text(car.plate) },
            { label: words.order.kmRate, cell: euros(car.kmRate) },
          ]),
      { label: words.order.advance, cell: euros(trip.advance) },
      { label: words.order.settleBy, cell: day(trip.settleBy) },
    ],
  }
}

function timesPart(file: TripFile, settlement: TripSettlement): TripPart {
  const { trip } = file
  const abroad = trip.country !== HOME_COUNTRY
  const odometer = trip.transport === 'private-car'
  return {
    kind: 'fields',
    title: words.settlement.title,
    adds: false,
    fields: [
      { label: words.settlement.left, cell: moment(trip.left) },
      { label: words.settlement.returned, cell: moment(trip.returned) },
      ...(abroad
        ? [
            { label: words.settlement.borderOut, cell: moment(trip.abroad?.out ?? null) },
            { label: words.settlement.borderIn, cell: moment(trip.abroad?.back ?? null) },
          ]
        : []),
      ...(odometer
        ? [
            { label: words.settlement.odometerStart, cell: trip.odometer === null ? null : count(trip.odometer.start) },
            { label: words.settlement.odometerEnd, cell: trip.odometer === null ? null : count(trip.odometer.end) },
            { label: words.settlement.driven, cell: trip.odometer === null ? null : count(trip.odometer.end - trip.odometer.start) },
          ]
        : []),
      ...(settlement.kind === 'waiting' ? [{ label: words.settlement.waiting, cell: text(settlement.gaps.map((gap) => words.settlement.gaps[gap]).join(', ')) }] : []),
    ],
  }
}

function legsPart(file: TripFile): TripPart {
  return {
    kind: 'table',
    title: words.legs.title,
    columns: [
      { heading: words.legs.date, kind: 'day' },
      { heading: words.legs.from, kind: 'text' },
      { heading: words.legs.to, kind: 'text' },
      { heading: words.legs.km, kind: 'count' },
    ],
    rows: file.legs.map((leg) => [day(leg.date), text(leg.from), text(leg.to), count(leg.km)]),
    total: { label: words.legs.total, cell: count(legKilometres(file.legs)) },
  }
}

function perDiemRow(line: PerDiemLine, index: number): TripCell[] {
  return [
    text(words.perDiems.day(index + 1, countryName(line.country))),
    moment(line.from),
    text(hoursText(line.minutes)),
    text(words.perDiems.shares[line.share]),
    count(line.meals),
    euros(line.amount),
  ]
}

function perDiemsPart(settlement: WorkedSettlement): TripPart {
  return {
    kind: 'table',
    title: words.perDiems.title,
    columns: [
      { heading: words.perDiems.line, kind: 'text' },
      { heading: words.perDiems.from, kind: 'text' },
      { heading: words.perDiems.lasted, kind: 'text' },
      { heading: words.perDiems.share, kind: 'text' },
      { heading: words.perDiems.meals, kind: 'count' },
      { heading: words.perDiems.amount, kind: 'euros' },
    ],
    rows: settlement.perDiemLines.map(perDiemRow),
    total: { label: words.perDiems.total, cell: euros(settlement.perDiems) },
  }
}

function costRow(cost: TripCost): TripCell[] {
  return [
    day(cost.date),
    text(tripWords.costKinds[cost.kind]),
    text(cost.description),
    cost.foreign === null ? null : text(`${decimalText(cost.foreign.amount)} ${cost.foreign.currency}`),
    euros(cost.amount),
  ]
}

function costsPart(file: TripFile, payer: TripCostPayer, total: Money | null): TripPart {
  return {
    kind: 'table',
    title: words.costs.titles[payer],
    columns: [
      { heading: words.costs.date, kind: 'day' },
      { heading: words.costs.kind, kind: 'text' },
      { heading: words.costs.description, kind: 'text' },
      { heading: words.costs.foreign, kind: 'text' },
      { heading: words.costs.amount, kind: 'euros' },
    ],
    rows: costsPaidBy(file.costs, payer).map(costRow),
    total: { label: words.costs.total, cell: euros(total) },
  }
}

function totalsPart(settlement: WorkedSettlement): TripPart {
  const { kilometres, payout } = settlement
  return {
    kind: 'fields',
    title: words.totals.title,
    adds: true,
    fields: [
      { label: words.totals.perDiems, cell: euros(settlement.perDiems) },
      ...(kilometres === null ? [] : [{ label: words.totals.kilometres(kilometres.km, formatMoney(kilometres.rate, 'negative', CROATIAN_EUROS)), cell: euros(kilometres.amount) }]),
      { label: words.totals.travellerCosts, cell: euros(settlement.travellerCosts) },
      { label: words.totals.owed, cell: euros(settlement.owed) },
      { label: words.totals.advance, cell: euros(settlement.advance) },
      { label: payout < 0 ? words.totals.toReturn : words.totals.payout, cell: euros(absMoney(payout)), strong: true },
      { label: words.totals.companyCosts, cell: euros(settlement.companyCosts) },
    ],
  }
}

/** The order, its settlement as far as it is filled, the report and the signature lines, in Croatian. Every figure comes from the trip domain. */
export function tripDocument(file: TripFile, settlement: TripSettlement, context: TripDocumentContext): TripDocument {
  const { trip } = file
  const worked = settlement.kind === 'worked' ? settlement : null
  const hasCosts = (payer: TripCostPayer) => file.costs.some((cost) => cost.paidBy === payer)
  return {
    title: words.title(trip.number),
    issuer: context.issuer,
    parts: [
      orderPart(file, context),
      timesPart(file, settlement),
      ...(file.legs.length === 0 ? [] : [legsPart(file)]),
      ...(worked === null ? [] : [perDiemsPart(worked)]),
      ...(hasCosts('traveller') ? [costsPart(file, 'traveller', worked?.travellerCosts ?? null)] : []),
      ...(hasCosts('company') ? [costsPart(file, 'company', worked?.companyCosts ?? null)] : []),
      ...(worked === null ? [] : [totalsPart(worked)]),
      { kind: 'text', title: words.report.title, text: trip.report },
      {
        kind: 'signatures',
        place: context.place,
        day: trip.settledOn ?? trip.issued,
        signers: [words.signatures.traveller, words.signatures.approver, words.signatures.checker],
      },
    ],
  }
}

/** The file name of an order's PDF or xlsx, such as putni-nalog-3-2026.pdf for order 3/2026. */
export function tripFileName(number: string, extension: 'pdf' | 'xlsx'): string {
  const slug = number
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `putni-nalog-${slug === '' ? 'bez-broja' : slug}.${extension}`
}
