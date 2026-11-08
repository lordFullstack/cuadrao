# Caja del Día
App para registrar gastos, transferencias y efectivo del negocio y sacar el cuadre del día como en el cuaderno:

    Gastos + Transferencias + Efectivo = Total
    Total − Base = Venta del día
    Saldo (ganancia) = Venta − Gastos

Synaptix AI Labs — Programando con Sistemas Inteligentes

## Archivos
- `index.html` — toda la app (React 18.2.0 por CDN + Babel standalone).
- `manifest.webmanifest`, `icon.svg`, `sw.js` — para instalarla como app (PWA).
- `supabase/schema.sql` — tablas para la migración futura (NO correr todavía).
- `docs/equipo/ESTADO.md` — bitácora del equipo.

## Publicar en GitHub Pages
1. Crear el repo `caja-del-dia` en lordfullstack y subir todos los archivos.
2. Settings → Pages → Branch `main` / carpeta raíz.
3. Abrir `https://lordfullstack.github.io/caja-del-dia/` en el celular → "Agregar a pantalla de inicio".
4. En cada entrega nueva, subir `VERSION` en `sw.js` para que el celular no se quede con la versión vieja.

## Datos
Se guardan SOLO en ese celular (localStorage, llave `cajadia:v1`). Si borran los datos del navegador se pierden:
descargar un respaldo cada semana desde Reportes → "Descargar respaldo".

Forma de los datos (mismos nombres que en Supabase):
- `dias`: id, fecha, base, efectivo, estado (abierto/cerrado), cerrado_en, creado_en, actualizado_en
- `gastos`: id, dia_id, concepto, monto, creado_en
- `transferencias`: id, dia_id, monto, nota, creado_en
- `config`: base_por_defecto, conceptos

## Migración a Supabase (futuro)
1. Definir login y `negocio_id`; revisión de Seguridad para las políticas RLS.
2. Correr `supabase/schema.sql` (en el free tier ya hay 2 proyectos activos: usar un esquema dentro de uno existente).
3. Importar el respaldo JSON a las tablas (los nombres coinciden 1 a 1).
4. Cambiar solo el objeto `repo` de `index.html` por llamadas a Supabase.
