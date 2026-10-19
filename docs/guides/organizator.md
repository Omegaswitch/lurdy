# Administrace – návod pro organizátory

Adresa: web administrace (viz [J – nasazení](../J-deployment.md)). Pracujte na počítači.

## Přihlášení
1. Číslo účastníka + kód z pozvánky + kód pouti.
2. Poprvé: naskenujte QR kód aplikací pro ověřování (Google Authenticator, Microsoft Authenticator…) a opište šestimístné číslo. Příště stačí opsat číslo.
3. Bez tohoto ověření administrace nic neukáže – chrání to údaje všech účastníků.

## Účastníci
- **Nový účastník** → jméno, příjmení, kategorie, pohyblivost, telefon → **Uložit**. Číslo účastníka a kód z pozvánky se přidělí samy; jsou vidět v panelu vpravo i jako QR kód pozvánky. **Na jmenovku je nepište.** Ztracená pozvánka: **Nový kód z pozvánky** – starý přestane platit okamžitě. Export CSV s kódy (zaškrtnout *Včetně přihlašovacích kódů*) obsahuje i odkaz pozvánky pro hromadnou korespondenci; každý takový export se zapíše do auditu.
- Klepnutím na řádek otevřete úpravy. Když mezitím upravil stejného člověka někdo jiný, aplikace to řekne a načte aktuální verzi – nic se nepřepíše potichu.
- **Role v aplikaci**: zaškrtnutím *Tým* nebo *Asistent* dáte člověku přístup k týmové části aplikace. Organizátora a zdravotníka přidává správce.

## Doprava
- **Nový spoj**: let, autobus nebo kamion, směr (tam / zpět / na místě), označení (A, B…), počet míst a míst pro vozík.
- Vyberte spoj vlevo; vpravo **Přidat cestujícího** (lidé bez dopravy jsou nahoře) a u každého **Přesunout do** / **Odebrat**.
- Plný autobus nebo chybějící místo pro vozík databáze nepustí a řekne proč.

## Jmenovky
1. Nastavte rozměr (mm), okraje, mezery a posun pro tiskárnu; **Uložit**.
2. Vyberte lidi (filtr *Bez platné jmenovky*) → **Vytisknout jmenovky** → v tiskovém dialogu tiskárna nebo *Uložit jako PDF*. Měřítko 100 %, bez okrajů.
3. Každý tisk vytvoří **nové** QR kódy, ale ty začnou platit až po potvrzení: pod seznamem se objeví blok *Vytištěno, čeká na potvrzení*. Když papír vyšel z tiskárny v pořádku, klepněte **Aktivovat – vytištěno v pořádku** (od té chvíle dosavadní jmenovky těchto lidí neplatí); když se tisk nepovedl, **Zahodit – tisk se nepovedl** a nic se nemění. Do potvrzení skener nové jmenovky hlásí „ještě není aktivní“. Tak se řeší i ztracená jmenovka.
4. Na každém listu je ročník a čas tisku, aby bylo poznat, který papír je aktuální.

## Přehled
Počty lidí podle kategorií, kdo nemá dopravu nebo ubytování, a kolik lidí nastoupilo a dorazilo u každého spoje (aktualizuje se samo).
