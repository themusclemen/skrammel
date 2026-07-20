# Skrammel — Spec

## Koncept

Varje dag presenteras spelaren för ett nytt svenskt ord ("källordet"), t.ex.
"LÄSKEDRYCK". Målet är att hitta så många andra ord som möjligt som går att
bilda av bokstäverna i källordet, inom 5 minuter.

## Regler

- Bokstäverna i ett hittat ord får inte användas fler gånger än de
  förekommer i källordet (multiset-begränsning).
- Fri bokstavsordning — orden behöver **inte** vara en sammanhängande
  substräng av källordet. Exempel ur "LÄSKEDRYCK": ER, LÄSK, DRYCK, YRKE,
  SKÄL, RYCK.
- Minsta ordlängd: 2 bokstäver.
- Tidsgräns: 5 minuter per dag.
- Samma källord för alla spelare samma dag (dagligt pussel, resettar var
  24:e timme).

## Poäng

- Poäng = antal bokstäver i ordet (2-bokstavsord = 2 poäng, 3-bokstavsord =
  3 poäng, osv.).
- Ingen extra bonus utöver ordlängden är beslutad.

## Topplista

- En topplista per dag.
- Man kan spela utan att vara inloggad (gäst), men måste vara inloggad för
  att synas på topplistan.
- Resultat sparas endast för inloggade spelare.

## Beslutat hittills

- Ny egen visuell identitet — **inte** minikors guldtema.
- Gäster kan spela; inloggning krävs bara för topplistan.
- Ordlista: `public/ordlista.txt`, 70k+ svenska ord, kompletterad med
  pronomen och interjektioner. Källordet självt räknas inte som ett
  hittat ord. Se architecture.md för detaljer.

## Byggt

- **Delningsfunktion:** "Dela resultat"-knapp på `ResultScreen`, spoiler-
  fri (poäng, ord-antal, dagens nådda nivå — aldrig vilka ord som
  hittades), likt Wordle/NYT Spelling Bee. `navigator.share` där det
  finns, annars kopiering till urklipp. Byggd 2026-07-19, ingen ny
  backend.
- **Vänhantering:** lägg till/ta bort vänner, vän-topplista, utmana en
  vän. Vänner läggs till via en delad inbjudningslänk (`/friend/<id>`),
  inte namnsökning eller e-post — ny `FriendsScreen`, ny `friendships`-
  tabell i Supabase. "Utmana" delar en inbjudan via samma delnings-UI som
  resultatdelning; ingen ny spellogik. Byggd 2026-07-19.

- **Blixtpussel v2:** async 1-mot-1-utmaningsspel mellan spelare,
  separat från dagens delade ord — eget 8-bokstavsord, 2 minuter.
  Spela-först-flöde (spela en oriktad runda, välj sen vem du utmanar
  med resultatet), kan utmana vänner eller en slumpad motståndare
  (vilken registrerad spelare som helst), anta/ignorera som egna
  handlingar, max 20 matcher på gång samtidigt, vinst/förlust-stats
  per motståndare. Full plan i `~/.claude/plans/floating-sniffing-thimble.md`
  — se `architecture.md` under "Blixtpussel v2" för byggstatus. Byggd
  2026-07-19, `npm run build` grönt, databasmigrationerna körda mot
  `skrammel-beta`, committat och pushat. Källorden dras ur en
  admin-kuraterad pool (`/admin/blixt`, `blixt_words`-tabell) istället
  för att slumpas rent klient-sidan — se `architecture.md` under
  "Ordkuration"/"Ordlängd ändrad till 8" för status.

## Öppna frågor (ej beslutade än)

- Hur källordet för varje dag väljs/kureras (manuellt likt minikors
  puzzles, eller genererat?). Ett kureringsscript finns nu
  (`scripts/findWordsIn.mjs`) för att se hur många ord ett kandidatord ger.
- Om repriser/omspel av samma dags ord ska vara tillåtna, och om det i så
  fall påverkar topplistan (minikors-mönstret är att bara första
  försöket räknas).
