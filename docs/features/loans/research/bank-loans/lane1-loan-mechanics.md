# H3 lane 1: loan mechanics and Croatian law

How annuity, linear, interest-only and bullet loans are computed in Croatian banks, how the APN housing subsidy, rate changes and early repayment work under the current laws, what applies to informal loans between people, and the fields the Loans app needs to reproduce a bank schedule to the cent.

Background: the H3 row and the open question "Which loans" in [the hub proposal](../../../../architecture/hub.md), and the loan records sketched in [lane 3 of the hub research](../../../../architecture/research/hub-lane3-apps.md). This lane covers how loans work. The owner's own data, the codebase and how other tools present loans belong to the other H3 lanes.

Every law below was loaded from zakon.hr (consolidated text) or narodne-novine.nn.hr, and every bank rule from the bank's own PDF. Anything I could not load is marked **unconfirmed**. Article numbers are quoted as the law prints them.

## The findings that change the model

- **A bank schedule is reproducible to the cent with three rules.** Monthly rate = nominal / 12, the instalment is the annuity rounded to cents, each month's interest is the balance times the monthly rate rounded half up, and the last instalment takes whatever principal is left. With these rules I reproduced HPB's published APN example exactly: 431,37 a month, 433,57 for the last one and 55.295,40 total interest.
- **Day count differs by phase, not by bank whim.** Equal-annuity instalments use 30/360 (one month = rate / 12). Interim interest (interkalarna kamata), linear and bullet loans use actual days. The app needs one day-count setting for instalments and another for interim and irregular periods.
- **Housing loans have no early repayment fee at all.** Zakon o stambenom potrošačkom kreditiranju, članak 26 stavak 2, bans it for fixed and variable rates alike. The 1 % and 0,5 % caps apply only to non-housing consumer loans. The model needs no fee field for a housing loan.
- **The APN subsidy is a fixed euro amount set once.** The state pays a share (30 % to 51 %) of the monthly annuity for five years, the APN decision fixes the amount, and the subsidy settles interest first. That is why the owner's schedule shows a constant amount. The model stores it as a monthly amount over a counted number of instalments, plus extensions.
- **NRS is still published, but new housing contracts can no longer use it.** Since 1 January 2023 the law lists only EURIBOR, SARON, SOFR or a successor as the variable-rate parameter. A variable period stores an index name, a margin that may never rise and the rate the bank actually applied. The app should not try to derive the applied rate from the index.
- **A new consumer credit law starts on 20 November 2026 and does not touch existing loans.** Zakon o potrošačkim kreditima (NN 86/26), članak 109, keeps contracts signed earlier under the law in force when they were signed. The owner's loan stays under the 2017 housing law.
- **Informal loans need an event list, not a schedule.** A balance made of advances, cash repayments, repayments in kind and forgiveness covers every case the civil code allows. Interest between private people is optional, capped and taxable as capital income at 12 %. Interest-free loans have no tax angle that I could find in the income tax act.
- **Housing interest relief does not exist today.** It existed from 2005 to mid-2010 and was deleted by NN 80/10.

## 1. Repayment types

| Type                                   | Instalment rule                                                                                     | 100.000 EUR, 3,18 %, 360 months                                                                       | Banks                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Annuity (French)                       | Fixed instalment `A = P·r / (1 − (1 + r)^−n)`, `r` = nominal / 12. Interest falls, principal rises. | A = 431,37. Month 1: 265,00 interest + 166,37 principal. Month 360: 433,57. Total interest 55.295,40. | The standard for housing. HPB states "Otplata kredita moguća je samo u jednakim mjesečnim anuitetima".                                                                                       |
| Linear (jednake rate, obročna otplata) | Fixed principal `P / n`, interest on the falling balance.                                           | Principal 277,78. Month 1: 542,78. Month 360: 277,71. Total interest 47.832,12.                       | In bank interest rulebooks (RBA, Kentbank) as "obročna otplata". I found no Croatian housing product sheet that offers it.                                                                   |
| Interest-only, then annuity (poček)    | Interest only for `g` months, then an annuity over `n − g` months on the full principal.            | 12 months of 265,00, then 440,29 for 348 months. Total interest 56.402,99.                            | RBA rulebook: "Banka mjesečno obračunava kamatu počeka/moratorija, a naplata kamate može biti mjesečna ili se kamata može naplatiti istekom počeka/moratorija."                              |
| Grace with capitalised interest        | Unpaid interest is added to principal, then annuity.                                                | Balance after 12 months 103.226,76, then 454,50. Total interest 58.166,28.                            | Not seen in any Croatian housing document. RBA allows interest to be collected at the end of the grace period, which is not the same as adding it to principal. **Unconfirmed** for housing. |
| Bullet (jednokratna otplata)           | Interest monthly or at the end, all principal at maturity.                                          | Informal example: 5.000 EUR for 730 days at 2 % actual/365 = 200,00 interest at the end.              | RBA rulebook: "kredit ugovoren s jednokratnom otplatom glavnice", interest monthly by actual days.                                                                                           |
| Balloon (poseban obrok)                | Annuity on part of the principal, one large instalment at the end.                                  | Not modelled.                                                                                         | RBA rulebook: "krediti ugovoreni uz poseban obrok (tzv. baloon otplata ili dinamička otplata)".                                                                                              |

