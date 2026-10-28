-- Migración 07: link amigable por rifa (/rifa/iphone-17-pro)
alter table dinamicas add column if not exists slug text;

create or replace function slugify(t text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(t,''), 'áéíóúüñÁÉÍÓÚÜÑ´''', 'aeiouunAEIOUUN  ')),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- Asigna slug único al crear (o si viene vacío). Al editar el título NO cambia,
-- para que los links ya compartidos sigan funcionando.
create or replace function asignar_slug() returns trigger language plpgsql as $$
declare base text; cand text; i int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    new.slug := slugify(new.slug);
  else
    new.slug := slugify(new.titulo);
  end if;
  base := coalesce(nullif(new.slug, ''), 'rifa');
  cand := base;
  while exists (select 1 from dinamicas where slug = cand and id <> new.id) loop
    i := i + 1; cand := base || '-' || i;
  end loop;
  new.slug := cand;
  return new;
end $$;

drop trigger if exists trg_slug on dinamicas;
create trigger trg_slug before insert or update of slug on dinamicas
  for each row execute function asignar_slug();

-- Rellenar las rifas que ya existen
update dinamicas set slug = null where slug is null;  -- dispara el trigger
do $$ declare r record; begin
  for r in select id from dinamicas where slug is null or slug = '' order by created_at loop
    update dinamicas set slug = '' where id = r.id;
  end loop;
end $$;

alter table dinamicas alter column slug set not null;
create unique index if not exists dinamicas_slug_key on dinamicas (slug);
