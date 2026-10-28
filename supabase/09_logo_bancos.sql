-- Migración 09: logo/icono por cuenta bancaria
alter table metodos_pago add column if not exists logo_url text;
-- Los logos se guardan en el bucket público 'premios' (carpeta bancos/), creado en la 04.
