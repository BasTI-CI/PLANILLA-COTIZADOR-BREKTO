create table public.inmobiliarias (
    id int4 primary key,
    codigo text not null,
    nombre text not null,
    synced_at timestamptz default now()
);
