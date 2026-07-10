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

## Öppna frågor (ej beslutade än)

- Hur källordet för varje dag väljs/kureras (manuellt likt minikors
  puzzles, eller genererat?). Ett kureringsscript finns nu
  (`scripts/findWordsIn.mjs`) för att se hur många ord ett kandidatord ger.
- Om repriser/omspel av samma dags ord ska vara tillåtna, och om det i så
  fall påverkar topplistan (minikors-mönstret är att bara första
  försöket räknas).
- Streak-system, vänner/utmaningar, delning — inget av detta är avgjort
  för Skrammel än (kan bli aktuellt senare, liknande minikors
  funktioner).
