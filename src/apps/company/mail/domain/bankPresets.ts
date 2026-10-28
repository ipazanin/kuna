/** A bank whose statement mail the app knows: the addresses it mails statements from and the words before the statement number in their subject. */
export interface BankPreset {
  readonly id: string
  readonly name: string
  readonly senders: readonly string[]
  readonly subject: string
}

/** The banks onboarding offers by name. Any other bank's sender and subject words are typed in. */
export const BANK_PRESETS: readonly BankPreset[] = [{ id: 'erste', name: 'Erste', senders: ['netbanking.support@erstebank.hr'], subject: 'ERSTE Izvadak' }]
