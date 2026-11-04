# Owner benefit from mixed-use costs: the Croatian tax sources

Lane 2 of the owner-benefit research, 22 October 2026. Read-only. Code citations are against the HEAD copy (commit 7128551), paths relative to it. This is research for an analytics app, not tax advice. The owner should confirm the treatment with the company's accountant before the app shows any of it as settled.

## The short answer

The law has no "owner's share of a company cost" that simply moves from expenses to owner take. A private share of something the company paid for is one of three things, and each costs tax:

- **Salary in kind**, because the owner is employed by the company. The value is grossed up for contributions and income tax, and the employer pays health insurance on top. That is about 82 to 89 of extra payroll cost per 100 of private share, before the corporate tax saving.
- **Capital income** (a hidden profit distribution, _izuzimanje_), if the owner were a member without employment. The rate is 36% on the value grossed up by 1.5625, so 56.25 per 100.
- **Owed back**, the share the owner pays the company personally. The app already does this through a split to `private-cost-for-owner` or another `owner-loan-out` category. No tax arises, but it is not a take either.

In every case the company can deduct VAT only on the business share.

The owner's "it reduced capital gains taxes" holds only while nobody books the share. Getting 100 of value through a dividend uses 126.26 of pre-tax profit (10% corporate tax, then 12% dividend tax). Getting it as an untaxed company cost uses 100 and saves 10 of corporate tax. That difference is exactly what the law calls a hidden profit distribution. Once it is booked correctly, the route costs more tax than a dividend, not less.

## Which income tax treatment applies to the owner

The live export has bookings on `salary-net` and `payroll-contributions`, both carrying the `arrears` role, and no `scenarios` rows. So the owner is paid as an employee, and the README already treats the owner as one for the loan benefit (README.md:360). The rest of this note assumes the owner is employed. If a later year moves the owner to `board-only` (README.md:656), the capital income reading takes over.

### Employee: salary in kind

ZPDoh Art. 21(3), consolidated text on zakon.hr (base updated through NN 110/26):

> "Primicima u naravi smatraju se korištenje zgrada, prometnih sredstava, povoljnije kamate pri odobravanju kredita i druge pogodnosti koje poslodavci i isplatitelji primitka, odnosno plaće iz stavaka 1. i 2. ovoga članka daju radnicima..."

Pravilnik o porezu na dohodak (consolidated text NN 10/17 to 157/25), Art. 21(1) lists among them:

> "3. primici ostvareni u dobrima i uslugama bez naknade ili uz djelomičnu naknadu..."
> "5. svi drugi primici u svezi i po osnovi nesamostalnog rada koji se daju u naravi..."

Valuation, Pravilnik Art. 22(1):

> "Vrijednost primitaka u naravi utvrđuje se prema tržišnoj vrijednosti tih primitaka koja je važeća u mjestu davanja (s uključenim porezom na dodanu vrijednost)."

The gross-up, Pravilnik Art. 22(4):

> "...pri obračunavanju i plaćanju predujma poreza na dohodak tržišna vrijednost odnosno vrijednost primitaka u naravi uvećava se za doprinose za obvezna osiguranja iz primitka, porez na dohodak."

Art. 23(3) repeats it for the monthly advance. Zakon o doprinosima Art. 21(1) puts salary "isplaćuje ili daje u naravi" in the contribution base, and Art. 24(3) makes contributions on salary in kind due by the 15th of the following month.

The only fixed valuation rules are for buildings, garages, vehicles (1% of the purchase price a month, or 0.50 a km with a log), loans and gifts (Pravilnik Art. 22(3)). A laptop or an AI subscription falls under the general market-value rule. The owner's "30% of the price, what a second laptop would cost me" is the owner's own allocation key. It is a reasonable one, but the law does not name it.

Pravilnik Art. 22(3)(7) values gifts and free services only above 133.00 a year per worker:

> "pri davanju darova, usluga bez naknade i slično čija je pojedinačna vrijednost preko 133,00 eura po pojedinom radniku ... godišnje"

