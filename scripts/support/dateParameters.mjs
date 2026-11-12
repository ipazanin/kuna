/**
 * How a words builder names a parameter that takes a worded date, which tests/croatianSentences.spec.ts tries with one
 * and the date-parameters lint holds. One that takes a day of the month, a year or a count is named otherwise, such as dayNumber.
 */
export const DATE_PARAMETER =
  /^(date|day|days|month|months|period|periods|on|from|to|until|since|start|end|deadline)$|(Date|Day|Days|Month|Months|Period|Periods|On|From|Until|Since|Start|End|Deadline)$/

/** The words of a parameter's name that say it takes a date, which the lint then holds to the pattern above. */
export const DATE_WORDS = new Set(['date', 'dates', 'day', 'days', 'month', 'months', 'period', 'periods', 'deadline', 'when'])
