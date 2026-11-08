# Cuadrao
*La caja cuadrá, la plata clara* · por Synaptix AI Labs

App (PWA) para registrar gastos, transferencias y efectivo de un negocio y sacar el cuadre del día como en el cuaderno:

    Gastos + Transferencias + Efectivo = Total
    Total − Base = Venta del día
    Ganancia (saldo) = Venta − Gastos

Antes se llamaba "Caja del Día". El original quedó sin tocar en `Descargas\caja-del-dia`.

## Qué trae
- **Splash** de 1,5 s con el logo que se dibuja, el eslogan y "por Synaptix AI Labs".
- **Primer uso guiado**: nombre del negocio, tipo de negocio (con conceptos de gasto sugeridos y editables), base de caja y un día de ejemplo opcional.
- **Registro / Hoy / Reportes**, igual que antes, con la marca nueva.
- **Copia de seguridad** en Ajustes (⚙): "Enviar copia" abre el menú de compartir del celular (WhatsApp, correo, Drive) y "Restaurar una copia" pide confirmación mostrando qué trae. Si pasan 7 días sin copia, aparece un aviso amarillo en Registro.
- **Reporte compartible**: el cuadre del día o el resumen del mes como imagen (para WhatsApp) o PDF.
- **Funciona sin internet**: todo (React, fuente, íconos) va dentro de la app y el service worker lo guarda.

## Carpetas
| Ruta | Qué hay |
|---|---|
| `src/app.jsx` | Toda la app (React 18 sin bundler). |
| `src/index.html` | Estilos, splash y carga de scripts. |
| `src/marca.mjs` | Nombre, eslogan, colores y trazos del logo (un solo lugar). |
| `src/sw.js`, `src/manifest.webmanifest` | PWA: uso sin internet e instalación. |
| `scripts/build.mjs` | Arma `dist/` (lo que se publica). |
| `scripts/serve.mjs` | Servidor local en http://localhost:5180 |
| `scripts/prueba.mjs` | Prueba de punta a punta (16 revisiones) con Edge. |
| `supabase/schema.sql` | Tablas para la migración futura (NO correr todavía). |

## Trabajar
    npm install
    npm run build      # genera dist/
    npm run serve      # http://localhost:5180
    npm test           # con el servidor arriba; deja capturas en prueba-salida/

Para verla en el celular por USB: `adb reverse tcp:5180 tcp:5180` y abrir http://localhost:5180 en Chrome.

## Publicar
Publicada en **https://lordfullstack.github.io/cuadrao/**. Cada push a `main` arma `dist/` y lo publica solo (`.github/workflows/publicar.yml`). La versión del service worker cambia en cada build, así los celulares bajan la nueva.

## Datos
Viven solo en el celular (localStorage, llave `cajadia:v1`, la misma de Caja del Día para no perder datos).
- `dias`: id, fecha, base, efectivo, estado, cerrado_en, creado_en, actualizado_en (y `ejemplo: true` solo en el día de ejemplo)
- `gastos`: id, dia_id, concepto, monto, creado_en
- `transferencias`: id, dia_id, monto, nota, creado_en
- `config`: base_por_defecto, conceptos, nombre_negocio, tipo_negocio, bienvenida_hecha, ultima_copia

La copia de seguridad es ese mismo JSON en un archivo `.txt` (Android solo deja compartir ciertos tipos de archivo). Se pueden restaurar copias `.json` viejas de Caja del Día.
