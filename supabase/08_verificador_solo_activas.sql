-- Migración 08: el verificador público solo responde para rifas activas
create or replace function verificar(p_dinamica uuid, p_query text)
returns table (numero int, estado text, nombre text, es_ganador boolean)
language plpgsql security definer as $$
declare q text := regexp_replace(coalesce(p_query,''), '\D', '', 'g');
begin
  if length(q) = 0 then return; end if;
  if not exists (select 1 from dinamicas where id = p_dinamica and estado = 'activa') then return; end if;
  if length(q) >= 10 then
    return query
      select n.numero, c.estado, enmascarar(c.nombre), n.numero = d.numero_ganador
      from compras c join numeros n on n.compra_id = c.id join dinamicas d on d.id = c.dinamica_id
      where c.dinamica_id = p_dinamica and c.telefono = right(q,10) and c.estado in ('aprobada','pendiente')
      order by n.numero;
  else
    return query
      select n.numero, c.estado, enmascarar(c.nombre), n.numero = d.numero_ganador
      from numeros n join compras c on c.id = n.compra_id join dinamicas d on d.id = n.dinamica_id
      where n.dinamica_id = p_dinamica and n.numero = q::int and c.estado in ('aprobada','pendiente');
  end if;
end $$;
