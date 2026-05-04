drop policy if exists "inmobiliarias_select_anon" on public.inmobiliarias;

create policy "inmobiliarias_select_anon"
on public.inmobiliarias
for select
to anon, authenticated
using (true);