What the app stores to reproduce these: principal, term in months, first instalment date, method, grace months and whether grace interest is paid or capitalised, the nominal rate per period and the rounding rule below.

Sources: [HPB general housing loan information, 2024](https://hpb.hr/UserDocsImages/krediti/2024/Op%C4%87e%20informacije%20o%20stambenom%20potro%C5%A1a%C4%8Dkom%20kreditu.pdf?vel=104092), [RBA Pravilnik o obračunu kamata i naknada, applied from 10.04.2025](https://www.rba.hr/documents/20182/24371/Pravilnik+o+obra%C4%8Dunu+kamata+i+naknada), [Kentbank Pravilnik o obračunu kamata za potrošače, August 2023](https://kentbank.hr/18031/pravilnik-o-obracunu-kamata-za-potrosace).

## 2. Interest mechanics

### Nominal rate and EKS

The nominal yearly rate (godišnja kamatna stopa) drives the schedule. EKS (efektivna kamatna stopa) is a comparison figure. Zakon o stambenom potrošačkom kreditiranju, članak 17 stavak 1, defines it as the rate that "izjednačuje na godišnjoj osnovi sadašnju vrijednost svih budućih ili postojećih obveza (povlačenja tranše, otplata i naknada)". Stavak 2 includes interest, fees, mandatory insurance premiums, the valuation and the account and payment costs. Stavak 6 caps EKS at the statutory default rate. HNB's decision sets the exact method.

HPB's APN example has nominal 3,18 % and EKS 3,30 %. I reproduced 3,30 % by discounting the interkalarna (265,00), the 360 instalments, 33,18 EUR yearly property insurance and 10,62 EUR in payment-order costs with time measured in months / 12. That confirms the method, but EKS depends on assumptions the bank does not publish in full. **The app should store EKS as the number the bank printed and never compute it.**

### Monthly rate and day count

| Bank     | Equal annuities                                                             | Linear, bullet          | Interim interest (interkalarna)                                                                     | Source                                                                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HPB      | nominal / 12 (reproduced exactly)                                           | not offered for housing | the 1.1 to 1.2 example is 265,00 = one month at 30/360                                              | [HPB APN conditions, 03/2023](https://www.hpb.hr/UserDocsImages/krediti/APN/Uvjeti%20o%20stambenom%20potro%C5%A1a%C4%8Dkom%20kreditu%20na%20temelju%20Zakona%20o%20subvencioniranju%20stambenih%20kredita_03_2023.pdf) |
| RBA      | 30/360, "primjenjuje se obvezno kod otplate u jednakim anuitetima"          | actual/actual           | actual/actual, "u pravilu se naplaćuje prilikom isplate kredita, i to ustezanjem od iznosa kredita" | RBA rulebook, 10.04.2025                                                                                                                                                                                               |
| Kentbank | 30/360, "za kredite s otplatom u anuitetima, za mjesec 30, a za godinu 360" | actual/365 or 366       | actual/365 or 366                                                                                   | Kentbank rulebook, 08/2023                                                                                                                                                                                             |
| OTP      | rulebook download blocked                                                   |                         |                                                                                                     | **Unconfirmed**                                                                                                                                                                                                        |

All three banks use the decursive proportional method ("dekurzivne metode i proporcionalnog kamatnjaka" in HPB's words), meaning simple interest per period on the opening balance, paid at the end of the period. The conformal method (compounding inside the year) appears only for deposits. RBA counts days from the value date to one day before payment. Kentbank leaves out the first day and counts the last.

Worked comparison on 100.000 EUR at 3,18 % for a 31-day month: 30/360 gives 265,00, actual/360 gives 273,83 and actual/365 gives 270,08. A wrong day-count setting is off by up to 8,83 EUR in one month.

### Rounding and how the schedule closes

Reproduction of the HPB example:

1. Annuity `A` from the formula, rounded to cents: 431,37.
2. Each month: interest = round_half_up(balance × rate / 12), principal = A − interest.
3. Last month: principal = the remaining balance, instalment = that plus its interest: 432,42 + 1,15 = 433,57.

That gives total interest 55.295,40, the figure HPB prints. The bank keeps the schedule summing to the principal by letting the last instalment absorb the rounding. The model needs the rounding rule as a fixed convention, not a field, until a bank turns up that does it differently.

## 3. Interkalarna kamata

Interim interest covers the days between drawdown and the date the loan enters repayment ("od početka korištenja do stavljanja kredita u otplatu", HPB). It is charged on the drawn amount at the regular rate. With several tranches, HPB charges it monthly on what has been drawn so far. Billing differs: HPB's example draws on 1.1 and collects interkalarna on 1.2. RBA deducts it from the payout.

Worked example: 100.000 EUR drawn on 17 March, repayment starts 1 April with the first instalment on 1 May. 15 days at 3,18 % is 132,50 on actual/360 or 130,68 on actual/365 (Kentbank, RBA in a non-leap year).

What the app stores: drawdown date and amount, the date repayment starts, the interim day-count basis and the amount actually charged. The last one matters most. It is a one-off cost that the bank already computed, so the app can record it rather than recompute it.

## 4. Fixed, variable and mixed rates

### The rules

Zakon o stambenom potrošačkom kreditiranju, članak 24 (as amended by NN 128/22, in force from the euro changeover on 1 January 2023):

- Stavak 2: the parameter "je jedna od sljedećih varijabli: EURIBOR, SARON, SOFR, varijabla određena kao zamjenska za neku od tih varijabli ili druga varijabla u skladu sa zahtjevima iz Uredbe (EU) 2016/1011". The rate is the parameter plus a fixed margin "koja ne smije rasti tijekom otplate kredita".
- Stavak 3: a change in one reference period cannot exceed the parameter's change in percentage points.
- The original 2017 text (NN 101/17) also allowed LIBOR, NRS, Treasury bill yields and the average household deposit rate. Those were removed for new contracts.

Članak 27 stavak 1: the bank must notify a rate change at least 15 days before it applies, with an explanation, the new repayment plan and the number and amount of instalments. Stavak 2: if it fails to notify an increase in time, the increase moves to the next accounting period.

### NRS

HNB has computed NRS since the 31 March 2020 reporting date (HUB did it before). It is the average cost of funds of Croatian banks, published quarterly in three scopes, each for 3M, 6M and 12M:

- NRS1: funds from households (EUR).
- NRS2: households and non-financial companies (EUR).
- NRS3: all funds, including the financial sector (EUR and USD).

Second quarter 2026, euro: 6M NRS1 0,33 %, 6M NRS2 0,44 %, 6M NRS3 0,79 % ([HNB NRS page](https://www.hnb.hr/nrs), updated 28.8.2026, and the [methodology](https://www.hnb.hr/documents/20182/3308346/h-nrs-metodologija_aktualna.pdf/aee49e6c-0cb9-7d83-20f6-e413741cb4a2?t=1766566835343)). Erste's methodology says kuna-NRS contracts moved to the euro NRS of the same scope and term at the changeover. An older NRS-linked loan therefore still exists and still resets. A new one cannot be signed.

### Reset dates and the recomputation

Reset calendars come from each bank's methodology, not from law:

- HPB (APN 2023 offer): 6M EURIBOR, reset "šestomjesečno, nakon 1. 1. i 1. 7.", using the fixing of 20.5 for 1.7 and of 20.11 for 1.1.
- Erste: every 1.1 and 1.7, using the parameter of 1.6 and 1.12 ([Erste methodology, 2022](https://cdn0.erstegroup.com/content/dam/hr/ebc/www_erstebank_hr/misc/opci-uvjeti-poslovanja/gradjani/2652022-metodologija-utvrdivanja-promjene-kamatnih-stopa-na-kredite-u-primjeni-od-1062022.pdf)).
- RBA: the parameter is read two working days before the end of the second month before the accounting period.

After a change the bank keeps the term and recomputes the annuity on the remaining principal. HPB describes the effect as a change in the "mjesečne vrijednosti anuiteta". No source I loaded says a bank lengthens the term instead, but članak 27 allows for it ("ako se promijeni broj ili učestalost obroka").

Worked example: HPB's APN loan after 60 instalments has 89.195,88 left and 300 months to go. If 6M EURIBOR + 0,90 gives 3,00 %, the new annuity is 422,98. At 3,50 % it is 446,54.

### Fixed for N years, then variable

HPB's APN offer: "3,18% godišnja, FIKSNA za prvih 5 godina otplate, za preostali period otplate kredita kamatna stopa je promjenjiva i iznosi 6M EURIBOR + fiksni dio kamatne stope 0,90 p.p." Its representative example assumes the variable rate equals today's 6M EURIBOR (2,28 %) plus 0,90, so it shows 3,18 % for both periods. RBA's 2023 APN offer was reported as fixed 2,80 % for the subsidy period plus two years, then 3,50 % fixed (press, not the bank's page, **unconfirmed**).

The APN law also caps the rate. Zakon o subvencioniranju stambenih kredita, članak 11 stavak 2: EKS "prvih pet godina njegove otplate ne može biti viša od 3,75 % godišnje". Stavak 3: for the next two years it may rise by at most 10 % of the first-period EKS (3,30 % may become at most 3,63 %).

What the app stores per rate period: start (date or instalment number), type, the fixed rate or the index name plus margin, the reset months, and the rate the bank applied at each reset, entered from the bank's notice.

## 5. Early repayment (prijevremena otplata)

| Loan                                                   | Law                                                                               | Fee                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Housing consumer loan, signed 20.10.2017 to 19.11.2026 | Zakon o stambenom potrošačkom kreditiranju (NN 101/17, 128/22, 156/23), članak 26 | None. Stavak 2: "Kreditna institucija ne smije potrošaču naplatiti naknadu za prijevremeno, djelomično ili u cijelosti, ispunjenje svoje obveze". This was already in the 2017 text.                                                                            |
| Other consumer loan, signed before 20.11.2026          | Zakon o potrošačkom kreditiranju (NN 75/09 to 156/23), članak 16                  | Only while a fixed rate applies. At most 1 % of the repaid amount if more than a year remains, 0,5 % if less. Only if more than 10.000 EUR is repaid within 12 months. Never more than the interest that would have been paid. None for variable-rate periods.  |
| Any consumer loan signed from 20.11.2026               | Zakon o potrošačkim kreditima (NN 86/26), članci 50 and 51                        | Same caps as above for non-housing loans, but the fee applies only to the part above 10.000 EUR (članak 50 stavak 5). Housing loans: none (članak 51 stavak 2).                                                                                                 |
| Private loan between people                            | Zakon o obveznim odnosima, članci 25 and 507                                      | The borrower may repay early, but "dužan je obavijestiti zajmodavca unaprijed o svojoj namjeri i naknaditi mu štetu", unless agreed otherwise (članak 507). An interest discount for early payment applies only if the contract allows it (članak 25 stavak 3). |

Notice: članak 26 stavak 3 of the housing law requires a written request, after which the bank must send "bez odgode" the quantified consequences. HPB asks for the written request before the payment.

Shorter term or lower instalment: the law gives the right to repay and to the cost reduction. The choice of effect is in the bank's terms. HPB: the borrower may ask for "umanjenje mjesečnog otplatnog anuiteta razmjerno s njegovim novonastalim dugom stambenog kredita uz neizmijenjen rok otplate kredita ili skraćivanje razdoblja otplate kredita uz neizmijenjenu visinu mjesečnog anuiteta".

Worked example on HPB's loan: 10.000 EUR repaid after instalment 60 leaves 79.195,88.

- Lower instalment, same 300 months: 383,01 a month, interest left 35.708,11.
- Same 431,37, shorter term: paid off in 252 months instead of 300, interest left 29.447,88.
- Without the prepayment the interest left would be 40.217,32.

What the app stores per extra payment: date, amount, effect. The fee is always zero for a housing loan, so a fee field is only needed for a non-housing bank loan.

Zakon o stambenom potrošačkom kreditiranju, članak 12 stavak 2, also gives the owner a free report at any time with the schedule, EKS, "ukupno plaćenoj glavnici, kamatama i troškovima, specifikaciju uplata i pregled promjena kamatnih stopa". That report is the reference to reconcile the app against after a prepayment or a rate change.

## 6. APN subsidy

### The law and its rounds

Zakon o subvencioniranju stambenih kredita, NN 65/17, amended by NN 61/18, 66/19 and 146/20 ([zakon.hr consolidated text](https://www.zakon.hr/z/925/Zakon-o-subvencioniranju-stambenih-kredita), [NN 65/17](https://narodne-novine.nn.hr/clanci/sluzbeni/2017_07_65_1493.html), [NN 61/18](https://narodne-novine.nn.hr/clanci/sluzbeni/2018_07_61_1268.html), [NN 66/19](https://narodne-novine.nn.hr/clanci/sluzbeni/2019_07_66_1294.html)).

| Version                                | Share paid by the state                                                                   | Years | Children                                                                      | Disability           |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------- | -------------------- |
| NN 65/17 (2017 round)                  | "polovica mjesečnih obroka ili anuiteta"                                                  | 4     | +2 years per child born or adopted during the subsidy                         | +1 year              |
| NN 61/18 onwards (2018 to 2023 rounds) | 51 % to 30 % by the development-index group of the town on the day the call was published | 5     | +2 years per child born or adopted during the subsidy (članak 13 stavak 2)    | +2 years (članak 12) |
| NN 66/19 onwards                       | as above                                                                                  | 5     | also +1 year per child under 18 already in the household (članak 13 stavak 1) | +2 years             |

The calls ran "jednom godišnje, osim 2020. godine kada su objavljena dva javna poziva" and "Program se provodio do 2023. godine", with 32.175 borrowers in total ([APN, O programu](https://apn.hr/subvencionirani-krediti/o-programu/)). Članak 1 stavak 2 allowed calls "do 31. prosinca 2023." There is no newer round. Limits: loan up to 100.000 EUR subsidised, term at least 15 years (članak 9), price up to 1.500 EUR per m² (članak 8), applicant up to 45 (članak 7). The part above 100.000 EUR is not subsidised.

### Why the amount is a fixed euro figure

Three provisions together produce a constant monthly amount:

1. Članak 11 stavak 1: the state pays "dio mjesečnih obroka ili anuiteta" for the first five years, as a percentage.
2. Članak 16 stavak 1: the bank's decision "mora sadržavati ukupni iznos kredita i plan otplate kredita". Članak 17 stavak 3: the APN decision "sadrži obvezno iznos koji se subvencionira i dinamiku njegove isplate". The Naputak (NN 76/17), članak 6, makes the bank show "iznos mjesečnih obroka koji se subvencioniraju" separately for the 100.000 EUR cap when the loan is bigger.
3. In practice the rate is fixed for those five years (HPB's offer), so the annuity, and the share of it, never move.

So subsidy = share × the annuity of the subsidised part, from the plan at the time of the decision. Example on HPB's 100.000 EUR plan: 30 % of 431,37 = 129,41, 39 % = 168,23, 51 % = 220,00. I have not reverse-engineered the owner's subsidy amount because I did not read the owner's data.

### How it is applied, and what the schedule shows

Članak 14 stavak 1: APN pays the bank the whole calendar year in advance, within eight days of the first instalment of the year. Stavak 2: "Kamata subvencioniranog kredita isplaćena sredstvima na način iz stavka 1. ovoga članka smatra se konačnim zaduženjem za kamatu po kreditu za navedeno razdoblje." The subsidy settles interest. That matches the owner's schedule: interest, then "interest with APN" lower by the subsidy, and a monthly APN obligation of the same amount. The borrower's own part of the instalment is annuity minus subsidy, and principal amortises exactly as in the unsubsidised plan.

Example at 30 %: month 1 interest 265,00, interest with APN 135,59, the borrower pays 301,96 of 431,37. At month 60 the interest with APN is 107,47.

A gotcha: with a 15-year term and a top-band share the subsidy can exceed the month's interest (100.000 EUR at 3 % over 180 months gives an annuity of 690,58, 51 % of it is 352,20, against 250,00 interest in month 1). How the bank books the excess, presumably against principal, is **unconfirmed**. The model should not assume subsidy ≤ interest.

### Extensions, sale and early repayment

- A child born or adopted during the subsidy adds two years. The request goes through the bank to APN "u roku od 60 dana od rođenja djeteta" (članak 25 stavak 1, [APN, Produženje subvencije](https://apn.hr/subvencionirani-krediti/produzenje-subvencije/)). An annex to the contract follows (članak 27). The extension amount is in APN's decision (članak 26 stavak 2). Whether it is the same monthly euro amount after year five, when the rate may have changed, is **unconfirmed**.
- Članak 24 stavak 1: if the borrower stops repaying, the loan is declared due, or the property is sold during repayment, the bank returns the subsidy paid to APN within a month. Stavak 2: not if the loan is declared due more than two years after the subsidy ends, or the property is sold to buy or build a bigger home. APN adds that the purchase and sale must fall within six months of each other ([APN, Obustava subvencije](https://apn.hr/subvencionirani-krediti/obustava-subvencije/)).
- Članak 22: no renting out and residence registered at the address until two years after the subsidy ends.
- Voluntary early repayment, partial or full, is not mentioned in the law. HPB's APN conditions allow it "bez naplate naknade". Whether a partial prepayment keeps the subsidy amount, and whether full repayment during the subsidy period forfeits the rest or triggers a return, is **unconfirmed**. The owner's bank can answer it.

What the app stores: the subsidy's monthly amount, the first instalment it covers, the number of instalments covered (60 plus extensions) and the extension events (date, months added, reason). The figures show the subsidy separately: what the bank charges, what APN pays and what the owner pays.

## 7. Informal loans between people

### Civil law

Zakon o obveznim odnosima ([zakon.hr](https://www.zakon.hr/z/75/Zakon-o-obveznim-odnosima)) covers every case on the list, with no form requirement in the zajam articles:

- **Interest is optional.** Članak 500 stavak 1: "Zajmoprimac se može obvezati da uz glavnicu duguje i kamate." Between private people there is no interest unless agreed.
- **Interest is capped.** Članak 26 stavak 1: between persons of whom at least one is not a trader, the rate may not exceed the statutory default rate on the day of the contract "uvećane za polovinu te stope". Stavak 3: interest agreed without a rate means a quarter of the default rate. The default rate for non-trader relations is the ECB main refinancing rate plus three points, reset each half year (članak 29 stavak 2). I did not load the current NN notice, so no figure here.
- **No due date.** Članak 504: the borrower must repay "nakon isteka primjerenog roka koji ne može biti kraći od dva mjeseca računajući od zajmodavčeva zahtjeva".
- **Repayments at any time.** Članak 507, quoted above. For an interest-free loan between friends there is rarely any damage to compensate.
- **Repayment in kind.** Članak 167: the debt ends "ako vjerovnik u sporazumu s dužnikom primi nešto drugo umjesto onoga što mu se duguje". When the borrower pays a bill for the lender, the lender owes that amount back, and the two debts cancel by set-off (prijeboj) once either side declares it (članci 195 and 196). Either way the balance falls by the agreed value.
- **Order of crediting.** Članak 172: "prvo se namiruju troškovi, zatim kamate i napokon glavnica." Only relevant if interest was agreed.
- **Forgiveness.** Članak 203: the debt ends when the lender says so and the borrower agrees.
- **Borrowing back** is a new advance in the same relationship. With several open loans to one person, članak 171 lets the debtor choose which one a payment settles, otherwise the oldest due first.

Worked example: the owner borrows 3.000 EUR from a friend. The owner repays 500 EUR by transfer, pays the friend's 80 EUR concert ticket and agrees it counts, then borrows 300 EUR more. Balance owed: 3.000 − 500 − 80 + 300 = 2.720 EUR.

The consumer credit laws do not apply. Zakon o potrošačkim kreditima, članak 11 točka 55, defines the creditor as "pravna osoba koja u okviru svoje trgovačke, poslovne ili profesionalne djelatnosti nudi ili odobrava potrošaču kredit".

### Tax

- **Interest received is taxed.** Zakon o porezu na dohodak ([zakon.hr](https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak)), članak 64 and članak 65 stavak 1 točka 3: "primici od kamata po osnovi danih zajmova" are capital income. Članak 70 stavak 1: the payer withholds 12 %. Porezna uprava confirms: "Obveznik obračuna, obustave i uplate predujma poreza je isplatitelj kamata" ([Primatelj kamata](https://porezna-uprava.gov.hr/hr/primatelj-kamata/4471)). How a private person who pays interest to another private person withholds and reports it (JOPPD or otherwise) is **unconfirmed**. I found no Porezna uprava page on that case.
- **No deemed interest between private people.** The current act mentions zajam only in članak 65 and in the business-income rules for the self-employed. I found no rule that imputes interest on an interest-free loan between two private individuals. Rules for loans from employers and companies exist in secondary sources but belong to H5 and were not checked.
- **Forgiving a loan may be a taxable gift.** My reading, **unconfirmed by Porezna uprava**: Zakon o lokalnim porezima ([zakon.hr](https://www.zakon.hr/z/875/zakon-o-lokalnim-porezima)), članak 4 stavak 1, taxes gifts of "gotov novac, novčane tražbine i vrijednosne papire" at 4 % (članak 8), and članak 5 covers anything acquired "bez naknade". A forgiven balance looks like such a gift. Članak 9 exempts the spouse, children, parents and the rest of the direct line, and adoptive relations. Siblings and friends are not exempt. The 6.700 EUR threshold in članak 4 applies to movables, not to money. Porezna uprava's own summary reads the same way ([Nasljednik i daroprimatelj gotovine](https://porezna-uprava.gov.hr/hr/nasljednik-i-daroprimatelj-gotovine-novcane-trazbine-vrijednosnog-papira-i-pokretnine/4445)).
- **Reporting thresholds.** None that I found for a private loan itself. I did not check the anti-money-laundering cash rules.

Plainly: for an interest-free loan to or from a friend that is repaid, nothing in tax law applies. Interest makes the lender's income taxable at 12 %. Forgiveness to anyone outside the direct line may cost the borrower 4 %.

## 8. Fees and insurance that ride with a housing loan

- **Processing fee: banned.** Zakon o stambenom potrošačkom kreditiranju, članak 17 stavak 4: "Kreditna institucija ne smije potrošaču naplatiti naknadu za obradu i/ili odobravanje stambenog potrošačkog kredita." Other fees may not exceed the bank's actual cost. After signing, the bank "ne smije uvoditi nove naknade niti smije povećati naknade".
- **Insurance: may be required, from any insurer.** Članak 11 stavak 1 bans tying (praksa vezanja). Stavak 2 lets the bank require a policy and obliges it to accept an equivalent policy from another insurer. HPB requires property insurance against fire and other perils (average 33,18 EUR a year). Credit protection insurance (CPI) is optional and lowers the rate by 0,30 points (3,65 % instead of 3,95 % in the 2024 sheet) for a one-off 4,6682 % of the loan, paid at drawdown.
- **Account and payment costs** count in EKS (članak 17 stavak 2 točka 3). HPB's example has 10,62 EUR in payment-order costs over 30 years.
- **Conditional rates.** HPB's rates depend on whether the salary is paid into an HPB account ("Klijent") and on CPI. Losing the condition may change the rate. The exact contractual effect is **unconfirmed** and contract-specific.

Recommendation: premiums and fees belong in personal spending with their own category, not in the loan. The loan holds three things only: the EKS as printed, a one-off premium financed from the loan (already part of the contracted principal), and a free-text note on conditional discounts. This keeps one way of recording a premium.

## 9. Tax relief for housing loan interest

**None today.** The current Zakon o porezu na dohodak (NN 115/16 to 152/24, in force since 1.1.2025) contains no housing relief at all. The word "stamben" does not appear in it.

History, verified on Narodne novine: the 2004 act ([NN 177/04](https://narodne-novine.nn.hr/clanci/sluzbeni/2004_12_177_3066.html)), članak 36 stavci 16 to 20, let a resident buying or building a first home raise the personal allowance "u visini plaćenih kamata" on a dedicated housing loan. [NN 80/10](https://narodne-novine.nn.hr/clanci/sluzbeni/2010_06_80_2276.html), članak 16, deleted stavci 12 to 26 from 1 July 2010. Članak 33 stavak 3 of that act still allowed a 2010 claim, capped at 6.000 kuna, for payments made before that date.

The current first-home measure is a one-off refund of real estate transfer tax or VAT for buyers under 45 with contracts from 1 January 2025, run by APN under Zakon o priuštivom stanovanju (NN 45/2026) ([APN, Povrat poreza](https://apn.hr/povrat-poreza/o-mjeri/)). It is a grant on the purchase, not a loan feature. The Loans app does not need it.

## What the model must hold

### Bank loan

| Field                                                                                                               | Why                                                                  |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| direction, counterparty, label                                                                                      | `borrowed` or `lent`, as in lane 3                                   |
| principal (contracted), currency EUR                                                                                | basis of every figure                                                |
| drawdowns: date, amount                                                                                             | interkalarna and tranches. v1 can hold one.                          |
| repayment start date, first instalment date, payment day                                                            | where interim ends and the schedule begins                           |
| term in months                                                                                                      | annuity and linear formulas                                          |
| method: `annuity`, `linear`, `bullet`                                                                               | section 1                                                            |
| grace months, grace interest `paid` or `capitalised`                                                                | poček                                                                |
| instalment day count (default 30/360, monthly rate = nominal / 12)                                                  | section 2                                                            |
| interim day count (default actual/365) and the interkalarna amount charged                                          | section 3                                                            |
| EKS as printed                                                                                                      | display only                                                         |
| rate periods: start (date or instalment number), `fixed` or `variable`, rate, or index name + margin + reset months | section 4                                                            |
| applied-rate observations per variable period: effective date, rate                                                 | from the bank's notice under članak 27, never derived from the index |
| extra payments: date, amount, effect `shorter term` or `lower instalment`, fee                                      | section 5. Fee is always 0 for a housing loan.                       |
| subsidy: monthly amount, first covered instalment, instalments covered                                              | section 6                                                            |
| subsidy extensions: date, instalments added, reason                                                                 | children, disability                                                 |
| secured by (asset id), note                                                                                         | as in lane 3. The note holds conditional discounts.                  |

Rules the schedule engine applies:

1. Annuity rounded to cents. Interest per month rounded half up on the opening balance. The last instalment takes the remaining principal.
2. At a rate change, keep the remaining term and re-annuitise the remaining principal at the new rate.
3. At an extra payment, either re-annuitise over the remaining term (lower instalment) or keep the instalment and shorten the term.
4. The subsidy reduces what the owner pays and settles interest first. It does not change the principal schedule. Do not assume it is smaller than the month's interest.
5. When the computed figure disagrees with the bank's plan or the free report under članak 12, the bank wins. The difference points to a wrong setting.

### Informal loan

| Field                                                                            | Why                                                        |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| direction, counterparty, label, start date                                       |                                                            |
| due date (optional)                                                              | none means demandable with two months' notice (članak 504) |
| yearly rate (optional, default none), day count actual/365                       | članak 500 and članak 26 cap                               |
| events: date, kind (`advance`, `repayment`, `in kind`, `forgiven`), amount, note | balance = advances − repayments − in kind − forgiven       |

If interest is agreed, payments settle costs, then interest, then principal (članak 172). An `in kind` event's note says what was paid for whom. A `forgiven` event matters for the possible 4 % gift tax.

## Open questions for the owner

1. **Which amount leaves your account each month for the housing loan: the full instalment or the instalment minus the subsidy?** This decides what the ledger match in lane 3 compares against.
2. **Is your rate fixed for the first five years, and what does the contract say after that: a fixed rate, or an index plus margin?** If variable, which index and reset months?
3. **Is the loan above 100.000 EUR?** If so, the subsidy covers only the 100.000 EUR part and the plan splits it.
4. **Has the subsidy already been extended, or should the app expect an extension?** The 60-day deadline after a birth is strict.
5. **Have you made any extra payments, and did the bank shorten the term or lower the instalment?**
6. **Should the app compute the schedule from the contract terms, or should you paste the bank's plan in and let the app only check it?** Computing is the plainer v1. The bank's plan is the fallback when a figure disagrees.
7. **Do any of your informal loans carry interest or a due date, and do you want forgiveness recorded as an event?**