A secondary source (TEB, not loaded) reads this as a tax-free gift in kind up to 133.00. Whether the private share of a subscription counts as a "free service" under that threshold, and whether the threshold stacks with the occasional-award cap the app already models, is unconfirmed.

Porezna uprava opinion KLASA 410-01/14-01/987 of 26 May 2015 (porezna-uprava.gov.hr/Misljenja/Detaljno/2021, loaded) draws the line by employment, not ownership. It cites the old article numbers, 14(3) and 32(5), which are today's 21(3) and 39(3)(5):

> "ukoliko poslodavac omogući korištenje službenog automobila u privatne svrhe osobi koja je kod toga poslodavca osigurana po osnovi radnog odnosa ... takvo korištenje predstavlja dohodak od nesamostalnog rada ... a ukoliko isplatitelj omogući korištenje službenog automobila u privatne svrhe osobi koja kod toga poslodavca ne ostvaruje primitke od kojih se utvrđuje dohodak od nesamostalnog rada takvo korištenje predstavlja primitak od kojih se utvrđuje drugi dohodak."

The opinion is about a car. That it carries over to a laptop or a service is my reading. The RRiF article "Korištenje službenih vozila članova društva i članova uprave" (RRiF 11/2022) is paywalled. Its loaded summary says only that status decides between salary, other income "ili možebitno i dohodak od kapitala". Its full text is unconfirmed.

### Member without employment: capital income

ZPDoh Art. 66(1):

> "Izuzimanjima imovine i korištenjem usluga iz članka 64. stavka 1. ovoga Zakona smatraju se izuzimanja imovine i korištenje usluga od strane članova trgovačkih društava za njihove privatne potrebe (skrivene isplate dobiti) izvršeni tijekom poreznog razdoblja na teret dobiti tekućeg razdoblja..."

ZPDoh Art. 70(2) and 70(3):

> "...obračunavaju, obustavljaju i uplaćuju isplatitelji istodobno s isplatom primitka, kao porez po odbitku, po stopi od 36%."
> "...plaća se po odbitku na način propisan stavkom 2. ovoga članka, i to do trenutka podnošenja prijave poreza na dobit."

Pravilnik Art. 70(4) names exactly the owner's case:

> "Izuzimanjima iz članka 66. Zakona smatraju se i troškovi uporabe dobara u vlasništvu ili najmu društva i drugih povlastica koje se odnose na privatni život dioničara ili člana društva."

Pravilnik Art. 70(12) is the gross-up:

> "Primici od kapitala iz članka 64. Zakona koji su ostvareni u pravima, stvarima i uslugama koje imaju novčanu vrijednost, smatraju se primicima u naravi i pri obračunavanju i plaćanju poreza na dohodak vrijednost primitka u naravi (koji uključuje i možebitni porez na dodanu vrijednost) uvećava se za porez na dohodak."

So the tax is 36% of value / 0.64, which is 56.25% of the value. Informator (14.11.2024, loaded, secondary) works an audit example with the same coefficient: "bruto iznos izuzimanja = 73.058,60 € x 1,5625". Pravilnik Art. 70(7)(1) also counts "povoljniju kamatu" given to a member as a hidden distribution. Pravilnik Art. 70(17) says capital income in kind is paid under ZPDoh Art. 25(3), which is the 15th of the next month. That sits uneasily with Art. 70(3) of the act ("do trenutka podnošenja prijave poreza na dobit"). Which deadline the accountant uses is unconfirmed.

ZPDoh Art. 39(3)(5) and Pravilnik Art. 54 cover other income in kind for people who are neither employees nor members. They do not reach the owner.

Porezna uprava's own page "Dohodak od kapitala po osnovi izuzimanja imovine i korištenja usluga" (porezna-uprava.gov.hr/hr/.../4652, loaded) repeats Art. 66 and the 36% rate word for word.

## Corporate tax

