create table public.proyectos (
    id int4 primary key,
    id_inmobiliaria int4 references public.inmobiliarias(id),
    codigo text not null,
    nombre text not null,
    nombre_inmobiliaria text,
    estado text,
    synced_at timestamptz default now()
)