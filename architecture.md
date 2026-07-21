# Skrammel — Arkitektur

## Översikt

Skrammel är ett dagligt svenskt ordspel för mobilen. Se `skrammel-spec.md`
för spelregler.

**Nuläge:** Live, deployad app — se "Backend: Supabase-projekt
`skrammel-beta`" nedan för hela deploy-kedjan (GitHub + Supabase +
Vercel, allt uppsatt). Appen är samtidigt robust mot att köras helt
utan backend (se "Lokal körning utan backend" nedan), praktiskt för
andra som klonar repot utan Supabase-nycklar.

---

## Tech stack

Samma stack som minikors (syskonprojekt, `../minikors`):

| Lager | Teknik |
|-------|--------|
| Frontend | React 18 + Vite |
| Språk | JavaScript (JSX) |
| Styling | Inline styles (temaobjekt `T` i `src/theme.js`) |
| Backend / DB | Supabase (Postgres + auto-genererat REST API) — projekt `skrammel-beta`, live |
| Auth | Supabase Auth (email/lösenord), valfritt — gäster kan spela |
| Hosting frontend | Vercel — live på https://skrammel.vercel.app |

---

## Filstruktur

```
skrammel/
├── src/
│   ├── main.jsx
│   ├── App.jsx              # Skärm-routing (state-baserad, som minikors — inget react-router)
│   ├── supabase.js          # Supabase-klient (läser env vars — kräver .env)
│   ├── theme.js             # Skrammels egen visuella identitet
│   ├── game/                # Ren spellogik, inga sidoeffekter
│   │   ├── constants.js     # MIN_WORD_LENGTH, GAME_DURATION_SECONDS, FALLBACK_WORD, CHALLENGE_LEVELS, ADMIN_EMAIL
│   │   ├── letters.js       # letterCounts, canFormWord (multiset-check)
│   │   ├── scoring.js       # scoreForWord, totalScore, isScorable
│   │   ├── wordList.js      # Laddar public/ordlista.txt till ett Set, isValidWord
│   │   ├── findWords.js     # findWordsInSource — kureringshjälp + histogram-/facitdata (se nedan)
│   │   ├── levels.js        # computeLevelTargets — poängmål per nivå (se "Nivåsystem" nedan)
│   │   ├── adminSuggest.js  # Slumpar/utvärderar källords-kandidater för adminsidan
│   │   └── evaluateGuess.js # Kombinerar allt ovan till ett GuessResult
│   ├── audio/
│   │   └── sounds.js        # playClickSound, playFanfareSound
│   ├── api/                 # Supabase-anrop, en modul per behov
│   │   ├── dailyWord.js     # fetchTodaysWord, fetchAllDailyWords, upsertDailyWord, deleteDailyWord
│   │   └── scores.js        # submitScore, fetchLeaderboard, fetchUserPlayedDates
│   ├── components/
│   │   ├── WordLengthHistogram.jsx  # Stapeldiagram, en stapel per ordlängd (se nedan)
│   │   ├── ChallengeBar.jsx         # XP-bar mot nästa nivå (se "Nivåsystem" nedan)
│   │   ├── WordLengthModal.jsx      # Ord spelaren hittat på en viss längd (klick på histogram-piller)
│   │   ├── GameMenuModal.jsx        # "…"-menyn: Fortsätt / Avsluta (med bekräftelsesteg, se nedan)
│   │   ├── TimeUpModal.jsx          # Visas när tiden går ut: fortsätt utan tävling eller avsluta
│   │   └── WordRevealModal.jsx      # Facit — alla möjliga ord per längd, visas efter bekräftad Avsluta
│   └── screens/
│       ├── HomeScreen.jsx
│       ├── GameScreen.jsx       # Timer + tryck-på-bokstäver ELLER tangentbord (se nedan)
│       ├── ResultScreen.jsx
│       ├── LeaderboardScreen.jsx
│       ├── ArchiveScreen.jsx    # Kalender för att spela tidigare dagars ord (se nedan)
│       ├── AuthScreen.jsx       # Email/lösenord + visningsnamn vid signup, "Fortsätt som gäst"
│       └── AdminWordsScreen.jsx # /admin — publicera dagens ord (se nedan)
├── public/
│   └── ordlista.txt         # Svensk ordlista, 70k+ ord (se "Ordlista" nedan)
├── scripts/
│   └── findWordsIn.mjs      # CLI-verktyg: node scripts/findWordsIn.mjs LÄSKEDRYCK
├── supabase/
│   ├── schema.sql           # daily_words, scores, profiles (se "Datamodell" nedan)
│   └── migrations/          # Inkrementella ändringar mot schema.sql (t.ex. level_times-kolumnen)
├── architecture.md          # Det här dokumentet
└── skrammel-spec.md         # Produkt-spec
```

