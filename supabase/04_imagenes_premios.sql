-- Migración 04: bucket público para imágenes de premios (WebP)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('premios', 'premios', true, 3145728, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 3145728,
  allowed_mime_types = array['image/webp','image/jpeg','image/png'];

drop policy if exists "admin subir premios" on storage.objects;
drop policy if exists "admin editar premios" on storage.objects;
drop policy if exists "admin borrar premios" on storage.objects;

create policy "admin subir premios" on storage.objects for insert to authenticated
  with check (bucket_id = 'premios' and es_admin());
create policy "admin editar premios" on storage.objects for update to authenticated
  using (bucket_id = 'premios' and es_admin());
create policy "admin borrar premios" on storage.objects for delete to authenticated
  using (bucket_id = 'premios' and es_admin());
-- Lectura: el bucket es público, se sirve por URL pública.
