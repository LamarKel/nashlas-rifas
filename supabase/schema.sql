-- Plataforma de rifas — esquema Supabase (Postgres)
-- Ejecutar en el SQL Editor de Supabase.

create extension if not exists pgcrypto;

-- Dinámicas (sorteos)
create table dinamicas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  imagen_url text,
  precio_numero numeric(10,2) not null check (precio_numero > 0),
  total_numeros int not null check (total_numeros > 0),   -- ej. 10000 => 0000..9999
  min_compra int not null default 2,
  fecha_sorteo timestamptz,
  estado text not null default 'activa' check (estado in ('borrador','activa','cerrada','sorteada')),
  numero_ganador int,
  created_at timestamptz default now()
);

-- Paquetes por dinámica
create table paquetes (
  id uuid primary key default gen_random_uuid(),
  dinamica_id uuid references dinamicas(id) on delete cascade,
  nombre text not null,          -- ROOKIE, PRO, ...
  cantidad int not null,
  etiqueta text,                  -- POPULAR, VIP...
  orden int default 0
);

-- Cuentas bancarias
create table metodos_pago (
  id uuid primary key default gen_random_uuid(),
  banco text not null,
  tipo_cuenta text,
  numero_cuenta text not null,
  titular text not null,
  cedula_rnc text,
  activo boolean default true,
  orden int default 0
);

-- Compras
create table compras (
  id uuid primary key default gen_random_uuid(),
  dinamica_id uuid references dinamicas(id) not null,
  nombre text not null,
  telefono text not null check (telefono ~ '^[0-9]{10}$'),
  cantidad int not null,
  total numeric(10,2) not null,
  metodo_pago_id uuid references metodos_pago(id),
  comprobante_path text not null,
  referencia text,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  motivo_rechazo text,
  created_at timestamptz default now(),
  validada_at timestamptz
);
create index on compras (telefono);
create index on compras (dinamica_id, estado);

-- Números asignados (únicos por dinámica)
create table numeros (
  dinamica_id uuid references dinamicas(id) on delete cascade,
  numero int not null,
  compra_id uuid references compras(id) on delete cascade,
  primary key (dinamica_id, numero)
);

-- Admins (usuarios de Supabase Auth)
create table admins (user_id uuid primary key references auth.users(id));

create or replace function es_admin() returns boolean
language sql stable security definer as $$
  select exists(select 1 from admins where user_id = auth.uid());
$$;

-- ===== Crear compra (público) =====
-- Valida, calcula total en el servidor y reserva números al azar sin duplicados.
create or replace function crear_compra(
  p_dinamica uuid, p_nombre text, p_telefono text, p_cantidad int,
  p_metodo uuid, p_comprobante text, p_referencia text
) returns json language plpgsql security definer as $$
declare d dinamicas; v_compra uuid; v_nums int[];
begin
  select * into d from dinamicas where id = p_dinamica for update;
  if d.id is null or d.estado <> 'activa' then raise exception 'Dinámica no disponible'; end if;
  if p_cantidad < d.min_compra then raise exception 'Compra mínima: % números', d.min_compra; end if;

  insert into compras (dinamica_id, nombre, telefono, cantidad, total, metodo_pago_id, comprobante_path, referencia)
  values (p_dinamica, trim(p_nombre), p_telefono, p_cantidad, p_cantidad * d.precio_numero, p_metodo, p_comprobante, p_referencia)
  returning id into v_compra;

  with libres as (
    select g as n from generate_series(0, d.total_numeros - 1) g
    where not exists (select 1 from numeros x where x.dinamica_id = p_dinamica and x.numero = g)
    order by random() limit p_cantidad
  ), ins as (
    insert into numeros (dinamica_id, numero, compra_id)
    select p_dinamica, n, v_compra from libres returning numero
  ) select array_agg(numero order by numero) into v_nums from ins;

  if coalesce(array_length(v_nums,1),0) < p_cantidad then
    raise exception 'No quedan suficientes números disponibles';
  end if;

  return json_build_object('compra_id', v_compra, 'numeros', v_nums, 'total', p_cantidad * d.precio_numero);
end $$;

-- ===== Verificador (público): solo números aprobados =====
create or replace function verificar(p_telefono text)
returns table (dinamica text, numero int, estado text) language sql security definer as $$
  select d.titulo, n.numero, c.estado
  from compras c join numeros n on n.compra_id = c.id join dinamicas d on d.id = c.dinamica_id
  where c.telefono = p_telefono and c.estado in ('aprobada','pendiente')
  order by d.created_at desc, n.numero;
$$;

-- ===== Admin: aprobar / rechazar =====
create or replace function validar_compra(p_compra uuid, p_aprobar boolean, p_motivo text default null)
returns void language plpgsql security definer as $$
begin
  if not es_admin() then raise exception 'No autorizado'; end if;
  update compras set estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
    motivo_rechazo = p_motivo, validada_at = now() where id = p_compra;
  if not p_aprobar then delete from numeros where compra_id = p_compra; end if; -- libera números
end $$;

-- Disponibilidad (público)
create or replace function disponibles(p_dinamica uuid) returns int language sql security definer as $$
  select d.total_numeros - (select count(*) from numeros where dinamica_id = d.id)::int
  from dinamicas d where d.id = p_dinamica;
$$;

-- ===== RLS =====
alter table dinamicas enable row level security;
alter table paquetes enable row level security;
alter table metodos_pago enable row level security;
alter table compras enable row level security;
alter table numeros enable row level security;
alter table admins enable row level security;

create policy "leer dinamicas" on dinamicas for select using (estado <> 'borrador' or es_admin());
create policy "leer paquetes" on paquetes for select using (true);
create policy "leer metodos" on metodos_pago for select using (activo or es_admin());
create policy "admin dinamicas" on dinamicas for all using (es_admin()) with check (es_admin());
create policy "admin paquetes" on paquetes for all using (es_admin()) with check (es_admin());
create policy "admin metodos" on metodos_pago for all using (es_admin()) with check (es_admin());
create policy "admin compras" on compras for select using (es_admin());
create policy "admin numeros" on numeros for select using (es_admin());
create policy "admin admins" on admins for select using (es_admin());
-- Compras y números del público solo entran vía crear_compra().

grant execute on function crear_compra, verificar, disponibles to anon, authenticated;
grant execute on function validar_compra to authenticated;

-- ===== Storage para comprobantes (privado) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict do nothing;

create policy "subir comprobante" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'comprobantes');
create policy "admin ver comprobantes" on storage.objects for select
  using (bucket_id = 'comprobantes' and es_admin());
