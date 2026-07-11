# Skrammel — Arkitektur

## Översikt

Skrammel är ett dagligt svenskt ordspel för mobilen. Se `skrammel-spec.md`
för spelregler.

**Nuläge:** Grundläggande kodstruktur och skärmflöde skapat lokalt.
Ingen Supabase-backend uppsatt än, men appen är nu robust mot det —
den körs och har testats framgångsrikt i en riktig browser i gäst-läge
(se "Lokal körning utan backend" nedan).

---

## Tech stack

Samma stack som minikors (syskonprojekt, `../minikors`):

| Lager | Teknik |
|-------|--------|
| Frontend | React 18 + Vite |
| Språk | JavaScript (JSX) |
| Styling | Inline styles (temaobjekt `T` i `src/theme.js`) |
| Backend / DB | Supabase (Postgres + auto-genererat REST API) — **projekt ej skapat än** |
| Auth | Supabase Auth (email/lösenord), valfritt — gäster kan spela |
| Hosting frontend | Vercel (planerat, ej uppsatt) |

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
│   │   ├── constants.js     # MIN_WORD_LENGTH, GAME_DURATION_SECONDS, FALLBACK_WORD
│   │   ├── letters.js       # letterCounts, canFormWord (multiset-check)
│   │   ├── scoring.js       # scoreForWord, totalScore, isScorable
│   │   ├── wordList.js      # Laddar public/ordlista.txt till ett Set, isValidWord
│   │   ├── findWords.js     # findWordsInSource — kureringshjälp + histogramdata (se nedan)
│   │   └── evaluateGuess.js # Kombinerar allt ovan till ett GuessResult
│   ├── api/                 # Supabase-anrop, en modul per behov
│   │   ├── dailyWord.js     # fetchTodaysWord
│   │   ├── scores.js        # submitScore, fetchLeaderboard
│   │   └── profile.js       # fetchDisplayName
│   ├── components/
│   │   └── WordLengthHistogram.jsx  # Stapeldiagram, en stapel per ordlängd (se nedan)
│   └── screens/
│       ├── HomeScreen.jsx
│       ├── GameScreen.jsx       # Timer + tryck-på-bokstäver-inmatning (se nedan)
│       ├── ResultScreen.jsx
│       ├── LeaderboardScreen.jsx
│       └── AuthScreen.jsx       # Enkel email/lösenord, "Fortsätt som gäst"
├── public/
│   └── ordlista.txt         # Svensk ordlista, 70k+ ord (se "Ordlista" nedan)
├── scripts/
│   └── findWordsIn.mjs      # CLI-verktyg: node scripts/findWordsIn.mjs LÄSKEDRYCK
├── architecture.md          # Det här dokumentet
└── skrammel-spec.md         # Produkt-spec
```

---

## Datamodell (planerad, ej skapad i Supabase än)

### Tabell: `daily_words`

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| date | date (PK) | Format `YYYY-MM-DD` |
| word | text | Källordet, versaler |
| created_at | timestamp | Auto |

### Tabell: `scores`

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| user_id | uuid (FK → auth.users) | |
| date | text | Format `YYYY-MM-DD` |
| score | int | Total poäng |
| words_found | jsonb | Array av hittade ord |
| display_name | text | Visningsnamn vid speltillfället (denormaliserat, som i minikors) |
| created_at | timestamp | Auto |

RLS (planerat, mirroring minikors):
- `SELECT`: publik (för topplistan)
- `INSERT`: endast autentiserad användare, egna rader

### Tabell: `profiles`

Samma mönster som minikors: `id` (uuid = auth.uid), `display_name`
(unique), `updated_at`.

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

## Spelskärmens interaktion (mobilanpassad)

`GameScreen.jsx` använder tryck-på-bokstäver istället för tangentbord,
för att fungera bra på mobil:

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

**Kurering:** `scripts/findWordsIn.mjs <ORD>` listar alla ord i
`ordlista.txt` som går att bilda ur ett kandidat-källord, grupperat
per längd. Användbart innan ett ord publiceras som dagens ord — t.ex.
`node scripts/findWordsIn.mjs ANDROID` ger 60 hittabara ord (2–6
bokstäver), en rimlig nivå för 5 minuter. Samma logik
(`findWordsInSource` i `src/game/findWords.js`) kan återanvändas för
att t.ex. visa ett facit i appen senare — inte byggt än.

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
- `api/profile.js` → `fetchDisplayName` → `null`
- `AuthScreen` visar "Inloggning ej tillgänglig" istället för ett
  trasigt formulär

Verifierat i browser (Playwright-smoketest): hemskärm, spela-loop
(giltigt/ogiltigt ord ger rätt feedback), topplista (tomt-state) och
auth-skärmen fungerar alla utan `.env`, inga konsolfel.

---

## Öppna beslut / att göra härnäst

1. Koppla GitHub-repot (`themusclemen/skrammel`, privat) till Vercel —
   sista steget i deploy-kedjan, se `~/.claude/plans/twinkly-splashing-glacier.md`
   för hela planen. `vercel.json` har redan SPA-rewrite på plats.
2. Städa testkonton/testresultat i `skrammel-beta` (se ovan) innan
   riktiga betatestare bjuds in.
3. Bestäm hur dagens källord väljs/kureras (ordlistan och
   kureringsscriptet finns nu — processen för att faktiskt välja och
   publicera ett ord per dag är inte byggd). `daily_words`-tabellen är
   tom, så appen kör på `FALLBACK_WORD` tills en rad finns för dagens
   datum.
4. Ordlistan är fortfarande inte 100% genomgången — den kan innehålla
   ovanliga böjningsformer eller enstaka konstigheter som dyker upp
   under spel. Justera `public/ordlista.txt` vid behov.
