-- Migración 02: verificador por dinámica (teléfono o número) + resultados públicos
-- Ejecutar en SQL Editor DESPUÉS de schema.sql

alter table dinamicas add column if not exists fuente_resultado text;   -- ej. 'Pick 4 New York · Noche'
alter table dinamicas add column if not exists fecha_resultado date;

-- Enmascara nombre: "María Pérez" -> "María P."
create or replace function enmascarar(n text) returns text language sql immutable as $$
  select split_part(trim(n),' ',1) ||
    case when split_part(trim(n),' ',2) <> '' then ' ' || left(split_part(trim(n),' ',2),1) || '.' else '' end;
$$;

-- Verificar por teléfono (10 dígitos) o por número asignado, dentro de una dinámica
drop function if exists verificar(text);
create or replace function verificar(p_dinamica uuid, p_query text)
returns table (numero int, estado text, nombre text, es_ganador boolean)
language plpgsql security definer as $$
declare q text := regexp_replace(coalesce(p_query,''), '\D', '', 'g');
begin
  if length(q) = 0 then return; end if;
  if length(q) >= 10 then
    return query
      select n.numero, c.estado, enmascarar(c.nombre), n.numero = d.numero_ganador
      from compras c join numeros n on n.compra_id = c.id join dinamicas d on d.id = c.dinamica_id
      where c.dinamica_id = p_dinamica and c.telefono = right(q,10) and c.estado in ('aprobada','pendiente')
      order by n.numero;
  else
    -- por número: devuelve solo ese número (sin exponer el resto de la compra)
    return query
      select n.numero, c.estado, enmascarar(c.nombre), n.numero = d.numero_ganador
      from numeros n join compras c on c.id = n.compra_id join dinamicas d on d.id = n.dinamica_id
      where n.dinamica_id = p_dinamica and n.numero = q::int and c.estado in ('aprobada','pendiente');
  end if;
end $$;

-- Resultados públicos de dinámicas sorteadas
create or replace function resultados()
returns table (id uuid, titulo text, numero_ganador int, total_numeros int, fuente_resultado text,
               fecha_resultado date, ganador text, vendido boolean)
language sql security definer as $$
  select d.id, d.titulo, d.numero_ganador, d.total_numeros, d.fuente_resultado, d.fecha_resultado,
         enmascarar(c.nombre), c.id is not null
  from dinamicas d
  left join numeros n on n.dinamica_id = d.id and n.numero = d.numero_ganador
  left join compras c on c.id = n.compra_id and c.estado = 'aprobada'
  where d.estado = 'sorteada' and d.numero_ganador is not null
  order by coalesce(d.fecha_resultado, d.created_at::date) desc;
$$;

grant execute on function verificar(uuid, text), resultados() to anon, authenticated;
