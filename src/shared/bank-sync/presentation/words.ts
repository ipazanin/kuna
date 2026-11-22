import type { BankUsage } from '../domain/bankLink'
import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  notSaved: 'Not saved',
  copyFailed: 'Kuna could not copy it. Select the text and copy it yourself.',
  key: {
    title: 'Your Enable Banking key',
    drop: 'Drop the .pem file here',
    dropHelp: 'The file Enable Banking downloaded when you registered the application. Its name is the application ID.',
    paste: 'Or paste the key',
    pasteHelp: 'Everything from -----BEGIN PRIVATE KEY----- to -----END PRIVATE KEY-----.',
    applicationHelp: "Filled in from the file's name. Fix it if the file was renamed.",
    check: 'Check',
    cancel: 'Cancel',
    kept: 'Kept in this browser and in your Google account, so every device that syncs holds it. The chat never sees it.',
    otherApplication: 'This is another application, so the links to your banks end and you link each bank again.',
    unreadable: 'Kuna cannot read this key. Bring the .pem file Enable Banking downloaded.',
    refused: (reason: string) => `Enable Banking did not accept the key: ${reason}`,
    saved: 'Bank sync set up',
    replaced: 'Key replaced',
  },
  application: {
    named: (name: string) => `Enable Banking application ${name}`,
    id: (applicationId: string) => `Application ID ${applicationId}`,
    active: 'Active, so it can link your banks.',
    problems: {
      sandbox: 'This application is in the sandbox, which links only test banks. Make one in the production environment.',
      'redirect-missing': (address: string) => `The application does not list ${address} as a redirect URL. Add it in Enable Banking's Control Panel.`,
      'not-active': "Not active yet. In Enable Banking's Control Panel, link every account your banks offer, then Check again.",
    },
    check: 'Check again',
    replace: 'Replace key',
    remove: 'Remove bank sync',
    removeCaption: 'Ends every bank link and forgets the key in this browser and in your Google account.',
    removeTitle: 'Remove bank sync?',
    removeDescription:
      'Kuna ends every bank link at Enable Banking and forgets your key in this browser and in your Google account. To read your banks again, you bring the key and link each bank again.',
    removed: 'Bank sync removed',
    notRemoved: 'Not removed',
  },
  pick: {
    title: 'Link a bank',
    description: {
      personal: 'The banks Enable Banking lists for Croatia that take a personal login. Pick yours, and it asks you to approve, then sends you back here.',
      business: 'The banks Enable Banking lists for Croatia that take a business login. Pick yours, and it asks you to approve, then sends you back here.',
    } satisfies Record<BankUsage, string>,
    loading: 'Asking Enable Banking for its banks…',
    opening: "Opening your bank's approval…",
    failed: (reason: string) => `Enable Banking's banks could not be read: ${reason}`,
    tryAgain: 'Try again',
    none: {
      personal: 'Enable Banking lists no bank for Croatia that takes a personal login.',
      business: 'Enable Banking lists no bank for Croatia that takes a business login.',
    } satisfies Record<BankUsage, string>,
    betaCaption: 'Enable Banking still tests its link to this bank.',
    linked: (date: string) => `Linked until ${date}, and linking again replaces it.`,
    cancel: 'Cancel',
  },
  walk: {
    next: 'Next',
    done: 'Done',
    copy: (field: string) => `Copy ${field}`,
    copied: 'Copied',
    start: {
      title: 'Before you start',
      subtitle: 'Kuna reads your banks through an Enable Banking application of your own. Setting it up takes about half an hour.',
      lines: [
        'Enable Banking is a licensed service that reads your bank accounts with your approval.',
        'You make the application once, in its Control Panel, and link every account there. That puts it in restricted mode, so it reads only those accounts.',
        'Each bank asks you to approve twice: once in the Control Panel, and once when Kuna links it.',
        "The application's key stays in this browser and in your Google account, so every device that syncs holds it. Nobody else, Kuna's author included, ever sees it.",
      ],
    },
    make: {
      title: 'Make your application',
      subtitle: 'Sign in at enablebanking.com with your email and open API applications in the Control Panel.',
      lines: [
        'Add a new application in the production environment, keeping the default of a key made in your browser.',
        'Fill in the form with these values. Your own email goes under data protection email.',
        'Register. Your browser downloads a .pem file named after the application ID. Keep it out of any shared folder.',
      ],
      open: 'Open Enable Banking',
      fields: { name: 'Name', description: 'Description', privacy: 'Privacy URL', terms: 'Terms URL', redirect: 'Redirect URL' },
      description: 'Personal budgeting, read only',
    },
    key: { title: 'Bring its key', subtitle: 'Drop the .pem file or paste it. Check signs one call with it, and Kuna keeps it only if Enable Banking answers.' },
    activate: {
      title: 'Activate it',
      subtitle: 'In the Control Panel, press Activate by linking accounts and approve every account your banks offer. Then Check again until it says it is active.',
      ready: 'Your application is ready. Link each bank on the next screen.',
    },
  },
}

