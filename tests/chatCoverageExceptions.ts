/**
 * The screen write paths the chat deliberately has no action for, each group with its reason. A path is named as `tests/support/writePaths.ts`
 * names it.
 */
export interface ChatException {
  readonly reason: string
  readonly paths: readonly string[]
}

export const CHAT_EXCEPTIONS: readonly ChatException[] = [
  {
    reason:
      "Adding a movement to an informal loan from an entry's dialog, which writes a movement in Loans and then links the entry, two files under one Undo. The chat writes one app's file per card, so it links an entry to a movement already in Loans through link-entry.",
    paths: ['src/apps/spending/links/application/loanTargets.ts#addLoansMovement'],
  },
  {
    reason:
      "Recording a row as an extra payment of a bank loan from To review, which writes the extra payment in Loans and then links the row, two files under one Undo. The chat writes one app's file per card, so it links a row to an extra payment already in Loans through link-entry.",
    paths: ['src/apps/spending/links/application/loanTargets.ts#addLoansExtraPayment'],
  },
  {
    reason: "Not now on To review's card of past instalments. It only stops that card offering what the person saw on it, and the chat does not show the card.",
    paths: ['src/apps/spending/links/application/linkReview.ts#putOffPastInstalments'],
  },
  {
    reason: "Not now on To review's cards of payments from Company. It only stops a card offering what the person saw on it, and the chat does not show the cards.",
    paths: ['src/apps/spending/links/application/linkReview.ts#putOffPastOwnerPayments', 'src/apps/spending/categories/application/companyRoleWrites.ts#putOffCompanyRoles'],
  },
  {
    reason:
      "Which income category takes each kind of money from Company, answered once on To review's card. A role is Kuna's own mark on a category, which no chat operation sets, and a link the chat makes adds the starter category a role lacks.",
    paths: ['src/apps/spending/categories/application/companyRoleWrites.ts#writeCompanyRoles'],
  },
  {
    reason: "Giving the ledger's rows their ids. The app's own prompt on Settings, Books file does it in one write, and no agent fills an id.",
    paths: ['src/apps/company/workbook/application/rowIdWrites.ts#giveRowsIds'],
  },
  {
    reason: 'A bank row on hold. It is answered where it waits, on To review or the bank sync card, since the chat does not read rows on hold yet.',
    paths: ['src/apps/spending/bankSync/application/heldRowWrites.ts#answerHeldRow'],
  },
  {
    reason: 'Secrets and key-holding settings. AI keys, price vendor keys and the bank sync deployment are typed by the person and never pass through the chat.',
    paths: [
      'shared: src/shared/secrets/infrastructure/browserSecrets.ts#storeSecret',
      'shared: src/shared/secrets/infrastructure/browserSecrets.ts#forgetBrowserSecrets',
      'src/apps/spending/bankSync/application/bankSync.ts#saveDeployment',
    ],
  },
  {
    reason: "Google sign-in and consent. Google's consent window needs the person, so signing in or out and allowing access stay on the screen.",
    paths: [
      'company: src/shared/google/googleAuth.ts#needScopes',
      'kuna: src/shared/google/withGoogleAccess.ts#withGoogleAccess',
      'shared: src/shared/google/googleAuth.ts#needScopes',
      'kuna: src/shared/google/googleAuth.ts#signOutOfGoogle',
    ],
  },
  {
    reason: "The Picker. Google's Picker shows the person's Drive, so picking a file or the folder beside it stays on the screen.",
    paths: ['company: store.chooseDriveFile', 'shared: store.chooseDriveFile', 'company: store.folderBesideFile'],
  },
  {
    reason: "Bank linking. The bank's approval page needs the person, so linking a bank and coming back from it stay on the screen.",
    paths: [
      'src/apps/spending/bankSync/application/bankSync.ts#finishBankLink',
      'src/apps/spending/bankSync/infrastructure/bankBrowserState.ts#savePendingLink',
      'src/apps/spending/bankSync/infrastructure/bankBrowserState.ts#takeBankReturn',
      'src/apps/spending/bankSync/infrastructure/bankBrowserState.ts#takeReturnNote',
    ],
  },
  {
    reason: 'Downloads and exports. The browser saves the file for the person, which a card cannot do, so the chat links to the screen.',
    paths: [
      'company: src/shared/files/downloadFile.ts#downloadFile',
      'investments: src/shared/files/downloadFile.ts#downloadFile',
      'shared: src/shared/files/downloadFile.ts#downloadFile',
      'company: store.recordExport',
      'shared: store.recordExport',
    ],
  },
  {
    reason: 'Changes with no Undo on the books: deleting an app’s data or all of Kuna, starting over, importing books over the ones on screen, moving the file and trashing backups.',
    paths: [
      'shared: src/shared/storage/application/appData.ts#removeAppData',
      'shared: src/shared/app/setUpAnswer.ts#forgetSetUpAnswersOf',
      'src/shell/settings/deleteAllOfKuna.ts#forgetBrowserSettings',
      'company: store.dropWorkbook',
      'shared: store.dropWorkbook',
      'company: store.replaceLocalWorkbook',
      'shared: store.replaceLocalWorkbook',
      'shared: store.trashBackups',
      'shared: store.moveIntoKuna',
    ],
  },
  {
    reason: "Making a file on Drive. Google's own step needs the person, so the chat links the app's start screen, and makes a file only in this browser.",
    paths: ['shared: store.keepOnDrive'],
  },
]

/**
 * Store actions the chat calls for one narrow use of its own, which covers no screen that calls them: it makes an app's new file in this
 * browser and removes only that file again.
 */
export const NARROW_CHAT_ACTIONS: ReadonlySet<string> = new Set(['replaceLocalWorkbook', 'dropWorkbook'])

/** The writes the chat makes that no screen reaches, each group with its reason. A write is named `app: path`, as `chatOnlyWrites` in `tests/support/writePaths.ts` names it. */
export interface ChatOnlyException {
  readonly reason: string
  readonly writes: readonly string[]
}

export const CHAT_ONLY_EXCEPTIONS: readonly ChatOnlyException[] = [
  {
    reason: "The chat's own card: it checks a step's writes and writes them on Accept, and every operation goes through it. A screen writes through its own form.",
    writes: [
      'assets: src/shared/app/proposedWrites.ts#proposedWrites',
      'company: src/shared/app/proposedWrites.ts#proposedWrites',
      'investments: src/shared/app/proposedWrites.ts#proposedWrites',
      'loans: src/shared/app/proposedWrites.ts#proposedWrites',
      'spending: src/shared/app/proposedWrites.ts#proposedWrites',
    ],
  },
  {
    reason: "Making an app's file in this browser from a card, which the chat offers before the app is set up. The app's start screen makes its file through the store.",
    writes: [
      'assets: src/shared/app/browserFileCards.ts#browserFileOf',
      'company: src/shared/app/browserFileCards.ts#browserFileOf',
      'investments: src/shared/app/browserFileCards.ts#browserFileOf',
      'loans: src/shared/app/browserFileCards.ts#browserFileOf',
      'spending: src/shared/app/browserFileCards.ts#browserFileOf',
    ],
  },
  {
    reason: "The noun of an imported transaction's record kind, which the import card names. Reading it writes nothing.",
    writes: ['investments: src/apps/investments/transactions/application/transactionWrites.ts#transactionRecordKind'],
  },
  {
    reason: 'A statement imported with the rules that come with it, in one write. The Import screen imports a statement and changes rules as two writes.',
    writes: ['spending: src/apps/spending/statements/application/statementWrites.ts#importWithRules'],
  },
]