---

## Datamodell (skapad i Supabase, projekt `skrammel-beta`)

### Tabell: `daily_words`

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| date | date (PK) | Format `YYYY-MM-DD` |
| word | text | Källordet, versaler |
| created_at | timestamp | Auto |

RLS: publik `SELECT`, `INSERT`/`UPDATE`/`DELETE` bara för `ADMIN_EMAIL`.

### Tabell: `scores`

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| user_id | uuid (FK → auth.users) | |
| date | text | Format `YYYY-MM-DD` |
| score | int | Total poäng |
| words_found | jsonb | Array av hittade ord |
| display_name | text | Visningsnamn vid speltillfället (denormaliserat, hämtat från `user.user_metadata.display_name`, se "Inloggning" nedan) |
| level_times | jsonb | `{ "PROFFS": 42, "GUD": 190, ... }` — sekunder från spelstart när respektive nivå klarades, tillagt via migration `2026-07-11-add-level-times.sql` |
| created_at | timestamp | Auto |

RLS:
- `SELECT`: publik (för topplistan)
- `INSERT`: endast autentiserad användare, egna rader (`auth.uid() = user_id`)

### Tabell: `profiles` — **oanvänd, kandidat för borttagning**

Kolumner: `id` (uuid = auth.uid), `display_name` (unique), `updated_at`.
Fanns tänkt för att slå upp ett visningsnamn separat från
inloggningen, men ingenstans i koden skrivs det längre till den här
tabellen — visningsnamnet sätts numera direkt i Supabase auth
`user_metadata` vid signup (se "Inloggning" nedan) och läses därifrån,
inte från `profiles`. Tabellen och dess RLS-policys ligger kvar i
`schema.sql`/databasen men är dött viktmässigt; en migration som
droppar den är inte skriven (kräver ett medvetet beslut, inte gjort
automatiskt).

---

## Ordlängd-histogram

`src/components/WordLengthHistogram.jsx` visar en stapel per ordlängd,
från 2 bokstäver upp till den längsta ordet som faktiskt går att bilda
av dagens källord (t.ex. 2–6 för "ANDROID" — inte källordets egen
längd). Stapelns höjd är antal ord av den längden som *går att
hitta* totalt; den ifyllda, lime-färgade delen är hur många spelaren
*har* hittat. Fylls i mer (och en liten "n/totalt"-etikett uppdateras)
för varje nytt ord som hittas. Staplarna fyller raden med flexbox
(`flex: 1 1 0`, ingen fast bredd) så att de alltid ryms oavsett hur
många ordlängder källordet ger — annars hamnar de sista staplarna
utanför skärmen på källord med många möjliga längder.

Datat kommer från `findWordsInSource` (samma funktion som
kureringsscriptet använder) grupperat per ordlängd, körs en gång per
`sourceWord` via `useMemo` i `GameScreen.jsx` — inte per knapptryckning.

---

## Spelskärmens interaktion (mobil + skrivbord)

`GameScreen.jsx` stöder både tryck-på-bokstäver (mobilanpassat) och
vanligt tangentbord (skrivbord):

- Källordets bokstäver visas som en knapprad **längst ner** på skärmen
  (tumvänligt). Sökrutan (visar ordet som byggs) ligger direkt ovanför
  bricktrayn, med ⌫ (ångra sista bokstaven) och OK bredvid.
- Att trycka på en bokstavsbricka lägger till den i sökrutan och gör
  brickan tom (dashed border, inte klickbar) tills ordet skickas in
  eller rensas.
- Spårning sker per bokstavsindex (inte bara bokstav), eftersom
  källord kan ha upprepade bokstäver (t.ex. två K i "LÄSKEDRYCK") —
  annars skulle det inte gå att skilja på vilken av de två K:na som
  tryckts.
- Eftersom ord bara kan byggas av faktiskt otryckta brickor kan
  `NOT_IN_SOURCE`-fallet i `evaluateGuess` i praktiku aldrig triggas
  via UI:t längre — det är kvar som skydd i den delade logiken.
- Vid godkänt ord: brickorna återställs och ordet läggs i listan. Vid
  avvisat ord (redan hittat / inte ett riktigt ord): brickvalet ligger
  kvar så man kan trycka ⌫ och justera, istället för att behöva bygga
  om från noll.
