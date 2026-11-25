import { naturalOrder } from '../../text/naturalOrder'

/** The rules in the order they are tried: by order, then by id. */
export function inTryingOrder<Tried extends { readonly id: string; readonly order: number }>(rules: readonly Tried[]): Tried[] {
  return [...rules].sort((earlier, later) => earlier.order - later.order || naturalOrder(earlier.id.toLowerCase(), later.id.toLowerCase()))
}
