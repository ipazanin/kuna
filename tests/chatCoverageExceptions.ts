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
      'company: src/shared/google/googleAuth.ts#requestAccess',
      'company: src/shared/google/withGoogleAccess.ts#withGoogleAccess',
      'kuna: src/shared/google/withGoogleAccess.ts#withGoogleAccess',
      'spending: src/shared/google/withGoogleAccess.ts#withGoogleAccess',
      'shared: src/shared/google/googleAuth.ts#needScopes',
      'shared: src/shared/google/googleAuth.ts#requestAccess',
      'shared: src/shared/google/withGoogleAccess.ts#withGoogleAccess',
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
      'shared: src/shared/ai/application/assistSettings.ts#forgetAppAssist',
      'shared: src/shared/app/setUpAnswer.ts#forgetSetUpAnswersOf',
      'src/shell/settings/deleteAllOfKuna.ts#forgetBrowserSettings',
      'company: store.dropWorkbook',
      'shared: store.dropWorkbook',
      'shared: store.trashBackups',
      'shared: store.moveIntoKuna',
      'company: store.replaceLocalWorkbook',
      'shared: store.replaceLocalWorkbook',
    ],
  },
  {
    reason: "The page's layout. The chat panel's width and how the sidebar shows follow the person's pointer and screen, so they stay on the screen.",
    paths: ['kuna: src/shared/ai/presentation/chatDock.ts#resizeChat', 'src/shell/ui/sidebarLayout.ts#chooseSidebar'],
  },
  {
    reason: 'First run. Choosing where the books live and making them happens before an app has a chat.',
    paths: ['company: src/shared/app/kunaStart.ts#answerFromFirstRun', 'shared: store.keepOnDrive'],
  },
]
