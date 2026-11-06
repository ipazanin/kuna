---
status: idea
feature: company
summary: One person with several companies, or a company and an obrt, each with its own books and legal form.
---

# Several companies for one person

A person can own several companies, or a company and an obrt. Today Kuna has one Company file, `kuna-company.json`, and `src/apps/company/app.ts` installs one pack for the whole page. So each set of books needs its own file and its own legal form, and the shell, the home, Kuna's Overview, mail filing, the secrets file and the AI chat's context all need to know which one is on screen.

It depends on [more legal forms](company-legal-forms.md), and both should be planned together.
