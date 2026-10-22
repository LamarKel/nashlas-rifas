-- Datos de PRUEBA — borrar antes de producción
insert into metodos_pago (banco, tipo_cuenta, numero_cuenta, titular, cedula_rnc, orden) values
 ('Banco Popular', 'Ahorros',   '000-000000-0', 'Nashla Prueba', '000-0000000-0', 0),
 ('Banreservas',   'Ahorros',   '0000000000',   'Nashla Prueba', '000-0000000-0', 1),
 ('BHD',           'Corriente', '00000000000',  'Nashla Prueba', '000-0000000-0', 2);

with d as (
  insert into dinamicas (titulo, descripcion, precio_numero, total_numeros, min_compra, fecha_sorteo, estado)
  values ('Dinámica de Prueba', 'Premio de ejemplo. Sorteo en vivo por Instagram @nashlasshop.', 50, 10000, 2, now() + interval '14 days', 'activa')
  returning id
)
insert into paquetes (dinamica_id, nombre, cantidad, etiqueta, orden)
select d.id, p.nombre, p.cantidad, p.etiqueta, p.orden from d, (values
 ('BRONCE',2,null,0),('PLATA',5,null,1),('ORO',10,'POPULAR',2),('PLATINO',15,null,3),
 ('DIAMANTE',25,'VIP',4),('ÉLITE',50,null,5),('LEYENDA',100,'MÁXIMO',6)) as p(nombre,cantidad,etiqueta,orden);

-- Hacer admin: crea el usuario en Auth > Users y luego:
-- insert into admins (user_id) select id from auth.users where email = 'correo@ejemplo.com';
