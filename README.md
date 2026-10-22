# Nashla´s Shop — Dinámicas

React + Vite + Supabase.

## Rutas
- `/` dinámica activa, paquetes y compra con comprobante
- `/verificador` consulta de números por teléfono
- `/admin` panel: validar compras, dinámicas, cuentas, marcar ganador

## Setup
1. En Supabase > SQL Editor: ejecutar `supabase/schema.sql` y luego `supabase/seed.sql` (prueba).
2. Auth > Users > crear usuario admin y correr el `insert into admins` del final de seed.sql.
3. `cp .env.example .env` y poner URL y anon key del proyecto.
4. `npm install && npm run dev`

## Deploy (Vercel)
Importar el repo, agregar las 2 variables `VITE_SUPABASE_*`. `vercel.json` ya maneja las rutas.

## Migrar a la cuenta de la clienta
Exportar con DBeaver (o `pg_dump`) los schemas `public` y los objetos de `storage` (bucket + policies),
o simplemente correr `schema.sql` en el proyecto nuevo y migrar solo los datos. Cambiar el `.env`.
