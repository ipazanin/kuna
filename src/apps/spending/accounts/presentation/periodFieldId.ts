/** The id of the field of a period's first day in the account dialog, the start day for the first, which a Change about that period opens at. */
export function periodFieldId(place: number): string {
  return place === 0 ? 'spending-account-opened-on-field' : `spending-account-period-${place}`
}
