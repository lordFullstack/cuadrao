# ESTADO — Cuadrao (antes Caja del Día)
Última actualización: 2026-11-07 (America/Bogota)

| Tarea | Estado |
|---|---|
| CUA-001 Rebranding a Cuadrao (nombre, logo, colores, splash, íconos PNG) | Hecho |
| CUA-002 Sin internet: React, fuente e íconos locales; build precompilado (sin Babel en el celular) | Hecho |
| CUA-003 Copia de seguridad: enviar por compartir, restaurar con confirmación, aviso a los 7 días | Hecho |
| CUA-004 Primer uso guiado (nombre, tipo de negocio, conceptos, base, ejemplo) + pantalla Ajustes | Hecho |
| CUA-005 Reporte compartible del día y del mes (imagen PNG y PDF) | Hecho |
| CUA-006 Prueba de punta a punta (`npm test`, 16 revisiones) | En verde (Edge, escritorio) |
| CUA-007 Prueba en celular real: compartir por WhatsApp, PDF, instalar en inicio | ESPERA_JORGE |
| CUA-008 Publicar en GitHub Pages (https://lordfullstack.github.io/cuadrao/) | Hecho; falta enlazarlo desde Hotmart |

Decisiones:
- Se parte de la PWA (no de la versión nativa Kotlin). La nativa queda como opción para Play Store.
- Se conserva la llave `cajadia:v1`: quien ya usaba Caja del Día entra sin bienvenida y no pierde nada.
- Los días nuevos arrancan con la base de Ajustes (antes copiaban la del día anterior).
- Corregido un error heredado: en Reportes, abrir un día rompía la app (el total de gastos pisaba la lista).
