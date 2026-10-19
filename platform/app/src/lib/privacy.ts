// The privacy notice shown in the app and at /privacy on the web (the stores need a public address for it).
// Draft wording: the Grand Priory's data protection contact must confirm it before the first public release
// (see docs/security/app-store-checklist.md). It describes what the app actually does; keep it in step with the code.
export const privacyUpdated = '2026-10-19';

export const privacySections: { title: string; body: string[] }[] = [
  { title: 'Kdo údaje zpracovává', body: [
    'Správce osobních údajů: [doplní organizátoři před zveřejněním – kdo pouť pořádá a odpovídá za údaje, viz docs/STATUS.md otázka Q2]. Kontakt pro otázky k osobním údajům: [doplní organizátoři].',
  ] },
  { title: 'Jaké údaje aplikace používá', body: [
    'Jméno, kategorii účastníka, přidělený autobus nebo let, ubytování, program a kontakty na tým. Tyto údaje zapisují organizátoři pouti; aplikace je jen zobrazuje.',
    'Váš čtyřmístný kód slouží k přihlášení. Členové týmu zadávají navíc kód akce.',
    'Zdravotní údaje aplikace na telefonu nezobrazuje a neposílá je v QR kódu ani v oznámeních.',
  ] },
  { title: 'Poloha a fotoaparát', body: [
    'Poloha se zapne, jen když na mapě stisknete „Zapnout moji polohu“. Zobrazí se jen ve vašem telefonu, nikam se neodesílá a neukládá.',
    'Fotoaparát používají jen členové týmu ke skenování jmenovek. Fotografie se neukládají.',
  ] },
  { title: 'Kde jsou údaje uložené', body: [
    'Na serverech služby Supabase v Evropské unii (Irsko). Na telefonu zůstává kopie vašeho programu pro chvíle bez signálu; po odhlášení se smaže.',
    'Mapové podklady načítá telefon ze serverů OpenStreetMap a fotografie míst z Wikimedia Commons. Tyto služby uvidí jen adresu vašeho připojení, ne vaše jméno.',
  ] },
  { title: 'Sledování a reklama', body: ['Aplikace nesleduje vaše chování, nepoužívá reklamu ani analytické nástroje třetích stran.'] },
  { title: 'Jak dlouho', body: [
    'Údaje o pouti uchovávají organizátoři po dobu nutnou k její přípravě a vyúčtování, nejdéle podle pravidel organizátorů pro daný ročník; poté se smažou.',
  ] },
  { title: 'Vaše práva', body: [
    'Máte právo na přístup, opravu, výmaz, omezení zpracování a vznést námitku, a právo podat stížnost u Úřadu pro ochranu osobních údajů (uoou.gov.cz).',
    'Svůj přihlašovací účet můžete kdykoli smazat sami v aplikaci: Účet a soukromí → Smazat můj účet. Údaje o vaší účasti na pouti pak smažou organizátoři na vaši žádost nebo po skončení ročníku.',
  ] },
];