ZPD Art. 5(6):

> "Rashodima poreznog razdoblja ne smatraju se rashodi koji nisu u svezi s obavljanjem djelatnosti poreznog obveznika niti su posljedica obavljanja djelatnosti."

ZPD Art. 7(1) increases the base, among others:

> "3. za 50% troškova reprezentacije ..."
> "4. za 30% troškova ... nastalih u svezi s vlastitim ili unajmljenim motornim vozilima ... ako se na osnovi korištenja sredstava za osobni prijevoz ne utvrđuje plaća (nakon 01.01.2018. za 50%)"
> "12. za rashode utvrđene u postupku nadzora s pripadajućim porezom na dodanu vrijednost, porezom na dohodak ... te obveznim doprinosima koji su nastali u svezi skrivenih isplata dobiti, te izuzimanja ... članova društva..."
> "13. za sve druge rashode koji nisu izravno u svezi s ostvarivanjem dobiti..."

ZPD Art. 7(2) is the key to the question "what if it is taxed as a benefit instead":

> "Za rashode iz stavka 1. ovoga članka, osim za rashode iz točke 9. i 12. toga stavka, ne povećava se porezna osnovica kada se sukladno Zakonu o porezu na dohodak obračunava i plaća porez na dohodak."

So a private share taxed as salary in kind, or as capital income at 36%, stays deductible. The tax and contributions paid on it are deductible too, as payroll or as a cost of the distribution (Informator: "Tako utvrđeni dohodak smatra se porezno dopustivim rashodom poslovanja", secondary). A private share nobody taxes is added back under point 13. If a tax audit finds it, point 12 adds back the cost with its VAT, income tax and contributions, and Art. 7(2) no longer saves it.

Pravilnik o porezu na dobit Art. 26.a(1) requires a record of these costs:

> "Porezni obveznik obvezan je sukladno članku 7. Zakona voditi evidenciju o troškovima učinjenim za privatne potrebe fizičkih osoba (skrivene isplate dobiti odnosno izuzimanja, te povlastice) koja osobito sadrži sljedeće podatke: nadnevak nastalih troškova, ime i prezime, adresa, te OIB osobe ..., vrsta troškova, te iznos nastalih troškova."

The rate is 10% below 1,000,000.00 of revenue (ZPD Art. 28(1)).

## VAT

ZPDV Art. 58(8):

> "Ako se radi o nekretninama ili drugim gospodarskim dobrima koja su dio poslovne imovine poreznog obveznika i koja se koriste i za potrebe poslovanja ... i za njegove privatne potrebe ili za privatne potrebe njegovih zaposlenika ..., PDV se može odbiti samo u dijelu koji se koristi u poslovne svrhe poreznog obveznika."

Art. 58(1) allows a deduction only "za potrebe njegovih oporezivih transakcija", which covers a service such as an AI subscription.

Private use as a deemed supply, where VAT was deducted in full, is ZPDV Art. 7(3) for goods and Art. 8(3) for services:

> "a) korištenje dobara koja čine dio poslovne imovine poreznog obveznika za njegove privatne potrebe ili privatne potrebe njegovih zaposlenika ..., za koja je u cijelosti ili djelomično odbijen pretporez,"
> "b) obavljanje usluga bez naknade od strane poreznog obveznika za njegove privatne potrebe ili privatne potrebe njegovih zaposlenika..."

The base is "ukupni trošak obavljanja usluga" (Art. 33(5)) or the purchase price (Art. 33(4)). Art. 8(5) exempts private use of a personal car whose VAT was already cut to 50% by Art. 61(2). Art. 61(1) bars any deduction on representation.

For the app this means 25% VAT on the private share comes back as a cost. For `equipment` (`deductible-25`) the company should not reclaim the private share's VAT. For `ai-services` (`reverse-charge`), the self-assessed VAT on the private share is payable with no matching deduction. Today `vatSplit` treats reverse charge as cancelling out in full (src/packs/hr-doo/domain/vat/vatSplit.ts:38-41) and deducts all VAT on `deductible-25` (vatSplit.ts:50-61).