- **Tangentbord (tillagt 2026-07-14):** en `keydown`-lyssnare låter
  spelaren skriva bokstäver direkt (matchas mot första otryckta
  bricka med samma bokstav), Backspace och Enter — samma handlers som
  tap-flödet ovan. Avstängd så länge någon modal (meny/tid-ute/
  ordlängd/facit) är öppen.

---

## Nivåsystem och avsluta-flödet

**Nivåtrappa** (`CHALLENGE_LEVELS` i `game/constants.js`,
`computeLevelTargets` i `game/levels.js`): Dagens utmaning → PROFFS →
ELIT → GENI → GUD → **LEGENDARISK**, som andelar (5–40%) av
`totalPossibleScore` (summan av poäng för alla ord som går att bilda
av källordet). Målen avrundas ner till närmaste tiotal men är alltid
strikt stigande. `ChallengeBar.jsx` visar nuvarande nivå som en
XP-bar mot nästa mål; på toppnivån (LEGENDARISK) visas `(max N)`
bredvid målet, och när den är klarad byts "målet" ut mot det faktiska
`totalPossibleScore`.

**Avsluta mitt i spelet** (`GameMenuModal.jsx`, öppnas via
"…"-knappen): "Avsluta" kräver numera ett bekräftelsesteg ("Är du
säker? Du kan inte fortsätta spela efter det här.") innan det faktiskt
avslutar rundan — tidigare avslutade en enda klick direkt, vilket var
lätt att göra av misstag. Efter bekräftelse visas `WordRevealModal.jsx`
— facit över alla möjliga ord grupperade per längd, hittade ord
markerade — innan man går vidare till `ResultScreen`.
`TimeUpModal.jsx` (visas när tiden går ut) fick **inte** samma
bekräftelsesteg — att välja Avsluta där är redan ett medvetet val,
inte ett oavsiktligt klick mitt i spelet.

---

## Ordlista

`public/ordlista.txt` — 70 508 svenska ord (en per rad, gemener), källa
kompletterad av användaren utöver minikors ursprungslista. Skillnader mot
minikors' `ordlista.txt`:

- Innehåller redan 1–2-bokstavsord (minikors-listan hade inga alls)
- Kompletterad manuellt med pronomen (jag, du, vi, den, det, sig, som, …)
  och vanliga interjektioner (oj, hej, fan, tjo, usch, …) — dessa
  saknades helt i grundlistan (den är byggd på substantiv/verb/adjektiv
  och deras böjningar, inte slutna ordklasser)
- En skräprad (`#`) längst ner i originalfilen är borttagen

**Laddning:** `src/game/wordList.js` hämtar filen en gång via `fetch`
(`loadWordList()`, anropas i `App.jsx` vid start) och bygger ett `Set`
i versaler. `App.jsx` visar "Laddar…" tills både dagens ord OCH
ordlistan är klara — annars skulle allt avvisas som "Inte ett ord"
under ett kort ögonblick.

**Uteslutning av källordet:** `evaluateGuess` tar nu emot både
`sourceWord` (exakt sträng) och `sourceCounts` (multiset) — annars går
det inte att skilja på "spelaren skrev källordet självt" (ska avvisas,
specen säger "hitta andra ord") och en giltig delmängd av bokstäverna.

**Kurering (CLI):** `scripts/findWordsIn.mjs <ORD>` listar alla ord i
`ordlista.txt` som går att bilda ur ett kandidat-källord, grupperat
per längd. Användbart innan ett ord publiceras som dagens ord — t.ex.
`node scripts/findWordsIn.mjs ANDROID` ger 60 hittabara ord (2–6
bokstäver), en rimlig nivå för 5 minuter. Samma logik
(`findWordsInSource` i `src/game/findWords.js`) återanvänds i appen
för att visa facit — se `WordRevealModal.jsx` under "Nivåsystem och
avsluta-flödet" ovan.

---

## Admin: `/admin` — publicera dagens ord

Speglar minikors' `/adminwords`-mönster (routing via
`window.location.pathname`, inget router-bibliotek), men mycket
enklare eftersom Skrammel bara har ett ord per dag (inte ordpar +
ledtrådar + tema):

- **Åtkomst:** kräver inloggning + `user.email === ADMIN_EMAIL`
  (`themusclemen@gmail.com`, samma konstant som RLS-policyn i
  `schema.sql` pekar på). Ej inloggad → `AuthScreen`. Fel mejl →
  "Åtkomst nekad". RLS är den faktiska säkerhetsspärren — klientkollen
  är bara för att slippa visa en trasig adminsida.
- **Datumspann:** idag + 30 dagar framåt (31 rader), se
  `AdminWordsScreen.jsx`.
