-- Kuraterad ordpool för Blixtpussel-källord (ersätter den gamla
-- rent klient-slumpade suggestSourceWord()-vägen, se src/api/blixt.js).
-- Admin genererar kandidater i bulk på /admin/blixt, godkänner de bra
-- (approved = true) och kastar resten (delete) — pickBlixtWord() drar
-- sen slumpmässigt bland de godkända, med upprepning tillåten precis
-- som dagens ord-generatorn kan slumpa fram samma ord flera gånger.
create table blixt_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  findable_count int not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table blixt_words enable row level security;

-- Bara godkända ord är läsbara publikt (klienten slumpar bland dem vid
-- spelstart) — okuraterade kandidater ska inte läcka ut innan admin sett dem.
create policy "Public can read approved blixt_words"
  on blixt_words for select
  using (approved = true);

-- "for all" täcker även select, så adminen ser okuraterade rader också
-- (den publika policyn ovan läggs bara till, inte ersätter, för alla andra).
create policy "Only admin can write blixt_words"
  on blixt_words for all
  using (auth.jwt() ->> 'email' = 'themusclemen@gmail.com')
  with check (auth.jwt() ->> 'email' = 'themusclemen@gmail.com');
