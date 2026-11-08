-- Caja del Día — esquema para la FUTURA migración a Supabase.
-- NO correr todavía. Hoy la app guarda en localStorage con estos MISMOS nombres de tabla y columna
-- (llave 'cajadia:v1' → { version, config, dias[], gastos[], transferencias[] }).
-- Antes de migrar: definir login (Supabase Auth) y pasar por revisión de Seguridad (RLS).

create schema if not exists caja_dia;

create table caja_dia.dias (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null,                 -- dueño de los datos (para RLS); en local no existe
  fecha           date not null,
  base            bigint not null default 0 check (base >= 0),
  efectivo        bigint not null default 0 check (efectivo >= 0),
  estado          text   not null default 'abierto' check (estado in ('abierto','cerrado')),
  cerrado_en      timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (negocio_id, fecha)
);

create table caja_dia.gastos (
  id         uuid primary key default gen_random_uuid(),
  dia_id     uuid not null references caja_dia.dias(id) on delete cascade,
  concepto   text not null check (char_length(concepto) between 1 and 40),
  monto      bigint not null check (monto > 0),
  creado_en  timestamptz not null default now()
);

create table caja_dia.transferencias (
  id         uuid primary key default gen_random_uuid(),
  dia_id     uuid not null references caja_dia.dias(id) on delete cascade,
  monto      bigint not null check (monto > 0),
  nota       text default '',
  creado_en  timestamptz not null default now()
);

create index on caja_dia.gastos (dia_id);
create index on caja_dia.transferencias (dia_id);

-- Vista con el cuadre del cuaderno: Gastos + Transferencias + Efectivo − Base = Venta del día
create view caja_dia.cuadre_diario with (security_invoker = true) as
select d.id, d.negocio_id, d.fecha, d.estado, d.base, d.efectivo,
       coalesce(g.total, 0) as gastos,
       coalesce(t.total, 0) as transferencias,
       coalesce(g.total, 0) + coalesce(t.total, 0) + d.efectivo - d.base as venta,
       coalesce(t.total, 0) + d.efectivo - d.base as ganancia
from caja_dia.dias d
left join (select dia_id, sum(monto) total from caja_dia.gastos group by dia_id) g on g.dia_id = d.id
left join (select dia_id, sum(monto) total from caja_dia.transferencias group by dia_id) t on t.dia_id = d.id;

alter table caja_dia.dias           enable row level security;
alter table caja_dia.gastos         enable row level security;
alter table caja_dia.transferencias enable row level security;
-- Políticas RLS: se escriben en la migración, cuando exista el login (pendiente de Seguridad).