## What the honest figure is, per 100 of private share

Worked per 100 of private share net of VAT, at a 10% corporate tax rate. Payroll uses a 20% lower local rate, with the personal allowance already used by the cash salary and pillar II on. Contribution rates are from `hr.contrib.rates` (src/packs/hr-doo/ruleset/rules/owner-pay.ts:442, 451-454). These figures are illustrative, not the owner's.

| How the share is treated                                           | Extra tax and contributions                                                                                    | Corporate tax                         | Net cost to the company beyond the 100 | What the owner gets                                      |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| Owed back: the owner pays it                                       | none                                                                                                           | share not deducted                    | 0, the 100 comes back                  | nothing, the owner paid for it                           |
| Untaxed, only re-labelled in the app                               | none                                                                                                           | 100 deducted, saves 10                | -10                                    | 100 of value, with the audit risk below                  |
| Salary in kind, rate 20%                                           | gross 156.25: contributions 31.25 (pillar II 7.81 of it), income tax 25.00, employer health 25.78. Total 82.03 | all of 182.03 deducted, saves 18.20   | 63.83                                  | 100 of value, plus 7.81 in pillar II and pillar I rights |
| Salary in kind, rate 23%                                           | 89.12                                                                                                          | saves 18.91                           | 70.21                                  | as above                                                 |
| Capital income at 36%, if not employed                             | 56.25                                                                                                          | deducted under Art. 7(2), saves 15.63 | 40.63                                  | 100 of value                                             |
| Non-deductible add-back only                                       | none paid, but the 36% or the payroll tax is still owed by law                                                 | 100 added back, 10                    | 10                                     | incomplete: it settles the corporate tax side only       |
| Untaxed and found in an audit (Informator's method)                | VAT 25.00 and 36% on 125 × 1.5625, which is 70.31                                                              | 195.31 added back, 19.53              | 114.84, before interest and fines      |                                                          |
| For comparison, a 113.64 dividend that the owner spends personally | 13.64 dividend tax                                                                                             | 126.26 of profit taxed at 10%, 12.63  | 26.26                                  | 100 of cash                                              |

VAT comes on top of every row except the owed-back and audit rows, which already include it: 25 per 100 of private share wherever the company reclaimed it.

### The readings of "capital gains taxes"

1. **Dividend tax, 12%** (ZPDoh Art. 70(19), `hr.pit.dividend`, owner-pay.ts:967). This is the likely meaning. The claim holds only for the untaxed row. Booked correctly, the share pays more than the 13.64 a dividend would.
2. **Corporate tax on the profit, 10%.** Moving the share to owner take in the app does not change the company's corporate tax. The accountant still books the whole cost, so it stays deducted. If the app instead took the share out of expenses, the app's tax base would rise by the share and stop matching the accountant's. The saving the owner senses is real only as long as the cost stays deducted and nobody taxes the benefit.
3. **The 36% capital income tax on hidden distributions.** This is the tax the move would trigger, not reduce.
4. **Capital gains in the strict sense** (ZPDoh Art. 67, gains on selling financial assets). These are not touched at all.

### What the app can honestly show

The cash total does stay the same when the share moves from operating cost to owner take. The owner is right about that, and it is a fair analytics view of "what the company money bought me". The tax figures may not follow along on their own. A share the app moves without the accountant booking it should read as "value received, not taxed", with the tax a correct booking would cost next to it: the salary-in-kind row above, since the owner is employed. The corporate tax, the PD build-up and the accrual bridge should keep the accountant's treatment, which is the whole cost deducted, until the accountant books the benefit. If the accountant does book it, the share becomes payroll: an `owner-pay` cost with its taxes on an `owner-pay-tax` category, which the app already handles.

Two further points:

- **Timing on assets.** A laptop above `hr.cit.asset-threshold` is depreciated (README.md:422-437, threshold at README.md:432). Its private share is a share of each year's use, not 30% of the price on the day of purchase. Taxing 30% of the price up front overstates the benefit in year one. Also, the split guard refuses any split of a payment an asset claims (README.md:397), so a per-transaction percentage on a capital purchase cannot reuse splits.
- **No `non-deductible` category exists today.** The live `categories` tab has no category with that role, so PD lines 9, 11 and 24 read zero from it (src/packs/hr-doo/domain/cit/taxBase.ts:79-86).

## How the app handles the loan benefit, and what the ruleset can carry

The loan benefit reads `hr.pit.loan-benefit` (owner-pay.ts:918-940), whose 2% rate quotes ZPDoh Art. 21(3) correctly. `loanBenefit` (src/packs/hr-doo/domain/ownerLoanInterest.ts:99-116) works out a value of benefit and shows it on Owner and Year, Accountant. It never computes the tax on it. The same shape fits here: the ruleset holds the rates, a domain function values the benefit, and the screens show the value with its build-up.

Most of the rates are already in the ruleset:

| Need                               | Existing rule                                                                                                           | Status                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Employee benefit in kind, gross-up | `hr.contrib.rates`, `hr.pit.local-rates`, `hr.pit.brackets` (used by `payrollMonth`)                                    | rates present. The gross-up has no term yet.                                                                      |
| Member's capital income            | `hr.pit.hidden-distribution` (owner-pay.ts:991-1012): 36%, withheld by the PD filing, `costDeductibleForCompany: false` | read by no domain code, only listed in `FORECAST_RULE_IDS` (src/packs/hr-doo/domain/forecast/forecastRules.ts:45) |
| Private cost add-back              | `hr.cit.private-cost-add-back` (profit-tax.ts:512-528), `noAddBackWhenIncomeTaxPaid: true`                              | used by `taxBase`                                                                                                 |
| Car and representation 50%         | `hr.cit.personal-transport-add-back` (profit-tax.ts:323-340), `hr.cit.representation-add-back` (profit-tax.ts:286-302)  | used                                                                                                              |
| VAT on mixed use                   | `hr.vat.input-deduction`, `mixedUseDeductibleForBusinessShareOnly: true` (vat.ts:208)                                   | the flag exists but no code reads it                                                                              |

Three corrections the sources support:

1. `hr.pit.loan-benefit` note (owner-pay.ts:938) and README.md:372 say the gross-up is unconfirmed. Pravilnik Art. 22(3)(6) values the cheap-loan benefit, and Art. 22(4) and 23(3) gross every benefit in kind up for contributions and income tax. It is confirmed for employees.
2. `hr.pit.hidden-distribution` note (owner-pay.ts:1010) says whether the 36% is on top is unconfirmed. Pravilnik Art. 70(12) settles it: on top, a factor of 1.5625.
3. The same rule's `costDeductibleForCompany: false` (owner-pay.ts:1002) contradicts ZPD Art. 7(2) and the ruleset's own `noAddBackWhenIncomeTaxPaid: true` (profit-tax.ts:522). The cost is non-deductible only when the 36% is not paid. A term such as `deductibleWhenTaxPaid: true` would state it.

Missing terms if the wave computes the tax: a benefit-in-kind rule (`hr.pit.benefit-in-kind`) with market-value valuation, the gross-up flag, the 133.00 gift-and-service threshold and the vehicle percentages. Also a VAT deemed-supply term with its base (ZPDV Art. 8(3), 33(5)). All of them fit the existing schema of rates, money and flags.

## Existing concepts, seen through the law

- **Split to an `owner-loan-out` category** (README.md:337-346, live slug `private-cost-for-owner`). This is the "owed back" row. It is the correct concept when the owner repays the share. It is a loan, not a take, and it starts the 2% loan benefit while it stays unpaid.
- **The `non-deductible` role** (README.md:296, src/packs/hr-doo/domain/packRoles.ts:26). This covers the corporate tax side of an untaxed private cost and nothing else. Reusing it for the owner's share would be right only if the owner wants the app to model "the accountant adds it back and nobody pays income tax", which the law does not allow on its own.
- **The `reimbursement` role.** This covers money moving between the owner and the company. It does not apply to the value of use.
- **Owner advances.** These go the opposite way, owner to company, so they do not apply.
- **The asset register.** A mixed-use asset's private share belongs to its yearly depreciation and running costs. That argues for a percentage on the category or the asset rather than on the payment row.
- **Salary bucket and `owner-pay-tax`.** This is where a booked benefit in kind ends up once the accountant runs it through payroll.

## Questions for the owner

1. Do you want the app to show the share as "value received, not taxed", with the tax a correct booking would cost beside it? Or should it assume the accountant books it as salary in kind and compute that payroll cost?
2. Has your accountant ever booked a private share, for the laptop, the phone or the AI subscriptions, as salary in kind, as `izuzimanje`, or as a non-deductible cost? The app's corporate tax should follow whatever is actually booked.
3. Did the company reclaim the full VAT on the laptops and the reverse-charged AI services? If so, the private share carries 25% VAT the app does not show today.
4. For assets, should the percentage apply to each year's depreciation, as the law values use, or to the price on the day you bought it?

## Sources

| Source                                                                                             | Where                                                                                              | Loaded                                                |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Zakon o porezu na dohodak, consolidated, Art. 21, 25, 39, 64, 66, 67, 69, 70                       | zakon.hr/z/85/zakon-o-porezu-na-dohodak, base through NN 110/26                                    | yes, 22.10.2026                                       |
| Pravilnik o porezu na dohodak, consolidated NN 10/17 to 157/25, Art. 7, 21, 22, 23, 54, 55, 70, 71 | zakon.hr/cms.htm?id=60043                                                                          | yes                                                   |
| Zakon o porezu na dobit, consolidated, Art. 5, 7, 28                                               | zakon.hr/z/99/zakon-o-porezu-na-dobit                                                              | yes                                                   |
| Pravilnik o porezu na dobit, consolidated to NN 39/26, Art. 25, 26.a, 31                           | zakon.hr/cms.htm?id=60061                                                                          | yes                                                   |
| Zakon o PDV-u, consolidated, Art. 7, 8, 33, 57, 58, 61                                             | zakon.hr/z/1455/zakon-o-porezu-na-dodanu-vrijednost                                                | yes                                                   |
| Zakon o doprinosima, Art. 21, 24                                                                   | zakon.hr/z/365/Zakon-o-doprinosima                                                                 | yes                                                   |
| Porezna uprava opinion 410-01/14-01/987, 26.05.2015, private use of a company car                  | porezna-uprava.gov.hr/Misljenja/Detaljno/2021                                                      | yes                                                   |
| Porezna uprava, "Dohodak od kapitala po osnovi izuzimanja imovine i korištenja usluga"             | porezna-uprava.gov.hr/hr/dohodak-od-kapitala-po-osnovi-izuzimanja-imovine-i-koristenja-usluga/4652 | yes                                                   |
| Informator, "Izuzimanja ili skrivene isplate dobiti s poreznog gledišta", 14.11.2024 (secondary)   | informator.hr/strucni-clanci/izuzimanja-ili-skrivene-isplate-dobiti-s-poreznog-gledista            | yes, the passages quoted above                        |
| RRiF 11/2022, "Korištenje službenih vozila članova društva i članova uprave"                       | rrif.hr/clanak-22055/                                                                              | summary only. The full text is unconfirmed (paywall). |
| TEB, gift in kind up to 133.00 tax free                                                            | teb.hr/novosti/2023/neoporezivi-primici-naknade-nagrade-i-stipendije/                              | unconfirmed, search snippet only                      |
| Pravilnik o PDV-u Art. 42(4), purchase price of private use                                        | cited by Informator only                                                                           | unconfirmed                                           |