- **Auto-generering:** `src/game/adminSuggest.js` slumpar kandidater
  (7–10 bokstäver) ur ordlistan och kollar antalet hittabara ord via
  `findWordsInSource` — försöker landa inom 50–250 hittabara ord
  (upp till 20 försök per rad), annars bästa träffen. Redan
  publicerade dagar rörs aldrig av auto-generering.
- **Per rad:** redigerbart ordfält, hittabara-ord-antal (räknas om vid
  blur), ↻ för att slumpa en ny kandidat, kryssruta "Publicera" som
  upsertar/tar bort raden i `daily_words` (`api/dailyWord.js`:
  `fetchAllDailyWords`, `upsertDailyWord`, `deleteDailyWord`).
- **Verifierat:** ej inloggad → login, fel mejl → nekad (RLS ger 403
  om man ändå försöker), tabellen laddar och genererar korrekt.
  Publicering kunde inte testas end-to-end här (kräver den riktiga
  admin-inloggningen) — testa själv i produktion.
- **Status:** användaren har själv loggat in med `themusclemen@gmail.com`
  och publicerat riktiga ord för 2026-07-14 t.o.m. 2026-07-24.

---

## Arkiv: spela tidigare dagars ord

Speglar minikors' `OlderChallengesScreen`, men förenklat till en
kalender utan svårighetsnivåer (`src/screens/ArchiveScreen.jsx`):

- Månadskalender (måndag–söndag), navigering med ‹ ›
- En dag är spelbar om `daily_words` har en rad för det datumet OCH
  datumet är idag eller tidigare (kan aldrig spela framtida
  publicerade dagar i förväg)
- Klarade dagar (finns en rad i `scores` för inloggad användare +
  datumet) visas gröna med bock, hämtas via
  `fetchUserPlayedDates` i `api/scores.js`
- Klick på en spelbar dag anropar `App.jsx`s `startGame(date)`, som
  hämtar ordet för *det* datumet (`fetchTodaysWord(date)` — samma
  funktion som redan användes för "dagens ord", nu daturm-generisk)
  och sätter `playingDate` — används både när resultatet sparas och
  när man går vidare till Topplista (så den visar rätt datums
  topplista, inte alltid dagens)
- **Verifierat end-to-end mot riktig Supabase:** kalendern visar bara
  2026-07-14 som spelbar (resten av de redan publicerade dagarna
  07-15–07-24 ligger i framtiden och är korrekt spärrade), spelade
  dagens ord ("SKOLKET"), avslutade, och dagen visades grön/klarad vid
  återbesök i kalendern.

---

## Inloggning

`AuthScreen.jsx` — email/lösenord via Supabase Auth (`signInWithPassword`
/ `signUp`), plus "Fortsätt som gäst". Vid signup finns numera även ett
**visningsnamn**-fält (tillagt 2026-07-14): värdet skickas som
`options.data.display_name` till `signUp()`, vilket lagras direkt i
Supabase auth `user_metadata` — tillgängligt omedelbart oavsett om
projektet kräver e-postbekräftelse eller ej (till skillnad från
`profiles`-tabellen, se "Datamodell" ovan, som kräver en aktiv session
för att skriva till pga RLS). `App.jsx` läser
`user.user_metadata.display_name` synkront från sessionen — inget
separat Supabase-anrop behövs.

**E-postbekräftelse hanteras nu korrekt:** `signUp()` kan lyckas
(inget `error`) men ändå returnera `data.session === null` om
projektet kräver bekräftelse — kontot finns men användaren är inte
inloggad förrän länken i mejlet klickats. Tidigare kördes `onDone()`
oavsett, vilket tyst landade den fortfarande utloggade användaren på
hemskärmen utan förklaring. `AuthScreen.jsx` kollar nu `data.session`
och visar en "Kolla din mejl"-vy istället. (Projektet `skrammel-beta`
har för närvarande "Confirm email" avstängt, se nedan, så den här
grenen triggas inte i produktion just nu — men koden är robust om det
sätts på igen.)

---

## Backend: Supabase-projekt `skrammel-beta`

