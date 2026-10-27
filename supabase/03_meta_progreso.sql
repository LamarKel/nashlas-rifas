-- Migración 03: meta de venta para la barra de progreso
-- Ejecutar en SQL Editor DESPUÉS de 02.

alter table dinamicas add column if not exists meta_numeros int check (meta_numeros is null or meta_numeros > 0);
alter table dinamicas add column if not exists contar_pendientes boolean not null default true;

-- Progreso público: vendidos vs meta (si no hay meta, usa total_numeros)
create or replace function progreso(p_dinamica uuid)
returns json language sql security definer as $$
  select json_build_object(
    'vendidos', (select count(*) from numeros n join compras c on c.id = n.compra_id
                 where n.dinamica_id = d.id
                   and (c.estado = 'aprobada' or (d.contar_pendientes and c.estado = 'pendiente'))),
    'meta', coalesce(d.meta_numeros, d.total_numeros),
    'disponibles', d.total_numeros - (select count(*) from numeros where dinamica_id = d.id)
  )
  from dinamicas d where d.id = p_dinamica;
$$;

grant execute on function progreso(uuid) to anon, authenticated;