export const hr: Translation<typeof en> = {
  notSaved: 'Nije spremljeno',
  copyFailed: 'Kuna to nije mogla kopirati. Označite tekst i kopirajte ga sami.',
  key: {
    title: 'Vaš ključ za Enable Banking',
    drop: 'Ispusti datoteku .pem ovdje',
    dropHelp: 'Datoteka koju je Enable Banking preuzeo kad ste registrirali aplikaciju. Njezin naziv je ID aplikacije.',
    paste: 'Ili zalijepi ključ',
    pasteHelp: 'Sve od -----BEGIN PRIVATE KEY----- do -----END PRIVATE KEY-----.',
    applicationHelp: 'Popunjeno iz naziva datoteke. Ispravite ga ako je datoteka preimenovana.',
    check: 'Provjeri',
    cancel: 'Odustani',
    kept: 'Čuva se u ovom pregledniku i na vašem Google računu, pa ga ima svaki uređaj koji se sinkronizira. Razgovor ga nikad ne vidi.',
    otherApplication: 'Ovo je druga aplikacija, pa veze s bankama prestaju i svaku banku povezujete ponovno.',
    unreadable: 'Kuna ne može pročitati ovaj ključ. Donesite datoteku .pem koju je preuzeo Enable Banking.',
    refused: (reason) => `Enable Banking nije prihvatio ključ: ${reason}`,
    saved: 'Sinkronizacija s bankom postavljena',
    replaced: 'Ključ zamijenjen',
  },
  application: {
    named: (name) => `Aplikacija Enable Banking ${name}`,
    id: (applicationId) => `ID aplikacije ${applicationId}`,
    active: 'Aktivna, pa može povezati vaše banke.',
    problems: {
      sandbox: 'Ova je aplikacija u testnom okruženju, koje povezuje samo testne banke. Napravite je u produkcijskom okruženju.',
      'redirect-missing': (address) => `Aplikacija ne navodi ${address} kao adresu za povratak. Dodajte je u Control Panelu Enable Bankinga.`,
      'not-active': 'Još nije aktivna. U Control Panelu Enable Bankinga povežite svaki račun koji banke nude pa ponovno provjerite.',
    },
    check: 'Provjeri ponovno',
    replace: 'Zamijeni ključ',
    remove: 'Ukloni sinkronizaciju',
    removeCaption: 'Prekida svaku vezu s bankom i briše ključ u ovom pregledniku i na vašem Google računu.',
    removeTitle: 'Ukloniti sinkronizaciju s bankom?',
    removeDescription:
      'Kuna prekida svaku vezu s bankom u Enable Bankingu i briše vaš ključ u ovom pregledniku i na vašem Google računu. Da biste ponovno čitali banke, vratite ključ i ponovno povežite svaku banku.',
    removed: 'Sinkronizacija s bankom uklonjena',
    notRemoved: 'Nije uklonjeno',
  },
  pick: {
    title: 'Poveži banku',
    description: {
      personal: 'Banke koje Enable Banking navodi za Hrvatsku i koje primaju osobnu prijavu. Odaberite svoju, a ona traži vaše odobrenje i zatim vas vraća ovamo.',
      business: 'Banke koje Enable Banking navodi za Hrvatsku i koje primaju poslovnu prijavu. Odaberite svoju, a ona traži vaše odobrenje i zatim vas vraća ovamo.',
    },
    loading: 'Pitamo Enable Banking za popis banaka…',
    opening: 'Otvaramo odobrenje vaše banke…',
    failed: (reason) => `Popis banaka iz Enable Bankinga nije pročitan: ${reason}`,
    tryAgain: 'Pokušaj ponovno',
    none: {
      personal: 'Enable Banking za Hrvatsku ne navodi nijednu banku koja prima osobnu prijavu.',
      business: 'Enable Banking za Hrvatsku ne navodi nijednu banku koja prima poslovnu prijavu.',
    },
    betaCaption: 'Enable Banking još isprobava vezu s ovom bankom.',
    linked: (date) => `Povezano do ${date}, a ponovno povezivanje to zamjenjuje.`,
    cancel: 'Odustani',
  },
  walk: {
    next: 'Dalje',
    done: 'Gotovo',
    copy: (field) => `Kopiraj: ${field}`,
    copied: 'Kopirano',
    start: {
      title: 'Prije nego što počnete',
      subtitle: 'Kuna čita vaše banke preko vaše vlastite aplikacije Enable Banking. Postavljanje traje oko pola sata.',
      lines: [
        'Enable Banking je licencirana usluga koja uz vaše odobrenje čita vaše bankovne račune.',
        'Aplikaciju napravite jednom, u njegovu Control Panelu, i ondje povežete svaki račun. Time je u ograničenom načinu rada, pa čita samo te račune.',
        'Svaka banka traži dva odobrenja: jednom u Control Panelu i jednom kad je Kuna poveže.',
        'Ključ aplikacije ostaje u ovom pregledniku i na vašem Google računu, pa ga ima svaki uređaj koji se sinkronizira. Nitko drugi, ni autor Kune, nikad ga ne vidi.',
      ],
    },
    make: {
      title: 'Napravi aplikaciju',
      subtitle: 'Prijavite se na enablebanking.com svojom e-adresom i u Control Panelu otvorite API applications.',
      lines: [
        'Dodajte novu aplikaciju u produkcijskom okruženju i zadržite zadani ključ napravljen u pregledniku.',
        'Ispunite obrazac ovim vrijednostima. Pod e-adresu za zaštitu podataka upišite svoju.',
        'Registrirajte je. Preglednik preuzima datoteku .pem nazvanu po ID-u aplikacije. Ne stavljajte je u zajedničku mapu.',
      ],
      open: 'Otvori Enable Banking',
      fields: { name: 'Naziv', description: 'Opis', privacy: 'Adresa pravila privatnosti', terms: 'Adresa uvjeta korištenja', redirect: 'Adresa za povratak' },
      description: 'Osobni proračun, samo čitanje',
    },
    key: { title: 'Donesi njezin ključ', subtitle: 'Ispustite datoteku .pem ili je zalijepite. Provjeri njome potpisuje jedan poziv, a Kuna je čuva samo ako Enable Banking odgovori.' },
    activate: {
      title: 'Aktiviraj je',
      subtitle: 'U Control Panelu aktivirajte aplikaciju povezivanjem računa i odobrite svaki račun koji nude vaše banke. Zatim provjeravajte ponovno dok ne piše da je aktivna.',
      ready: 'Vaša je aplikacija spremna. Na sljedećem zaslonu povežite svaku banku.',
    },
  },
}

export const words = language === 'hr' ? hr : en