Ett riktigt Supabase-projekt finns nu (namngivet `skrammel-beta`, samma
mönster som minikors). Schema skapat via `supabase/schema.sql`
(`daily_words`, `scores`, `profiles`, se "Datamodell" ovan). Email-auth
med "Confirm email" avstängt (samma beta-onboarding-genväg som
minikors — annars slår Supabase's gratis-e-postkvot i taket direkt).

Verifierat end-to-end med Playwright mot det riktiga projektet: konto
skapas och loggar in direkt (`POST /auth/v1/signup` → 200 med
access token), spela-loop fungerar, `POST /rest/v1/scores` → 201, och
resultatet dyker upp korrekt på `/leaderboard`. `.env` (gitignorad)
innehåller `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` lokalt.

**Städbehov:** ett par testkonton (`skrammel-test-*@mailinator.com`)
och deras poster i `scores` ligger kvar i `skrammel-beta` från
verifieringen — inget jag kan rensa själv med bara anon-nyckeln (kräver
service role-nyckel eller Supabase-dashboarden: Authentication → Users,
och Table editor → scores). Städa innan riktiga betatestare bjuds in.

## Lokal körning utan backend

`src/supabase.js` exporterar `isSupabaseConfigured` (sant bara om både
`VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` är satta). Om ingen
`.env`-fil finns är `supabase` `null`, och alla anrop som annars hade
träffat Supabase kortsluts istället — praktiskt för andra som klonar
repot utan att behöva Supabase-nycklar direkt:

- `App.jsx` sätter `user = null` direkt (ingen `getSession()`-väntan)
- `api/dailyWord.js` → `FALLBACK_WORD` (aktuellt värde i
  `src/game/constants.js`, ändras ofta under utveckling/test)
- `api/scores.js` → `submitScore` no-op, `fetchLeaderboard` → `[]`
- `AuthScreen` visar "Inloggning ej tillgänglig" istället för ett
  trasigt formulär

Verifierat i browser (Playwright-smoketest): hemskärm, spela-loop
(giltigt/ogiltigt ord ger rätt feedback), topplista (tomt-state) och
auth-skärmen fungerar alla utan `.env`, inga konsolfel.

---

## Öppna beslut / att göra härnäst

1. Städa testkonton/testresultat i `skrammel-beta` (se ovan) innan
   riktiga betatestare bjuds in.
2. Ta ställning till `profiles`-tabellen (se "Datamodell" ovan) — helt
   oanvänd sedan visningsnamn flyttade till auth `user_metadata`.
   Antingen skriv en migration som droppar den, eller lämna den om
   den kan tänkas fylla ett syfte senare.
3. Ordlistan är fortfarande inte 100% genomgången — den kan innehålla
   ovanliga böjningsformer eller enstaka konstigheter som dyker upp
   under spel. Justera `public/ordlista.txt` vid behov.
4. Daglig ord-kuration/publicering sker nu manuellt via `/admin` (se
   ovan) — fungerar, men är fortfarande en manuell process, inte
   automatiserad.
5. **Delningsfunktion** (byggd 2026-07-19, se `skrammel-spec.md`) — en
   "Dela resultat"-knapp på `ResultScreen` (`buildShareText` bygger
   texten: datum, poäng, ord-antal och dagens nådda nivå via
   `levelReachedForScore` i `src/game/levels.js`, aldrig vilka ord som
   hittades). Delning/kopiering själv sitter i `src/hooks/useShare.js`
   (`navigator.share` där tillgängligt, annars
   `navigator.clipboard.writeText` med en "Kopierat!"-bekräftelse) —
   samma hook återanvänds av vänhanteringen nedan.
   `GameScreen.jsx`s `onFinish` skickar nu även `totalPossibleScore`
   vidare så `App.jsx` kan räkna ut dagens nivå. Ingen ny backend.
6. **Vänhantering** (byggd 2026-07-19, se `skrammel-spec.md`) — lägg
   till/ta bort vänner, vän-topplista, utmana en vän. Ny tabell
   `friendships` i `supabase/schema.sql` (RLS: bara de två inblandade
   användarna får se/skriva/ta bort en rad; `requester_id`/`addressee_id`
   + genererade `user_a`/`user_b`-kolumner med `unique` förhindrar
   dubbletter oavsett riktning). **Manuellt steg återstår:** SQL:en är
   skriven men inte körd mot det live `skrammel-beta`-projektet — måste
   klistras in i Supabase SQL-editorn innan funktionen fungerar i
   produktion.

   Vänner läggs till via en delad inbjudningslänk
   (`buildInviteUrl`/`parseInviteFromLocation` i `src/api/friends.js`,
   samma no-router-mönster som `/admin`-specialfallet i `App.jsx`) — inte
   namnsökning eller e-post, för att slippa återuppliva den döda
   `profiles`-tabellen och namnkollisioner. En rad i `friendships` = en
   bekräftad vänskap, skriven av mottagaren när de öppnar länken och
   bekräftar i `FriendInviteModal.jsx` (mirror av
   `ReplayConfirmModal.jsx`); länken bär bara avsändarens user-id, ingen
   kryptografisk token — en känd, medveten avvägning eftersom all
   resultatdata redan är publik. Visningsnamn denormaliseras in i raden
   (samma mönster som `scores.display_name`) eftersom klienten inte får
   läsa `auth.users`.

   Ny `src/screens/FriendsScreen.jsx` (bjud in/ta bort/utmana, "Utmana"
   återanvänder `useShare` med ett generiskt inbjudningsmeddelande, ingen
   dynamisk poängdata). `LeaderboardScreen.jsx` har en ny "Global"/
   "Vänner"-flik (`fetchFriendsLeaderboard` i `src/api/friends.js`,
   samma `scores`-tabell, filtrerad på vän-id:n). Ingen ny spellogik.

---

## Blixtpussel v2 — byggt (2026-07-19)

Ett 1-mot-1-utmaningsspel mellan spelare, separat från dagens delade
ord: eget slumpat **6-bokstavsord**, **2 minuters** tidsgräns (kortare
än dagens 7–10 bokstäver / 5 minuter). Scopet växte under planeringen
långt bortom den första idén (dela en länk direkt efter att ha spelat)
— se den fullständiga planen i `~/.claude/plans/floating-sniffing-thimble.md`
(ersätter den äldre, aldrig byggda `noble-finding-waffle.md`).

**Bekräftade designbeslut:**
- **Spela-först-flöde:** man spelar en oriktad Blixt-runda, ser sin
  poäng, och väljer *sen* vem man vill utmana — högst en mottagare per
  spelad runda. Inte "välj motståndare, spela sen" som första utkastet.
- **Slumpmotståndare:** man kan utmana vilken registrerad spelare som
  helst (någon som någon gång lagt in ett resultat i `scores`), inte
  bara vänner.
- **Anta/ignorera:** en egen, synlig handling för mottagaren — till
  skillnad från vänskaps-inbjudan där själva länk-öppningen räknas som
  bekräftelse. Ignorera avvisar permanent och frigör en plats i taket
  för båda parter.
- **20 matcher på gång samtidigt**, räknat över alla ej avslutade
  (pending/accepted) utmaningar, skickade och mottagna, båda parter.
- **Vinst/förlust-statistik** slår ihop vänner och slumpmotståndare i
  samma per-motståndare-lista.

**Teknisk knäckfråga löst i planen:** 20-taket måste kunna räkna
*motpartens* öppna matcher också (annars går det att spamma en
populär slumpmotståndare långt förbi taket) — men vanliga RLS
`with check`-subfrågor mot samma tabell ärver tabellens egen
SELECT-policy, så en infogande användare kan inte se motpartens alla
rader. Lösning: en `security definer`-SQL-funktion
(`blixt_open_challenge_count`) som kringgår RLS vid räkningen, anropad
från insert-policyn.

**Status:** implementerat enligt planen (2026-07-19), migrationen applicerad
mot `skrammel-beta` 2026-07-20 (se nedan). `supabase/schema.sql`
och `supabase/migrations/20260719175714_add_blixt.sql` skriver
slutgiltiga schemat (`status`-kolumn, `opponent_id`, `blixt_open_challenge_count`).
Nya/ändrade filer: `src/game/blixtConstants.js`, `src/api/blixt.js`,
`src/game/adminSuggest.js` (parameteriserad, default oförändrad för
`AdminWordsScreen`), `GameScreen.jsx` (nya props `durationSeconds`/`showLevelBar`),
`BlixtScreen.jsx`/`BlixtChooseOpponentScreen.jsx`/`BlixtResultScreen.jsx` (nya),
`HomeScreen.jsx` (blinkande notis + Blixt-knapp), `FriendsScreen.jsx` (den
gamla platshållar-"Utmana"-knappen borttagen), `App.jsx` (ny state + handlers
+ skärmgrenar `blixt-play`/`blixt-choose`/`blixt-hub`/`blixt-respond-play`/`blixt-result`).
`npm run build` verifierat grönt. Migrationen (`supabase db push --linked --yes`)
kördes mot skrammel-beta 2026-07-20 — `blixt_challenges`/`blixt_scores`
finns nu på skarp databas. Committat och pushat (`19f8c2f`, plus uppföljande
UI-justeringar `9023121`/`efa206d`: en direkt "Spela blixt-Skrammel!"-knapp
på hemskärmen, gamla separata "Blixt"-navknappen borttagen). Användaren
testar själv live — inget formellt klick-test-protokoll rapporterat tillbaka.

**Ordkuration (2026-07-20):** källorden för Blixt upplevdes som "konstiga"
när de slumpas rent klient-sidan vid spelstart (samma `suggestSourceWord`
som `AdminWordsScreen` använder, men utan mänsklig granskning). Löst med
en kuraterad ordpool: ny tabell `blixt_words` (`word`, `findable_count`,
`approved`, RLS: publikt läsbar bara där `approved = true`, skriv begränsat
till adminmailen — se `supabase/migrations/20260720081641_add_blixt_words.sql`).
Ny admin-sida `/admin/blixt` (`src/screens/BlixtWordsAdminScreen.jsx`,
samma mönster som `/admin`s `AdminWordsScreen`): en knapp genererar 500
kandidatord (dedupear mot redan lagrade + mot varandra, kräver hittabart
antal inom `BLIXT_MIN_FINDABLE`–`BLIXT_MAX_FINDABLE`), en tabell med
Godkänn-kryssruta + Kasta-knapp per rad, filter Väntar/Godkända/Alla.
`src/api/blixtWords.js` är CRUD-lagret. `pickBlixtWord()` i `src/api/blixt.js`
är nu `async` — drar slumpmässigt (med upprepning tillåten) ur de godkända
orden via `fetchApprovedBlixtWords()`, och faller bara tillbaka på den gamla
rent klient-genererade vägen om poolen är tom (t.ex. innan admin hunnit
godkänna något) eller Supabase inte är konfigurerat. `handlePlayBlixt` i
`App.jsx` väntar nu in anropet. `npm run build` grönt. Migrationen körd
mot skrammel-beta, committat och pushat (`b4e544e`).

**Ordlängd ändrad till 8 (2026-07-20).** Användaren hade redan genererat
500 kandidater och godkänt 15 stycken på `/admin/blixt` innan de bad om
bytet från 6 till 8 bokstäver ("6 är för lite"). `BLIXT_WORD_LENGTH` = 8.
Testade fördelningen av hittabara ord för 8-bokstavsord i `ordlista.txt`
(300-sampel): median ~75, bara 44% föll inom det gamla 12–70-spannet —
höjde därför `BLIXT_MIN_FINDABLE`/`BLIXT_MAX_FINDABLE` till **30–120**
(användaren valde det rekommenderade alternativet). De gamla 497
6-bokstavsraderna i `blixt_words` (15 godkända, 482 väntande) städades
bort direkt mot skarp databas via Supabase Management API:s
`database/query`-endpoint (`POST /v1/projects/{ref}/database/query`,
samma access-token-flöde) eftersom `pickBlixtWord()` inte filtrerar på
ordlängd — annars hade gamla 6-bokstavsord kunnat dyka upp blandat med
nya 8-bokstavsrundor. Tabellen är nu tom; nästa "Generera 500 kandidater"
på `/admin/blixt` ger enbart 8-bokstavsord.

**Resultatflik med orddiff + radera oavslutade utmaningar (byggd i en
tidigare session, committat/pushat/migrerat 2026-07-21).** `BlixtScreen.jsx`
fick en flikad vy ("Ej spelade" / "Resultat") istället för en enda lång
lista. Resultat-fliken visar per motståndare: vunna/förlorade matcher,
poängjämförelse som staplar, och en orddiff (`wordDiff()`) — ord ni båda
hittade vs bara en av er, mer pedagogiskt än en rå siffra. Öppna
(ej avslutade) utmaningar döljs efter 48h (`OPEN_CHALLENGE_VISIBLE_MS`).
Oavslutade utmaningar kan raderas (`deleteChallenge` i `src/api/blixt.js`,
ny delete-policy `"Participants can delete their unplayed challenges"` i
`supabase/schema.sql` — status <> 'completed' som försvar på djupet, UI:t
erbjuder aldrig radering av avslutade matcher). Migration
`20260720120000_add_blixt_challenge_delete.sql` applicerad mot
`skrammel-beta`.

**Tiden-är-ute-modal med vinst/förlust (2026-07-21).** Tidigare hoppade
en Blixt-runda tyst till facit (`WordRevealModal`) när tiden tog slut —
ingen bekräftelse på att rundan var över. Ny `BlixtTimeUpModal.jsx` visas
först: "Tiden är ute!" plus, om motståndarens poäng redan är känd (svarar
man på en utmaning, `targetScore` satt), vann/förlorade/oavgjort med
poängjämförelse. Vid en ny oriktad runda (ingen motståndare än) visas bara
att rundan är klar. `GameScreen.jsx`s tangentbordslyssnare blockeras även
medan modalen syns.

**Hopfällda rader för flera utmaningar mot samma motståndare (2026-07-21).**
Man kan ha flera samtidiga Blixt-matcher mot samma person (ingen spärr
mot det i `createChallenge`), vilket svämmade över "Ej spelade"-listan.
`BlixtScreen.jsx` grupperar nu per motståndare inom varje sektion
(`groupByOpponent`) — en match visas som en vanlig rad, flera visas som
en hopfälld rad ("Namn (3)") som fälls ut vid klick och visar varje
matchs egna knappar (Spela/Anta/Ignorera/Ta bort) individuellt.

**Global/vän-topplista för Blixt + utmana vem som helst (2026-07-21).**
Ny `BlixtLeaderboardScreen.jsx` (Global/Vänner-flikar, samma mönster som
`LeaderboardScreen.jsx` för dagens ord), nåbar via en "Topplista"-knapp i
Blixt-huben. Rankar efter flest vunna matcher totalt. Eftersom RLS på
`blixt_challenges`/`blixt_scores` bara låter deltagare läsa sina egna
rader, aggregeras topplistan i en ny `security definer`-SQL-funktion
`blixt_leaderboard()` (självjoin på `blixt_scores` per `challenge_id`,
grupperat per `user_id`, räknar vinster/förluster/matcher/högsta poäng)
— exponerar bara summerade siffror per spelare, aldrig vem som mötte vem.
`fetchBlixtLeaderboard()`/`fetchFriendsBlixtLeaderboard()` i
`src/api/blixt.js` (vän-varianten filtrerar client-side på `fetchFriends`).
Varje rad har en "Utmana"-knapp (utom din egen) — fungerar mot **vem som
helst på listan, inte bara vänner**, eftersom `createChallenge` aldrig
haft en vänskapskontroll. Klick startar en ny blixt-runda
(`handleChallengeFromLeaderboard` i `App.jsx`, sätter `blixtPresetOpponent`)
och förifyller sen motståndaren som en highlightad knapp på
`BlixtChooseOpponentScreen` (`presetOpponent`-prop) — återanvänder samma
`handleChallengeFriend`/felhantering som vän-flödet, ingen ny
create-challenge-logik. Migration `20260721130000_add_blixt_leaderboard.sql`
applicerad mot `skrammel-beta`.

---

## Native app-plan (App Store / Google Play) — beslutad 2026-07-19

Användaren har bestämt att Skrammel ska bli en native app i
App Store och Google Play, inte bara en installerbar PWA. Vald metod:
**Capacitor** runt den befintliga React/Vite-koden (ingen omskrivning) —
samma princip som att återanvända minikors mönster: minsta nya
verktygslåda som löser jobbet.

**Fas 1 — Wrappa appen (kod, kan göras direkt i repot):**
- Lägg till `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`,
  `@capacitor/android`
- `capacitor.config.json` (`appId`, `appName`, `webDir: dist`)
- Koppla Androids hårdvaruknapp "tillbaka" till samma
  avslutalogik som `GameMenuModal.jsx` redan har — appen har inget
  react-router (bara state-baserad skärmväxling i `App.jsx`), så utan
  detta stänger tillbaka-knappen hela appen istället för att navigera
  bakåt i spelet
- Safe-area/status bar-styling för skärmar med hack/notch
- `public/ordlista.txt` byggs redan in i bundlen — ingen extra åtgärd
  behövs för att den ska funka offline i native-skalet

**Fas 2 — Visuell identitet för butikerna (design, inte kod ännu):**
- App-ikon och splash screen, utgår från `theme.js`s lime/coral-tema
- Skärmdumpar för butikslistorna

**Fas 3 — Konton & juridik (manuellt, kräver användaren):**
- Apple Developer-konto (99 USD/år)
- Google Play Console-konto (25 USD engångs)
- Integritetspolicy (obligatorisk i båda butikerna — Skrammel samlar
  in e-post vid signup)
- Åldersgräns/klassificering i respektive butik

**Fas 4 — Native build & test:**
- Xcode-projekt för iOS, TestFlight-beta
- Android Studio-projekt, signerad build, internt testspår i Play
  Console
- Riktig enhetstestning (inte bara webbläsare/Playwright)

**Fas 5 — Städning innan lansering:**
- Rensa kvarvarande testkonton i `skrammel-beta` (se "Städbehov" ovan)
- Överväg crash-/felrapportering (t.ex. Sentry) — finns inte idag

**Kända luckor identifierade 2026-07-19, inte blockerande för fortsatt
prototyp-användning men bör lösas innan butiksinlämning:** inga
app-ikoner/splash-assets finns än (`public/` har bara `ordlista.txt`),
ingen integritetspolicy skriven, kvarvarande testkonton i produktions-
Supabase, ingen crash-/felrapportering.
