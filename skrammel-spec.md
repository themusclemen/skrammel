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

- **Blixt-Duell:** async 1-mot-1-utmaningsspel mellan spelare,
  separat från dagens delade ord — eget 8-bokstavsord, 2 minuter.
  Motståndare väljs FÖRE spel via "Starta ny match" på hubben
  (`BlixtNewMatchModal`): vän, slumpad motståndare, eller CPU (ny,
  lokal träning utan databasrad). Kan även utmana vem som helst på
  Blixt-topplistan. Anta/nobba som egna handlingar, max 50 matcher på
  gång samtidigt (gäller inte CPU), orddiff på avslutade matcher
  (vilka ord ni båda hittade vs bara en av er) — och motståndarens
  poäng syns numera redan innan man själv spelat.
  Oavslutade utmaningar kan raderas på riktigt; avslutade matcher döljs
  (inte raderas — topplistan behöver raderna) automatiskt efter ett
  dygn eller manuellt. En "tiden är ute"-modal visar vinst/förlust
  direkt när en runda tar slut, innan facit. Flera samtidiga matcher mot
  samma motståndare visas hopfällt (namn + antal) i "Ej spelade"-listan.
  Se `architecture.md` under "Blixt-Duell — flödet vänt" (2026-08-09)
  för det aktuella flödet, och "Blixtpussel v2" för hur det ursprungligen
  byggdes. Källorden dras ur en admin-kuraterad pool (`/admin/blixt`,
  `blixt_words`-tabell) istället för att slumpas rent klient-sidan.
- **Blixt-topplista:** Global/vän-flikar, rankar efter flest vunna
  matcher totalt (ny `security definer`-SQL-funktion
  `blixt_leaderboard()`, kringgår RLS men exponerar bara summerade
  siffror). Nåbar via en "Topplista"-knapp i Blixt-huben, och sen
  2026-07-21 även via hemskärmens "Topplistor"-väljare. Man kan
  utmana vem som helst på listan direkt, oavsett vänskap. Byggd
  2026-07-21.
- **Bokstavs-Duell (kodnamn Skrammelpaj):** ett tredje spel, async 1-mot-1 precis som Blixt men
  med en helt annan mekanik — två spelare turas om att bilda ord ur en
  **delad, krympande** bokstavspool (4 slumpade ord, 20-25 bokstäver,
  blandade) istället för att spela parallella oberoende rundor mot
  samma källord. Bokstäver försvinner permanent ur poolen när de
  används; den som inte hittar ett ord inom 2 minuter — eller inte kan
  hitta något alls när poolen tar slut — förlorar. Mottagaren (inte
  utmanaren) spelar första draget vid accept. Utöver den aktiva
  2-minutersklockan finns en 72-timmars gräns för att svara på sin tur
  överhuvudtaget, annars förloras matchen genom övergivande — kollas
  lat av vem som helst av deltagarna som råkar ha matchlistan öppen,
  ingen cron finns. Man får alltid försöka hitta ett ord på sin tur,
  även om det (matematiskt) är omöjligt givet vad som är kvar — bara en
  helt tom pool avgör en tur automatiskt. Bokstavsgridden visar hela
  den ursprungliga poolen hela matchen, med redan använda bokstäver
  gråtonade istället för dolda. Kan även spelas mot **CPU** (en bot som
  väljer slumpmässigt bland formbara ord, med en märkbar "tänker"-paus
  och ordet avslöjat bokstav för bokstav) — CPU-matcher är helt lokala,
  ingen databaspost skapas, räknas alltså aldrig till topplistan. Egen
  topplista (`skrammelpaj_leaderboard()`), samma global/vän-mönster som
  Blixt. Byggd och applicerad mot `skrammel-beta` 2026-07-21, se
  `architecture.md` för fullständig historik och efterföljande
  UX-fixar. **Tillfälligt bortkommenterad ur UI:t sedan 2026-08-09**
  (spellogik/databas orörd) medan de tre andra spelen finputsas — se
  "Streamlining av de tre andra spelen" i `architecture.md`.
- **Solo-Hets:** ett fjärde spel, helt solo — datorn slumpar bokstäver
  som bildar ett riktigt ord (start 3 bokstäver, +1 för varje klarad
  runda), 30 sekunder per runda för att skriva VILKET giltigt ord som
  helst av exakt de bokstäverna (inte bara datorns ursprungsord).
  Poäng = högsta klarade bokstavslängd, delat avgörs av kortast total
  tid. En inloggad spelares personbästa hämtas innan start och visas
  som mål genom hela rundan. Sedan 2026-08-09 kan man **backa till
  föregående nivå** (nytt ord, samma längd) om man kör fast — kostar
  fortfarande tid, klockan nollställs inte. Byggd 2026-07-22, se
  `architecture.md` för fullständig historik.
- **Hemskärmens navigering omarbetad (2026-07-21):** alla tre spelen
  (Dagens Skrammel, Blixt-Duell, Bokstavs-Duell) går nu via en delad
  `GameInfoScreen` (regler + Tillbaka/Starta) innan man committar till
  att spela. Länkraden längst ner gick från fem länkar till två:
  **Topplistor** (ny väljarskärm som länkar till vart och ett av de tre
  spelens topplistor) och **Vänner**.

## Öppna frågor (ej beslutade än)

- Hur källordet för varje dag väljs/kureras (manuellt likt minikors
  puzzles, eller genererat?). Ett kureringsscript finns nu
  (`scripts/findWordsIn.mjs`) för att se hur många ord ett kandidatord ger.
- Om repriser/omspel av samma dags ord ska vara tillåtna, och om det i så
  fall påverkar topplistan (minikors-mönstret är att bara första
  försöket räknas).
