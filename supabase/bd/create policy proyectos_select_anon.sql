drop policy if exists "proyectos_select_anon" on public.proyectos;

create policy "proyectos_select_anon"
on public.proyectos
for select
to anon, authenticated
using (true);