-- Migración 06: resumen de ventas por rifa (solo admin)
create or replace function resumen_ventas()
returns table (id uuid, titulo text, estado text, total_numeros int, meta int,
               vendidos bigint, pendientes bigint, disponibles bigint,
               compras_aprobadas bigint, recaudado numeric)
language plpgsql stable security definer as $$
begin
  if not es_admin() then raise exception 'No autorizado'; end if;
  return query
  select d.id, d.titulo, d.estado, d.total_numeros,
         coalesce(d.meta_numeros, d.total_numeros),
         count(n.numero) filter (where c.estado = 'aprobada'),
         count(n.numero) filter (where c.estado = 'pendiente'),
         d.total_numeros - count(n.numero),
         (select count(*) from compras x where x.dinamica_id = d.id and x.estado = 'aprobada'),
         coalesce((select sum(x.total) from compras x where x.dinamica_id = d.id and x.estado = 'aprobada'), 0)
  from dinamicas d
  left join numeros n on n.dinamica_id = d.id
  left join compras c on c.id = n.compra_id
  group by d.id
  order by (d.estado = 'activa') desc, d.created_at desc;
end $$;

revoke execute on function resumen_ventas() from anon;
grant execute on function resumen_ventas() to authenticated;
