/* Cuadrao — app (React 18 sin bundler: React y ReactDOM llegan como globales desde vendor/).
   El build antepone `const MARCA = {...}` (ver src/marca.mjs) y `const VERSION_APP = '...'`. */
const { useState, useEffect, useMemo, useRef, useId } = React;

/* ===================== CALC-START (lógica pura) ===================== */
const VERSION_DATOS = 1;
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS_SEM = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_CORTO = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

// Conceptos sugeridos según el tipo de negocio (se pueden editar en el primer uso y en Ajustes)
const TIPOS = {
  restaurante: { nombre: 'Restaurante o comidas', ej: 'Corrientazo, asadero, fritos', conceptos: ['Carnes y pollo', 'Verduras', 'Bebidas', 'Gas', 'Desechables', 'Sueldos', 'Otro'] },
  tienda: { nombre: 'Tienda o minimercado', ej: 'Tienda, miscelánea, licorera', conceptos: ['Mercancía', 'Bebidas', 'Bolsas', 'Transporte', 'Servicios', 'Sueldos', 'Otro'] },
  belleza: { nombre: 'Peluquería o belleza', ej: 'Peluquería, barbería, uñas', conceptos: ['Productos', 'Insumos', 'Lavandería', 'Servicios', 'Arriendo', 'Sueldos', 'Otro'] },
  otro: { nombre: 'Otro negocio', ej: 'Taller, papelería, ventas', conceptos: ['Compras', 'Insumos', 'Transporte', 'Servicios', 'Arriendo', 'Sueldos', 'Otro'] }
};
const CONCEPTOS_POR_DEFECTO = TIPOS.otro.conceptos;
const MAX_CONCEPTOS = 12;
const DIAS_AVISO_COPIA = 7;

function formatoPesos(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '−' : '') + s;
}
function leerMonto(texto) {
  const solo = String(texto ?? '').replace(/\D/g, '').slice(0, 12);
  return solo ? parseInt(solo, 10) : 0;
}
function hoyBogota(ahora = new Date()) {
  // Colombia es UTC-5 todo el año (sin horario de verano)
  const t = new Date(ahora.getTime() - 5 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}
function partesFecha(f) { const [y, m, d] = f.split('-').map(Number); return { y, m, d }; }
function sumarDias(f, n) {
  const { y, m, d } = partesFecha(f);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
function diasEntre(a, b) {
  const pa = partesFecha(a), pb = partesFecha(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}
function diaSemana(f) { const { y, m, d } = partesFecha(f); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function fechaLarga(f) { const { y, m, d } = partesFecha(f); return `${DIAS_SEM[diaSemana(f)]} ${d} ${MESES_CORTO[m - 1]} ${y}`; }
function fechaCorta(f) { const { m, d } = partesFecha(f); return `${DIAS_CORTO[diaSemana(f)]} ${d} ${MESES_CORTO[m - 1]}`; }
function mesDe(f) { return f.slice(0, 7); }
function nombreMes(ym) { const [y, m] = ym.split('-').map(Number); return `${MESES[m - 1].charAt(0).toUpperCase()}${MESES[m - 1].slice(1)} ${y}`; }
function sumarMeses(ym, n) { const [y, m] = ym.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return t.toISOString().slice(0, 7); }

/* Modelo del cuaderno: Gastos + Transferencias + Efectivo = Total; Total − Base = Venta del día */
function cuadre(dia, gastos, transferencias) {
  const g = gastos.reduce((s, x) => s + (Number(x.monto) || 0), 0);
  const t = transferencias.reduce((s, x) => s + (Number(x.monto) || 0), 0);
  const e = Number(dia?.efectivo) || 0;
  const b = Number(dia?.base) || 0;
  const total = g + t + e;
  const venta = total - b;
  return { gastos: g, transferencias: t, efectivo: e, base: b, total, venta, ganancia: venta - g };
}
function resumenDias(db) {
  return db.dias
    .map((dia) => {
      const gs = db.gastos.filter((x) => x.dia_id === dia.id);
      const ts = db.transferencias.filter((x) => x.dia_id === dia.id);
      return { dia, listaGastos: gs, listaTransf: ts, ...cuadre(dia, gs, ts) };
    })
    .sort((a, b) => (a.dia.fecha < b.dia.fecha ? 1 : -1));
}
function consolidar(filas) {
  const r = filas.reduce((s, f) => ({
    ventas: s.ventas + f.venta, gastos: s.gastos + f.gastos, transferencias: s.transferencias + f.transferencias,
    efectivo: s.efectivo + f.efectivo, cerrados: s.cerrados + (f.dia.estado === 'cerrado' ? 1 : 0)
  }), { ventas: 0, gastos: 0, transferencias: 0, efectivo: 0, cerrados: 0 });
  r.dias = filas.length;
  r.saldo = r.ventas - r.gastos;
  r.promedio = filas.length ? Math.round(r.ventas / filas.length) : 0;
  return r;
}
function gastosPorConcepto(gastos) {
  const m = new Map();
  gastos.forEach((g) => m.set(g.concepto, (m.get(g.concepto) || 0) + (Number(g.monto) || 0)));
  return [...m.entries()].map(([concepto, monto]) => ({ concepto, monto })).sort((a, b) => b.monto - a.monto);
}
// Limpia la lista de conceptos: sin vacíos ni repetidos, máximo 12, y "Otro" siempre al final
function limpiarConceptos(lista) {
  const vistos = new Set();
  const out = [];
  (lista || []).forEach((c) => {
    const n = String(c || '').trim().slice(0, 20);
    const k = n.toLowerCase();
    if (!n || k === 'otro' || vistos.has(k)) return;
    vistos.add(k); out.push(n);
  });
  return [...out.slice(0, MAX_CONCEPTOS - 1), 'Otro'];
}
function baseVacia() {
  return {
    version: VERSION_DATOS,
    config: {
      base_por_defecto: 0, conceptos: CONCEPTOS_POR_DEFECTO.slice(),
      nombre_negocio: '', tipo_negocio: '', bienvenida_hecha: false, ultima_copia: null
    },
    dias: [], gastos: [], transferencias: []
  };
}
function esDbValida(d) {
  return !!d && typeof d === 'object' && Array.isArray(d.dias) && Array.isArray(d.gastos) && Array.isArray(d.transferencias)
    && d.dias.every((x) => x && typeof x.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha))
    && d.gastos.every((x) => x && typeof x.dia_id === 'string' && Number.isFinite(Number(x.monto)))
    && d.transferencias.every((x) => x && typeof x.dia_id === 'string' && Number.isFinite(Number(x.monto)));
}
function normalizarDb(d) {
  const b = baseVacia();
  const config = { ...b.config, ...(d.config || {}) };
  config.conceptos = limpiarConceptos(config.conceptos);
  config.nombre_negocio = String(config.nombre_negocio || '').slice(0, 40);
  config.base_por_defecto = Math.max(0, Number(config.base_por_defecto) || 0);
  // Quien ya traía datos de "Caja del Día" no tiene que pasar por la bienvenida
  if (d.config && d.config.bienvenida_hecha === undefined && d.dias.length) config.bienvenida_hecha = true;
  return { version: VERSION_DATOS, config, dias: d.dias, gastos: d.gastos, transferencias: d.transferencias };
}
// Días sin copia: cuenta desde la última copia o, si nunca hubo, desde el primer día real registrado
function diasSinCopia(db, hoy) {
  const reales = db.dias.filter((d) => !d.ejemplo);
  if (!reales.length) return null;
  const desde = db.config.ultima_copia ? hoyBogota(new Date(db.config.ultima_copia)) : reales.map((d) => d.fecha).sort()[0];
  return diasEntre(desde, hoy);
}
/* ===================== CALC-END ===================== */

/* ===================== Capa de datos (hoy localStorage; mañana Supabase con los mismos nombres) ===================== */
// Se conserva la llave de "Caja del Día" para no perder los datos de quien ya la usaba
const LLAVE = 'cajadia:v1';
const LLAVE_TEMA = 'cajadia:tema';
function nuevoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
function ahoraIso() { return new Date().toISOString(); }
const repo = {
  cargar() {
    try {
      const raw = localStorage.getItem(LLAVE);
      if (!raw) return baseVacia();
      const d = JSON.parse(raw);
      return esDbValida(d) ? normalizarDb(d) : baseVacia();
    } catch (e) { return baseVacia(); }
  },
  guardar(db) {
    try { localStorage.setItem(LLAVE, JSON.stringify(db)); return true; } catch (e) { return false; }
  }
};
function buscarDia(db, fecha) { return db.dias.find((d) => d.fecha === fecha) || null; }
function baseSugerida(db) { return db.config.base_por_defecto; }
function asegurarDia(db, fecha) {
  const d = buscarDia(db, fecha);
  if (d) return [db, d];
  const nuevo = { id: nuevoId(), fecha, base: baseSugerida(db), efectivo: 0, estado: 'abierto', cerrado_en: null, creado_en: ahoraIso(), actualizado_en: ahoraIso() };
  return [{ ...db, dias: [...db.dias, nuevo] }, nuevo];
}
function cambiarDia(db, id, cambios) {
  return { ...db, dias: db.dias.map((d) => (d.id === id ? { ...d, ...cambios, actualizado_en: ahoraIso() } : d)) };
}
// Día de ejemplo (ayer) para que el negocio vea cómo se ve un cuadre antes de empezar
function conEjemplo(db, hoy) {
  const fecha = sumarDias(hoy, -1);
  if (buscarDia(db, fecha)) return db;
  const base = db.config.base_por_defecto || 100000;
  const dia = { id: nuevoId(), fecha, base, efectivo: base + 186000, estado: 'cerrado', cerrado_en: ahoraIso(), creado_en: ahoraIso(), actualizado_en: ahoraIso(), ejemplo: true };
  const cs = db.config.conceptos.filter((c) => c !== 'Otro');
  const montos = [52000, 23000, 14500, 9000];
  const gastos = montos.slice(0, Math.max(1, Math.min(4, cs.length))).map((m, i) => ({ id: nuevoId(), dia_id: dia.id, concepto: cs[i] || 'Otro', monto: m, creado_en: ahoraIso() }));
  const transferencias = [38000, 21500].map((m) => ({ id: nuevoId(), dia_id: dia.id, monto: m, nota: '', creado_en: ahoraIso() }));
  return { ...db, dias: [...db.dias, dia], gastos: [...db.gastos, ...gastos], transferencias: [...db.transferencias, ...transferencias] };
}
function sinEjemplo(db) {
  const ids = new Set(db.dias.filter((d) => d.ejemplo).map((d) => d.id));
  if (!ids.size) return db;
  return { ...db, dias: db.dias.filter((d) => !ids.has(d.id)), gastos: db.gastos.filter((g) => !ids.has(g.dia_id)), transferencias: db.transferencias.filter((t) => !ids.has(t.dia_id)) };
}

/* ===================== Archivos: compartir, descargar, imprimir ===================== */
function descargar(archivo) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url; a.download = archivo.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
// Abre el menú de compartir del celular (WhatsApp, correo, Drive…). Si no se puede, descarga el archivo.
async function compartirArchivo(archivo, { titulo, texto }) {
  if (navigator.canShare && navigator.share) {
    let puede = false;
    try { puede = navigator.canShare({ files: [archivo] }); } catch (e) { puede = false; }
    if (puede) {
      try { await navigator.share({ files: [archivo], title: titulo, text: texto }); return 'compartido'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
    }
  }
  try { descargar(archivo); return 'descargado'; } catch (e) { return 'error'; }
}
function imprimirImagen(url) {
  const cont = document.getElementById('imprimir');
  cont.innerHTML = '';
  const img = new Image();
  img.alt = 'Reporte de Cuadrao';
  img.onload = () => setTimeout(() => window.print(), 50);
  img.src = url;
  cont.appendChild(img);
}
function nombreArchivo(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
}

/* ===================== Reporte como imagen (canvas) ===================== */
const R = { fondo: '#F5F6F1', blanco: '#FFFFFF', texto: '#16201A', suave: '#57605A', linea: '#E1E4DA', verde: MARCA.verde, oscuro: MARCA.verdeOscuro, amarillo: MARCA.amarillo, crema: MARCA.crema, gasto: '#C2410C', transf: '#1D4ED8' };
const FUENTE = "'Manrope', system-ui, sans-serif";

function recortar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
  return t + '…';
}
function rectRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function dibujarLogo(ctx, x, y, tam, colorCuadro) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(tam / 100, tam / 100);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = colorCuadro; ctx.lineWidth = MARCA.grosorCuadro; ctx.stroke(new Path2D(MARCA.logoCuadro));
  ctx.strokeStyle = R.amarillo; ctx.lineWidth = MARCA.grosorCheck; ctx.stroke(new Path2D(MARCA.logoCheck));
  ctx.restore();
}
// rep = { tipo: 'dia', fila } | { tipo: 'mes', mes, filas }
function lineasReporte(rep) {
  if (rep.tipo === 'dia') {
    const f = rep.fila;
    const porConcepto = gastosPorConcepto(f.listaGastos);
    const max = 12;
    const items = porConcepto.slice(0, max).map((p) => ({ izq: p.concepto, der: formatoPesos(p.monto) }));
    if (porConcepto.length > max) items.push({ izq: `+ ${porConcepto.length - max} conceptos más`, der: '', suave: true });
    return {
      titulo: 'Cuadre del día', sub: `${fechaLarga(f.dia.fecha)} · ${f.dia.estado === 'cerrado' ? 'Día cerrado' : 'Día abierto'}`,
      seccion: items.length ? 'Gastos del día' : '', items,
      cuentas: [
        { izq: 'Gastos', der: formatoPesos(f.gastos), color: R.gasto },
        { izq: '+ Transferencias', der: formatoPesos(f.transferencias) },
        { izq: '+ Efectivo en caja', der: formatoPesos(f.efectivo) },
        { izq: '= Total', der: formatoPesos(f.total), fuerte: true },
        { izq: '− Base', der: formatoPesos(f.base) }
      ],
      grande: { etq: 'Venta del día', val: formatoPesos(f.venta) },
      chica: { etq: 'Ganancia (venta − gastos)', val: formatoPesos(f.ganancia) }
    };
  }
  const r = consolidar(rep.filas);
  return {
    titulo: `Resumen de ${nombreMes(rep.mes).toLowerCase()}`, sub: `${r.dias} ${r.dias === 1 ? 'día' : 'días'} registrados · ${r.cerrados} cerrados`,
    seccion: 'Venta por día',
    items: rep.filas.slice().reverse().map((f) => ({ izq: fechaCorta(f.dia.fecha), der: formatoPesos(f.venta) })),
    cuentas: [
      { izq: 'Gastos del mes', der: formatoPesos(r.gastos), color: R.gasto },
      { izq: 'Transferencias', der: formatoPesos(r.transferencias), color: R.transf },
      { izq: 'Efectivo', der: formatoPesos(r.efectivo) },
      { izq: 'Promedio de venta por día', der: formatoPesos(r.promedio), fuerte: true }
    ],
    grande: { etq: 'Ventas del mes', val: formatoPesos(r.ventas) },
    chica: { etq: 'Saldo (ventas − gastos)', val: formatoPesos(r.saldo) }
  };
}
async function dibujarReporte(rep, negocio) {
  try { await Promise.all(['400', '600', '700', '800'].map((w) => document.fonts.load(`${w} 32px Manrope`))); } catch (e) {}
  const L = lineasReporte(rep);
  const W = 1080, P = 72, FILA = 58;
  const altoItems = L.items.length ? 70 + L.items.length * FILA : 0;
  const H = 250 + 150 + altoItems + 40 + L.cuentas.length * FILA + 40 + 250 + 130;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  // Fondo y franja de marca
  ctx.fillStyle = R.fondo; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = R.verde; ctx.fillRect(0, 0, W, 250);
  dibujarLogo(ctx, P - 12, 62, 126, R.crema);
  ctx.fillStyle = R.crema; ctx.font = `800 52px ${FUENTE}`; ctx.fillText('Cuadrao', P + 136, 128);
  ctx.fillStyle = '#CDEBDB'; ctx.font = `600 34px ${FUENTE}`;
  ctx.fillText(recortar(ctx, negocio || MARCA.lema, W - P * 2 - 136), P + 136, 178);

  // Título
  let y = 250 + 92;
  ctx.fillStyle = R.texto; ctx.font = `800 48px ${FUENTE}`; ctx.fillText(L.titulo, P, y);
  y += 48;
  ctx.fillStyle = R.suave; ctx.font = `600 30px ${FUENTE}`; ctx.fillText(L.sub, P, y);
  y += 10;

  const fila = (izq, der, { color = R.texto, peso = 600, tam = 32, suave = false } = {}) => {
    y += FILA;
    ctx.font = `${peso} ${tam}px ${FUENTE}`;
    ctx.fillStyle = suave ? R.suave : R.texto; ctx.textAlign = 'left';
    ctx.fillText(recortar(ctx, izq, W - P * 2 - 260), P, y);
    ctx.font = `800 ${tam}px ${FUENTE}`; ctx.fillStyle = color; ctx.textAlign = 'right';
    ctx.fillText(der, W - P, y);
    ctx.textAlign = 'left';
  };
  const raya = (grosor = 2, color = R.linea) => { ctx.fillStyle = color; ctx.fillRect(P, y + 22, W - P * 2, grosor); };

  if (L.items.length) {
    y += 70;
    ctx.fillStyle = R.suave; ctx.font = `800 26px ${FUENTE}`; ctx.fillText(L.seccion.toUpperCase(), P, y);
    y -= FILA - 52;
    L.items.forEach((it) => fila(it.izq, it.der, { suave: it.suave }));
    y += 26;
  }
  raya(3, R.texto); y += 22;
  L.cuentas.forEach((c) => fila(c.izq, c.der, { color: c.color || R.texto, peso: c.fuerte ? 800 : 600 }));
  y += 52;

  // Recuadro de la venta
  rectRedondo(ctx, P, y, W - P * 2, 220, 32); ctx.fillStyle = R.oscuro; ctx.fill();
  ctx.fillStyle = '#A9C4B5'; ctx.font = `700 30px ${FUENTE}`; ctx.fillText(L.grande.etq, P + 40, y + 62);
  ctx.fillStyle = R.amarillo; ctx.font = `800 88px ${FUENTE}`; ctx.fillText('$ ' + L.grande.val, P + 40, y + 150);
  ctx.fillStyle = '#CDEBDB'; ctx.font = `600 28px ${FUENTE}`;
  ctx.fillText(`${L.chica.etq}: $ ${L.chica.val}`, P + 40, y + 196);
  y += 220;

  // Pie
  ctx.textAlign = 'center';
  ctx.fillStyle = R.suave; ctx.font = `700 28px ${FUENTE}`;
  ctx.fillText(`Cuadrado con Cuadrao · ${MARCA.firma}`, W / 2, y + 86);
  ctx.textAlign = 'left';
  return cv;
}

/* ===================== Íconos ===================== */
const svgProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const Ico = {
  izq: <svg width="20" height="20" viewBox="0 0 24 24" {...svgProps}><path d="M15 18l-6-6 6-6"/></svg>,
  der: <svg width="20" height="20" viewBox="0 0 24 24" {...svgProps}><path d="M9 18l6-6-6-6"/></svg>,
  mas: <svg width="22" height="22" viewBox="0 0 24 24" {...svgProps} strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  check: <svg width="22" height="22" viewBox="0 0 24 24" {...svgProps} strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>,
  barras: <svg width="22" height="22" viewBox="0 0 24 24" {...svgProps}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>,
  hoja: <svg width="22" height="22" viewBox="0 0 24 24" {...svgProps}><path d="M8 3h8l4 4v14H4V3h4zM8 12h8M8 16h5"/></svg>,
  ajustes: <svg width="22" height="22" viewBox="0 0 24 24" {...svgProps}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  compartir: <svg width="20" height="20" viewBox="0 0 24 24" {...svgProps}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>,
  enviar: <svg width="18" height="18" viewBox="0 0 24 24" {...svgProps}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  subir: <svg width="18" height="18" viewBox="0 0 24 24" {...svgProps}><path d="M12 21V9M7 14l5-5 5 5M5 3h14"/></svg>,
  pdf: <svg width="18" height="18" viewBox="0 0 24 24" {...svgProps}><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" {...svgProps} strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
};
function Logo({ tam = 32, className = 'marca-logo' }) {
  return (
    <svg className={className} width={tam} height={tam} viewBox="0 0 100 100" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={MARCA.logoCuadro} stroke="currentColor" strokeWidth={MARCA.grosorCuadro} />
      <path d={MARCA.logoCheck} stroke={MARCA.amarillo} strokeWidth={MARCA.grosorCheck} />
    </svg>
  );
}

/* ===================== Componentes ===================== */
function CampoPesos({ id, etiqueta, valor, onCambio, disabled, grande, placeholder, ocultarEtiqueta }) {
  const [texto, setTexto] = useState(valor ? formatoPesos(valor) : '');
  useEffect(() => { setTexto(valor ? formatoPesos(valor) : ''); }, [valor]);
  return (
    <>
      <label htmlFor={id} className={ocultarEtiqueta ? 'sr' : 'etq'}>{etiqueta}</label>
      <input
        id={id} className={'entrada' + (grande ? ' grande' : '')} inputMode="numeric" autoComplete="off"
        placeholder={placeholder} value={texto} disabled={disabled}
        onChange={(e) => { const n = leerMonto(e.target.value); setTexto(n ? formatoPesos(n) : ''); onCambio && onCambio(n); }}
      />
    </>
  );
}

function Hoja({ titulo, onCerrar, children, cerrarTexto = 'Cancelar' }) {
  const ref = useRef(null);
  const idTit = useId();
  useEffect(() => { const el = ref.current && ref.current.querySelector('input:not(:disabled), button.btn-prim'); el && el.focus(); }, []);
  return (
    <div className="velo" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="hoja" role="dialog" aria-modal="true" aria-labelledby={idTit} ref={ref}
        onKeyDown={(e) => { if (e.key === 'Escape') onCerrar(); }}>
        <div className="fila-tit" style={{ alignItems: 'center' }}>
          <h2 className="h2" id={idTit}>{titulo}</h2>
          <button className="btn-link" onClick={onCerrar}>{cerrarTexto}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function HojaEditar({ item, tipo, conceptos, onGuardar, onBorrar, onCerrar }) {
  const [monto, setMonto] = useState(item.monto);
  const [concepto, setConcepto] = useState(item.concepto || '');
  const [confirmar, setConfirmar] = useState(false);
  const lista = tipo === 'gasto' && concepto && !conceptos.includes(concepto) ? [concepto, ...conceptos] : conceptos;
  return (
    <Hoja titulo={tipo === 'gasto' ? 'Editar gasto' : 'Editar transferencia'} onCerrar={onCerrar}>
      {tipo === 'gasto' && (
        <div className="chips" role="group" aria-label="Concepto">
          {lista.map((c) => (
            <button key={c} className="chip" aria-pressed={concepto === c} onClick={() => setConcepto(c)}>{c}</button>
          ))}
        </div>
      )}
      <CampoPesos id="monto-edit" etiqueta="Valor" valor={monto} onCambio={setMonto} grande />
      <div className="hoja-acciones">
        <button className={'btn-borrar' + (confirmar ? ' confirmar' : '')}
          onClick={() => (confirmar ? onBorrar() : setConfirmar(true))}>
          {confirmar ? 'Toca otra vez para borrar' : 'Borrar'}
        </button>
        <button className="btn-prim" disabled={!monto} onClick={() => onGuardar({ monto, concepto })}>Guardar cambios</button>
      </div>
    </Hoja>
  );
}

function EditorConceptos({ conceptos, onCambio, idBase = 'concepto' }) {
  const [nuevo, setNuevo] = useState('');
  const lleno = conceptos.length >= MAX_CONCEPTOS;
  const agregar = (e) => {
    e.preventDefault();
    const n = nuevo.trim();
    if (!n) return;
    onCambio(limpiarConceptos([...conceptos.filter((c) => c !== 'Otro'), n]));
    setNuevo('');
  };
  return (
    <div className="pila" style={{ gap: 8 }}>
      <div className="chips envolver">
        {conceptos.map((c) => (
          <span key={c} className="chip">
            {c}
            {c !== 'Otro' && (
              <button type="button" className="chip-quitar" aria-label={`Quitar ${c}`}
                onClick={() => onCambio(limpiarConceptos(conceptos.filter((x) => x !== c)))}>{Ico.x}</button>
            )}
          </span>
        ))}
      </div>
      <form className="agregar" onSubmit={agregar}>
        <label htmlFor={idBase + '-nuevo'} className="sr">Nuevo concepto de gasto</label>
        <input id={idBase + '-nuevo'} className="entrada" maxLength={20} disabled={lleno}
          placeholder={lleno ? 'Máximo 12 conceptos' : 'Agregar otro gasto (ej. Hielo)'} value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
        <button type="submit" className="btn-mas prim" aria-label="Agregar concepto" disabled={lleno || !nuevo.trim()}>{Ico.mas}</button>
      </form>
    </div>
  );
}

/* ---------- Barra de marca ---------- */
function BarraMarca({ negocio, enAjustes, onAjustes, onVolver }) {
  return (
    <header className="marca">
      {enAjustes && <button className="btn-icono plano" aria-label="Volver" onClick={onVolver}>{Ico.izq}</button>}
      <Logo tam={34} />
      <div className="marca-txt">
        {negocio ? <><span className="marca-negocio">{negocio}</span><span className="marca-app">Cuadrao</span></>
          : <span className="marca-negocio">Cuadrao</span>}
      </div>
      {!enAjustes && <button className="btn-icono plano" aria-label="Ajustes y copia de seguridad" onClick={onAjustes}>{Ico.ajustes}</button>}
    </header>
  );
}

/* ---------- Primer uso ---------- */
function Bienvenida({ db, acciones, onRestaurar }) {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState(db.config.nombre_negocio || '');
  const [tipo, setTipo] = useState(db.config.tipo_negocio || '');
  const [conceptos, setConceptos] = useState(db.config.conceptos);
  const [base, setBase] = useState(db.config.base_por_defecto || 0);
  const escoger = (t) => { setTipo(t); setConceptos(TIPOS[t].conceptos.slice()); };
  const terminar = (ejemplo) => acciones.terminarBienvenida({ nombre: nombre.trim(), tipo, conceptos, base, ejemplo });
  const refNombre = useRef(null);
  useEffect(() => { if (paso === 0 && refNombre.current) refNombre.current.focus(); }, [paso]);

  return (
    <div className="bienvenida">
      <div className="puntos" aria-label={`Paso ${paso + 1} de 3`}>{[0, 1, 2].map((i) => <span key={i} className={i <= paso ? 'si' : ''} />)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo tam={40} />
        <span style={{ fontWeight: 800, fontSize: 18 }}>Cuadrao</span>
      </div>

      {paso === 0 && (
        <form className="bien-cuerpo" onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) setPaso(1); }}>
          <h1 className="bien-tit">¿Cómo se llama tu negocio?</h1>
          <p className="bien-sub">Sale arriba en la app y en los cuadres que compartes por WhatsApp.</p>
          <label htmlFor="nombre-negocio" className="sr">Nombre del negocio</label>
          <input id="nombre-negocio" ref={refNombre} className="entrada" style={{ height: 52, fontSize: 18 }} maxLength={40}
            placeholder="Ej. Asadero Doña Rosa" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <div style={{ flex: 1 }} />
          <div className="bien-pie">
            <button type="submit" className="btn-prim ancho" disabled={!nombre.trim()}>Siguiente</button>
            <button type="button" className="btn-link" style={{ alignSelf: 'center' }} onClick={onRestaurar}>{Ico.subir}Ya tengo una copia: restaurarla</button>
          </div>
        </form>
      )}

      {paso === 1 && (
        <div className="bien-cuerpo">
          <h1 className="bien-tit">¿Qué tipo de negocio es?</h1>
          <p className="bien-sub">Así te dejamos listos los gastos de todos los días.</p>
          <div className="opciones" role="group" aria-label="Tipo de negocio">
            {Object.entries(TIPOS).map(([id, t]) => (
              <button key={id} className="opcion" aria-pressed={tipo === id} onClick={() => escoger(id)}>
                {t.nombre}<small>{t.ej}</small>
              </button>
            ))}
          </div>
          {tipo && (
            <>
              <p className="bien-sub" style={{ fontSize: 14 }}>Tus gastos de todos los días. Quita o agrega los que quieras:</p>
              <EditorConceptos conceptos={conceptos} onCambio={setConceptos} idBase="bien" />
            </>
          )}
          <div style={{ flex: 1 }} />
          <div className="bien-pie">
            <button className="btn-prim ancho" disabled={!tipo} onClick={() => setPaso(2)}>Siguiente</button>
            <button className="btn-link" style={{ alignSelf: 'center' }} onClick={() => setPaso(0)}>Atrás</button>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="bien-cuerpo">
          <h1 className="bien-tit">¿Con cuánta base abres la caja?</h1>
          <p className="bien-sub">La base es la plata con la que arrancas el día para dar vueltas. Puedes cambiarla cualquier día.</p>
          <div className="caja campo-caja">
            <CampoPesos id="base-inicial" etiqueta="Base de cada día" valor={base} onCambio={setBase} grande placeholder="0" />
          </div>
          <div className="explica">
            Al final del día escribes el <strong>efectivo en caja</strong> y Cuadrao hace la cuenta del cuaderno:
            <span className="formula">Gastos + Transferencias + Efectivo − Base = Venta del día</span>
          </div>
          <div style={{ flex: 1 }} />
          <div className="bien-pie">
            <button className="btn-prim ancho" onClick={() => terminar(false)}>Empezar</button>
            <button className="btn-sec ancho" onClick={() => terminar(true)}>Ver primero un día de ejemplo</button>
            <button className="btn-link" style={{ alignSelf: 'center' }} onClick={() => setPaso(1)}>Atrás</button>
          </div>
        </div>
      )}
      <div className="firma">{MARCA.firma}</div>
    </div>
  );
}

/* ---------- Avisos ---------- */
function Avisos({ db, hoy, acciones, irA }) {
  const ejemplo = db.dias.some((d) => d.ejemplo);
  const sin = diasSinCopia(db, hoy);
  return (
    <>
      {ejemplo && (
        <div className="aviso ejemplo" role="note">
          <p>Ayer quedó un día de ejemplo para que veas cómo se ve un cuadre.</p>
          <button className="btn-aviso" onClick={acciones.borrarEjemplo}>Borrarlo</button>
        </div>
      )}
      {sin !== null && sin >= DIAS_AVISO_COPIA && (
        <div className="aviso copia" role="note">
          <p>{db.config.ultima_copia ? `Hace ${sin} días no guardas copia de tus datos.` : 'Aún no guardas una copia de tus datos.'}</p>
          <button className="btn-aviso" onClick={acciones.enviarCopia}>Enviar copia</button>
        </div>
      )}
    </>
  );
}

/* ---------- Registro ---------- */
// Una fila de "Por anotar": el concepto ya está, solo se pone el precio y se toca el chulito
function FilaPorAnotar({ id, concepto, onAnotar }) {
  const [monto, setMonto] = useState(0);
  const enviar = (e) => { e.preventDefault(); onAnotar(concepto, monto); };
  return (
    <form className="pa-fila" onSubmit={enviar}>
      <label htmlFor={id} className="pa-nombre">{concepto}</label>
      <input id={id} className="entrada pa-precio" inputMode="numeric" autoComplete="off" placeholder="0"
        aria-label={`Valor de ${concepto}`} value={monto ? formatoPesos(monto) : ''}
        onChange={(e) => setMonto(leerMonto(e.target.value))} />
      <button type="submit" className={'btn-check' + (monto ? ' listo' : '')} aria-label={`Anotar ${concepto}`}>{Ico.check}</button>
    </form>
  );
}

// "Otro": se escribe qué fue; la fila se queda para anotar más
function FilaOtro({ onAnotar }) {
  const [texto, setTexto] = useState('');
  const [monto, setMonto] = useState(0);
  const enviar = (e) => {
    e.preventDefault();
    if (!monto) { onAnotar('Otro', 0); return; }
    onAnotar(texto.trim().slice(0, 40) || 'Otro', monto);
    setTexto(''); setMonto(0);
  };
  return (
    <form className="pa-fila pa-otro" onSubmit={enviar}>
      <input id="otro-texto" className="entrada pa-texto" maxLength={40} autoComplete="off" placeholder="¿Qué fue?"
        aria-label="¿Qué fue? (Otro gasto)" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <input id="otro-precio" className="entrada pa-precio corto" inputMode="numeric" autoComplete="off" placeholder="0"
        aria-label="Valor de Otro" value={monto ? formatoPesos(monto) : ''}
        onChange={(e) => setMonto(leerMonto(e.target.value))} />
      <button type="submit" className={'btn-check' + (monto ? ' listo' : '')} aria-label="Anotar Otro">{Ico.check}</button>
    </form>
  );
}

// Gastos del día juntos por concepto; el último que se anotó va arriba
function agruparGastos(gastos) {
  const m = new Map();
  gastos.forEach((g, i) => {
    const x = m.get(g.concepto) || { concepto: g.concepto, items: [], total: 0, ultimo: 0 };
    x.items.push(g); x.total += Number(g.monto) || 0; x.ultimo = i;
    m.set(g.concepto, x);
  });
  return [...m.values()].sort((a, b) => b.ultimo - a.ultimo);
}

function RenglonAnotado({ grupo, cerrado, sumando, abierto, onSumar, onAbrir, onSuma, onEditar }) {
  const [monto, setMonto] = useState(0);
  const n = grupo.items.length;
  const guardar = (e) => {
    e.preventDefault();
    if (!monto) return;
    onSuma(grupo.concepto, monto);
    setMonto(0);
  };
  return (
    <div className="anot">
      <div className="anot-fila">
        <button type="button" className="anot-main" aria-expanded={abierto} onClick={onAbrir}>
          <span className="anot-izq">
            <span className="anot-nom">{grupo.concepto}</span>
            {n > 1 && <span className="pastilla">{n} veces</span>}
          </span>
          <span className="anot-total">{formatoPesos(grupo.total)}</span>
          {n > 1 && <span className="anot-det">{grupo.items.map((g) => formatoPesos(g.monto)).join(' + ')}</span>}
        </button>
        {!cerrado && (
          <button type="button" className="btn-mas-borde" aria-label={`Sumar otro valor a ${grupo.concepto}`} aria-expanded={sumando} onClick={onSumar}>{Ico.mas}</button>
        )}
      </div>
      {sumando && !cerrado && (
        <form className="anot-suma" onSubmit={guardar}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CampoPesos id={'suma-' + grupo.concepto.replace(/\W+/g, '-')} etiqueta="Sumar otra vez" ocultarEtiqueta valor={monto} onCambio={setMonto} placeholder="Sumar otra vez" />
          </div>
          <button type="submit" className="btn-prim chico">Sumar</button>
        </form>
      )}
      {abierto && (
        <div className="dos-apretado anot-items">
          {grupo.items.map((g) => (
            <button key={g.id} className="item gasto" disabled={cerrado} aria-label={`${g.concepto} ${formatoPesos(g.monto)}. Editar o borrar`}
              onClick={() => onEditar(g)}>
              <span className="item-nom">{g.concepto}</span>
              <span className="item-val">{formatoPesos(g.monto)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Cerrar o reabrir el día (antes vivía en la barra de abajo)
function ControlesCierre({ cerrado, onCerrar, onReabrir }) {
  return (
    <section className="cierre" aria-label="Cierre del día">
      <p>{cerrado ? 'Este día está cerrado.' : 'Cuando termines de anotar, cierra el día.'}</p>
      {cerrado
        ? <button className="btn-reabrir" onClick={onReabrir}>Reabrir día</button>
        : <button className="btn-cierre" onClick={onCerrar}>Cerrar día</button>}
    </section>
  );
}

function PantallaRegistro({ db, fecha, setFecha, hoy, acciones, irA }) {
  const dia = buscarDia(db, fecha);
  const gastos = dia ? db.gastos.filter((g) => g.dia_id === dia.id) : [];
  const transfers = dia ? db.transferencias.filter((t) => t.dia_id === dia.id) : [];
  const c = cuadre(dia || { base: baseSugerida(db), efectivo: 0 }, gastos, transfers);
  const cerrado = !!dia && dia.estado === 'cerrado';
  const conceptos = db.config.conceptos;
  const [editando, setEditando] = useState(null);
  const [hojaTransf, setHojaTransf] = useState(false);
  const [hojaBase, setHojaBase] = useState(false);
  const [llaveT, setLlaveT] = useState(0);
  const [montoT, setMontoT] = useState(0);
  const [sumando, setSumando] = useState(null);
  const [abierto, setAbierto] = useState(null);
  useEffect(() => { setSumando(null); setAbierto(null); setHojaTransf(false); setHojaBase(false); setEditando(null); }, [fecha]);

  // Por anotar depende solo de los gastos de ESTE día: al día siguiente la lista sale completa
  const fijos = conceptos.filter((x) => x !== 'Otro');
  const anotados = new Set(gastos.map((g) => g.concepto));
  const pendientes = fijos.filter((x) => !anotados.has(x));
  const grupos = agruparGastos(gastos);

  const anotar = (concepto, monto) => {
    if (!monto) { acciones.aviso(`Escribe el valor de ${concepto}`); return; }
    acciones.agregarGasto(fecha, concepto, monto);
  };
  const agregarTransf = (e) => {
    e.preventDefault();
    if (!montoT) { acciones.aviso('Escribe el valor de la transferencia'); return; }
    acciones.agregarTransferencia(fecha, montoT);
    setMontoT(0); setLlaveT((k) => k + 1);
  };
  const nT = transfers.length;
  const hayEfectivo = c.efectivo > 0;

  return (
    <div className="pantalla">
      <header className="cab">
        <button className="btn-icono" aria-label="Día anterior" onClick={() => setFecha(sumarDias(fecha, -1))}>{Ico.izq}</button>
        <div className="cab-centro">
          <h1 className="cab-titulo">{fecha === hoy ? 'Hoy, ' : ''}{fechaCorta(fecha)}</h1>
          <div className="cab-sub">{dia && dia.ejemplo ? 'Día de ejemplo' : cerrado ? 'Día cerrado' : 'Día abierto'}</div>
        </div>
        <button className="btn-icono" aria-label="Día siguiente" disabled={fecha >= hoy} onClick={() => setFecha(sumarDias(fecha, 1))}>{Ico.der}</button>
      </header>

      <div className="fijo">
        <div className="dos">
          <div className="caja campo-caja">
            <CampoPesos id="efectivo" etiqueta="Efectivo en caja" valor={c.efectivo} disabled={cerrado} grande placeholder="0"
              onCambio={(n) => acciones.cambiarCampo(fecha, { efectivo: n })} />
          </div>
          <div className="caja caja-transf">
            <div className="transf-txt">
              <span className="etq">Transferencias</span>
              <span className="transf-total" aria-live="polite">{formatoPesos(c.transferencias)}</span>
              <span className="transf-sub">{nT === 0 ? 'Ninguna aún' : nT === 1 ? '1 recibida' : `${nT} recibidas`}</span>
            </div>
            {!cerrado && (
              <button type="button" className="btn-mas transf cuadrado" aria-label="Sumar transferencia" aria-haspopup="dialog" onClick={() => setHojaTransf(true)}>{Ico.mas}</button>
            )}
          </div>
        </div>

        <section className="saldo" aria-label="Saldo del día">
          <div className="saldo-fila">
            <span className="saldo-etq">Saldo del día</span>
            <span className="saldo-num" aria-live="polite">{hayEfectivo ? formatoPesos(c.ganancia) : '—'}</span>
          </div>
          <button type="button" className="saldo-base" aria-haspopup="dialog" onClick={() => setHojaBase(true)}>
            {hayEfectivo
              ? <>Base {formatoPesos(c.base)} · Venta <span className="cuadre-venta">{formatoPesos(c.venta)}</span></>
              : <>Base {formatoPesos(c.base)} · pon el efectivo para ver el saldo<span className="cuadre-venta sr" aria-hidden="true">{formatoPesos(c.venta)}</span></>}
          </button>
        </section>
      </div>

      <div className="pila zona">
        <Avisos db={db} hoy={hoy} acciones={acciones} irA={irA} />

        {!cerrado && (
          <section className="pila" style={{ gap: 6 }} aria-labelledby="tit-por-anotar">
            <div className="fila-tit">
              <h2 className="h2" id="tit-por-anotar">Por anotar</h2>
              {fijos.length > 0 && <span className="pa-cuenta">{pendientes.length === 0 ? 'Todo anotado' : pendientes.length === 1 ? 'Falta 1' : `Faltan ${pendientes.length}`}</span>}
            </div>
            {pendientes.length === 0 && <p className="nota-ok" role="status">Todo anotado por hoy. Mañana la lista vuelve a salir completa.</p>}
            <div className="caja pa">
              {pendientes.map((x) => <FilaPorAnotar key={x} id={'pa-' + fijos.indexOf(x)} concepto={x} onAnotar={anotar} />)}
              <FilaOtro onAnotar={anotar} />
            </div>
            {pendientes.length > 0 && <p className="ayuda">Pon el valor y toca el chulito: baja a Anotados hoy.</p>}
          </section>
        )}

        <section className="pila" style={{ gap: 6 }} aria-labelledby="tit-anotados">
          <div className="fila-tit">
            <h2 className="h2" id="tit-anotados">Anotados hoy</h2>
            <span className="total-gasto">{formatoPesos(c.gastos)}</span>
          </div>
          {grupos.length ? (
            <div className="caja anotados">
              {grupos.map((g) => (
                <RenglonAnotado key={g.concepto} grupo={g} cerrado={cerrado}
                  sumando={sumando === g.concepto} abierto={abierto === g.concepto}
                  onSumar={() => setSumando(sumando === g.concepto ? null : g.concepto)}
                  onAbrir={() => setAbierto(abierto === g.concepto ? null : g.concepto)}
                  onSuma={(concepto, monto) => { acciones.agregarGasto(fecha, concepto, monto); setSumando(null); }}
                  onEditar={(item) => setEditando({ tipo: 'gasto', item })} />
              ))}
            </div>
          ) : <p className="vacio-caja">Aún no has anotado gastos hoy.</p>}
          {grupos.length > 0 && !cerrado && <p className="ayuda">Toca un concepto para ver sus gastos y editarlos o borrarlos.</p>}
        </section>

        <ControlesCierre cerrado={cerrado} onCerrar={() => acciones.cerrarDia(fecha)} onReabrir={() => acciones.reabrirDia(fecha)} />
      </div>

      {hojaTransf && (
        <Hoja titulo="Transferencias de hoy" onCerrar={() => setHojaTransf(false)} cerrarTexto="Cerrar">
          <form className="agregar" onSubmit={agregarTransf}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <CampoPesos key={llaveT} id="monto-transf" etiqueta="Valor de la transferencia" ocultarEtiqueta valor={montoT} onCambio={setMontoT} placeholder="Valor recibido" />
            </div>
            <button type="submit" className="btn-mas transf" aria-label="Agregar transferencia">{Ico.mas}</button>
          </form>
          {transfers.length ? (
            <div className="pila" style={{ gap: 6 }}>
              {transfers.map((t, i) => (
                <button key={t.id} className="item transf" disabled={cerrado} aria-label={`Transferencia ${i + 1} ${formatoPesos(t.monto)}. Editar o borrar`}
                  onClick={() => setEditando({ tipo: 'transf', item: t })}>
                  <span className="item-nom">Transf. {i + 1}</span>
                  <span className="item-val">{formatoPesos(t.monto)}</span>
                </button>
              ))}
              <p className="ayuda">Toca una para editarla o borrarla</p>
            </div>
          ) : <p className="vacio-mini">Sin transferencias este día.</p>}
          <div className="fila-total"><span>Total del día</span><strong className="c-transf">{formatoPesos(c.transferencias)}</strong></div>
          <button type="button" className="btn-prim ancho" onClick={() => setHojaTransf(false)}>Listo</button>
        </Hoja>
      )}

      {hojaBase && (
        <Hoja titulo="Base de hoy" onCerrar={() => setHojaBase(false)} cerrarTexto="Cerrar">
          <div className="campo-caja" style={{ padding: 0 }}>
            <CampoPesos id="base" etiqueta="Base" valor={c.base} disabled={cerrado} grande placeholder="0"
              onCambio={(n) => acciones.cambiarCampo(fecha, { base: n })} />
          </div>
          <p className="ayuda">{cerrado ? 'Este día está cerrado: reábrelo para cambiar la base.' : 'Es la plata con la que arrancaste el día. Solo cambia la de hoy.'}</p>
          <button type="button" className="btn-prim ancho" onClick={() => setHojaBase(false)}>Listo</button>
        </Hoja>
      )}

      {editando && (
        <HojaEditar
          item={editando.item} tipo={editando.tipo} conceptos={conceptos}
          onCerrar={() => setEditando(null)}
          onBorrar={() => { acciones.borrar(editando.tipo, editando.item.id); setEditando(null); }}
          onGuardar={(cambios) => { acciones.editar(editando.tipo, editando.item.id, cambios); setEditando(null); }}
        />
      )}
    </div>
  );
}

/* ---------- Hoy ---------- */
function filaDeFecha(db, fecha) {
  const dia = buscarDia(db, fecha);
  if (!dia) return null;
  const gs = db.gastos.filter((g) => g.dia_id === dia.id);
  const ts = db.transferencias.filter((t) => t.dia_id === dia.id);
  return { dia, listaGastos: gs, listaTransf: ts, ...cuadre(dia, gs, ts) };
}

function PantallaHoy({ db, fecha, hoy, irA, compartir }) {
  const fila = filaDeFecha(db, fecha);
  const gastos = fila ? fila.listaGastos : [];
  const transfers = fila ? fila.listaTransf : [];
  const c = cuadre(fila && fila.dia, gastos, transfers);
  const porConcepto = gastosPorConcepto(gastos);
  const max = porConcepto.length ? porConcepto[0].monto : 1;
  const entro = c.efectivo + c.transferencias;
  const pctE = entro ? (c.efectivo / entro) * 100 : 0;
  const vacio = !fila || (!gastos.length && !transfers.length && !c.efectivo);
  return (
    <div className="pantalla">
      <header className="cab-simple">
        <h1 className="cab-titulo">{fecha === hoy ? 'Hoy' : 'Resumen del día'}</h1>
        <span className="cab-sub" style={{ fontSize: 14 }}>{fechaLarga(fecha)}</span>
      </header>
      {vacio ? (
        <div className="caja vacio">
          <p>Todavía no hay movimientos en este día.</p>
          <button className="btn-prim" onClick={() => irA('registro')}>Registrar movimientos</button>
        </div>
      ) : (
        <div className="pila">
          <section className="hero">
            <div><span className="hero-etq">Venta del día</span><span className="hero-num">{formatoPesos(c.venta)}</span></div>
            <div className="hero-der"><span className="hero-etq">Ganancia</span><span className="hero-sec">{formatoPesos(c.ganancia)}</span></div>
          </section>
          <button className="btn-prim ancho" onClick={() => compartir({ tipo: 'dia', fila })}>{Ico.compartir}Compartir cuadre</button>
          <div className="dos" style={{ gap: 8 }}>
            <div className="mini"><span className="mini-etq">Gastos</span><span className="mini-val c-gasto">{formatoPesos(c.gastos)}</span></div>
            <div className="mini"><span className="mini-etq">Transf.</span><span className="mini-val c-transf">{formatoPesos(c.transferencias)}</span></div>
            <div className="mini"><span className="mini-etq">Efectivo</span><span className="mini-val">{formatoPesos(c.efectivo)}</span></div>
            <div className="mini"><span className="mini-etq">Base</span><span className="mini-val">{formatoPesos(c.base)}</span></div>
          </div>
          <section className="caja pila" style={{ gap: 8 }}>
            <h2 className="h2" style={{ fontSize: 15 }}>¿En qué se fue la plata?</h2>
            {porConcepto.length ? porConcepto.map((p) => (
              <div className="barra-fila" key={p.concepto}>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.concepto}</span>
                <div className="barra-fondo"><div className="barra" style={{ width: `${(p.monto / max) * 100}%` }} /></div>
                <span style={{ fontWeight: 700, textAlign: 'right' }}>{formatoPesos(p.monto)}</span>
              </div>
            )) : <p className="vacio-mini">Sin gastos este día.</p>}
          </section>
          <section className="caja pila" style={{ gap: 8 }}>
            <h2 className="h2" style={{ fontSize: 15 }}>¿Cómo entró la plata?</h2>
            <div className="mezcla" role="img" aria-label={`Efectivo ${Math.round(pctE)} por ciento, transferencias ${Math.round(100 - pctE)} por ciento`}>
              <div style={{ width: `${pctE}%`, background: 'var(--texto)' }} />
              <div style={{ width: `${entro ? 100 - pctE : 0}%`, background: 'var(--barra-transf)' }} />
            </div>
            <div className="leyenda">
              <span><span className="punto" style={{ background: 'var(--texto)' }} />Efectivo {formatoPesos(c.efectivo)}</span>
              <span><span className="punto" style={{ background: 'var(--barra-transf)' }} />Transf. {formatoPesos(c.transferencias)}</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------- Reportes ---------- */
function Cuaderno({ f }) {
  return (
    <div className="cuaderno">
      {f.listaGastos.length > 0 && (
        <div className="dos" style={{ columnGap: 14, rowGap: 4 }}>
          {f.listaGastos.map((g) => <div className="l" key={g.id} style={{ fontSize: 13 }}><span>{g.concepto}</span><strong>{formatoPesos(g.monto)}</strong></div>)}
        </div>
      )}
      <div className="l sep"><span>Gastos</span><strong className="c-gasto">{formatoPesos(f.gastos)}</strong></div>
      <div className="l"><span>+ Transferencias</span><strong>{formatoPesos(f.transferencias)}</strong></div>
      <div className="l"><span>+ Efectivo</span><strong>{formatoPesos(f.efectivo)}</strong></div>
      <div className="l"><span>= Total</span><strong>{formatoPesos(f.total)}</strong></div>
      <div className="l"><span>− Base</span><strong>{formatoPesos(f.base)}</strong></div>
      <div className="l fin"><strong>Venta del día</strong><strong className="c-prim" style={{ fontSize: 22 }}>{formatoPesos(f.venta)}</strong></div>
    </div>
  );
}

function PantallaReportes({ db, hoy, abrirDia, compartir }) {
  const [tab, setTab] = useState('dia');
  const [mes, setMes] = useState(mesDe(hoy));
  const [abierto, setAbierto] = useState(null);
  const filas = useMemo(() => resumenDias(db), [db]);
  const delMes = filas.filter((f) => mesDe(f.dia.fecha) === mes);
  const rMes = consolidar(delMes);
  const rTotal = consolidar(filas);
  const meses = useMemo(() => {
    const m = new Map();
    filas.forEach((f) => { const k = mesDe(f.dia.fecha); m.set(k, [...(m.get(k) || []), f]); });
    return [...m.entries()].map(([k, fs]) => ({ mes: k, ...consolidar(fs) }));
  }, [filas]);
  const primero = filas.length ? filas[filas.length - 1].dia.fecha : null;
  const tabs = [['dia', 'Por día'], ['mes', 'Por mes'], ['total', 'Total']];

  const filaDia = (f) => (
    <div key={f.dia.id}>
      <button className="fila-dia" aria-expanded={abierto === f.dia.id} onClick={() => setAbierto(abierto === f.dia.id ? null : f.dia.id)}>
        <span><strong>{fechaCorta(f.dia.fecha)}</strong><small>Gastos {formatoPesos(f.gastos)}{f.dia.ejemplo ? ' · ejemplo' : f.dia.estado === 'abierto' ? ' · abierto' : ''}</small></span>
        <strong className="c-prim" style={{ fontSize: 15 }}>{formatoPesos(f.venta)}</strong>
      </button>
      {abierto === f.dia.id && (
        <div style={{ padding: '4px 0 12px' }} className="pila">
          <Cuaderno f={f} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button className="btn-link" onClick={() => abrirDia(f.dia.fecha)}>Abrir en Registro</button>
            <button className="btn-link" onClick={() => compartir({ tipo: 'dia', fila: f })}>{Ico.compartir}Compartir</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="pantalla">
      <header className="pila" style={{ padding: '12px 0 10px' }}>
        <h1 className="cab-titulo" style={{ padding: '0 4px' }}>Reportes</h1>
        <div className="tabs" role="tablist" aria-label="Tipo de reporte">
          {tabs.map(([id, n]) => <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{n}</button>)}
        </div>
      </header>

      {!filas.length ? (
        <div className="caja vacio"><p>Aún no hay días registrados. Cuando cierres el primer día, aquí sale el reporte.</p></div>
      ) : (
        <div className="pila">
          {tab === 'dia' && (
            <section className="caja" style={{ padding: '4px 14px' }} aria-label="Días registrados">
              {filas.map(filaDia)}
            </section>
          )}

          {tab === 'mes' && (
            <>
              <div className="cab" style={{ padding: 0 }}>
                <button className="btn-icono" aria-label="Mes anterior" onClick={() => { setMes(sumarMeses(mes, -1)); setAbierto(null); }}>{Ico.izq}</button>
                <h2 className="h2">{nombreMes(mes)}</h2>
                <button className="btn-icono" aria-label="Mes siguiente" disabled={mes >= mesDe(hoy)} onClick={() => { setMes(sumarMeses(mes, 1)); setAbierto(null); }}>{Ico.der}</button>
              </div>
              {delMes.length ? (
                <>
                  <section className="hero">
                    <div><span className="hero-etq">Ventas del mes</span><span className="hero-num" style={{ fontSize: 28 }}>{formatoPesos(rMes.ventas)}</span></div>
                    <div className="hero-der" style={{ fontSize: 12 }}>{rMes.dias} {rMes.dias === 1 ? 'día' : 'días'} · {rMes.cerrados} cerrados<br />prom. {formatoPesos(rMes.promedio)}</div>
                  </section>
                  <button className="btn-sec" onClick={() => compartir({ tipo: 'mes', mes, filas: delMes })}>{Ico.compartir}Compartir resumen del mes</button>
                  <div className="dos" style={{ gap: 8 }}>
                    <div className="mini"><span className="mini-etq">Gastos</span><span className="mini-val c-gasto">{formatoPesos(rMes.gastos)}</span></div>
                    <div className="mini"><span className="mini-etq">Saldo</span><span className="mini-val c-prim">{formatoPesos(rMes.saldo)}</span></div>
                    <div className="mini"><span className="mini-etq">Transf.</span><span className="mini-val c-transf">{formatoPesos(rMes.transferencias)}</span></div>
                    <div className="mini"><span className="mini-etq">Efectivo</span><span className="mini-val">{formatoPesos(rMes.efectivo)}</span></div>
                  </div>
                  <section className="caja" style={{ padding: '4px 14px' }} aria-label="Días del mes">{delMes.map(filaDia)}</section>
                </>
              ) : <div className="caja vacio"><p>No hay días registrados en {nombreMes(mes).toLowerCase()}.</p></div>}
            </>
          )}

          {tab === 'total' && (
            <>
              <p className="cab-sub" style={{ margin: 0, padding: '0 4px', fontSize: 13 }}>Desde el {fechaLarga(primero).toLowerCase()} · {rTotal.dias} {rTotal.dias === 1 ? 'día' : 'días'}</p>
              <section className="caja cuaderno" style={{ padding: '14px 16px', gap: 10 }}>
                <div className="l" style={{ alignItems: 'baseline' }}><strong>Ingresos (ventas)</strong><strong className="c-transf" style={{ fontSize: 20 }}>{formatoPesos(rTotal.ventas)}</strong></div>
                <div className="l" style={{ alignItems: 'baseline' }}><strong>Gastos</strong><strong className="c-gasto" style={{ fontSize: 20 }}>{formatoPesos(rTotal.gastos)}</strong></div>
                <div className="l fin"><strong>Saldo</strong><strong className="c-prim" style={{ fontSize: 26 }}>{formatoPesos(rTotal.saldo)}</strong></div>
              </section>
              <section className="caja" style={{ padding: '4px 14px' }} aria-label="Por mes">
                {meses.map((m) => (
                  <button key={m.mes} className="fila-dia" onClick={() => { setMes(m.mes); setTab('mes'); }}>
                    <span><strong>{nombreMes(m.mes)}</strong><small>Ventas {formatoPesos(m.ventas)} · Gastos {formatoPesos(m.gastos)}</small></span>
                    <strong className="c-prim">{formatoPesos(m.saldo)}</strong>
                  </button>
                ))}
              </section>
            </>
          )}
        </div>
      )}
      <div className="firma" style={{ marginTop: 12 }}>Cuadrao {MARCA.firma}</div>
    </div>
  );
}

/* ---------- Compartir reporte ---------- */
function HojaCompartir({ rep, negocio, onCerrar, aviso }) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    let vivo = true;
    dibujarReporte(rep, negocio).then((cv) => {
      cv.toBlob((blob) => { if (vivo && blob) setImg({ blob, url: URL.createObjectURL(blob) }); }, 'image/png');
    }).catch(() => aviso('No se pudo armar la imagen'));
    return () => { vivo = false; };
  }, []);
  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);
  const base = rep.tipo === 'dia' ? `cuadre-${rep.fila.dia.fecha}` : `resumen-${rep.mes}`;
  const archivo = () => new File([img.blob], `${base}${negocio ? '-' + nombreArchivo(negocio) : ''}.png`, { type: 'image/png' });
  const enviar = async () => {
    const r = await compartirArchivo(archivo(), { titulo: 'Cuadre de caja', texto: rep.tipo === 'dia' ? `Cuadre del ${fechaLarga(rep.fila.dia.fecha).toLowerCase()}` : `Resumen de ${nombreMes(rep.mes).toLowerCase()}` });
    if (r === 'descargado') aviso('Imagen guardada en Descargas');
    if (r === 'error') aviso('No se pudo compartir la imagen');
  };
  return (
    <Hoja titulo={rep.tipo === 'dia' ? 'Compartir cuadre' : 'Compartir resumen'} onCerrar={onCerrar} cerrarTexto="Cerrar">
      {img ? <img className="vista-previa" src={img.url} alt="Vista previa del reporte" />
        : <div className="vista-previa cargando" role="status" aria-label="Armando la imagen" />}
      <div className="hoja-acciones">
        <button className="btn-sec" disabled={!img} onClick={() => imprimirImagen(img.url)}>{Ico.pdf}Guardar PDF</button>
        <button className="btn-prim" disabled={!img} onClick={enviar}>{Ico.enviar}Enviar imagen</button>
      </div>
      <p className="ayuda" style={{ textAlign: 'center' }}>"Enviar imagen" abre WhatsApp, correo y las demás apps del celular.</p>
    </Hoja>
  );
}

/* ---------- Restaurar copia ---------- */
function HojaRestaurar({ datos, onConfirmar, onCerrar }) {
  const fechas = datos.dias.filter((d) => !d.ejemplo).map((d) => d.fecha).sort();
  const negocio = datos.config && datos.config.nombre_negocio;
  return (
    <Hoja titulo="Restaurar copia" onCerrar={onCerrar}>
      <div className="explica">
        {negocio && <><strong>{negocio}</strong><br /></>}
        {fechas.length
          ? <>La copia trae <strong>{fechas.length} {fechas.length === 1 ? 'día' : 'días'}</strong>, del {fechaCorta(fechas[0]).toLowerCase()} al {fechaLarga(fechas[fechas.length - 1]).toLowerCase()}.</>
          : 'La copia no trae días registrados.'}
      </div>
      <p className="ayuda" style={{ fontSize: 14, color: 'var(--peligro)', fontWeight: 700 }}>Esto reemplaza todo lo que hay en este celular por lo de la copia.</p>
      <div className="hoja-acciones">
        <button className="btn-sec" onClick={onCerrar}>No, dejar así</button>
        <button className="btn-prim" onClick={onConfirmar}>Sí, restaurar</button>
      </div>
    </Hoja>
  );
}

/* ---------- Ajustes ---------- */
function Tema() {
  const leer = () => { try { return localStorage.getItem(LLAVE_TEMA) || 'auto'; } catch (e) { return 'auto'; } };
  const [tema, setTema] = useState(leer);
  useEffect(() => {
    const r = document.documentElement;
    if (tema === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', tema);
    try { localStorage.setItem(LLAVE_TEMA, tema); } catch (e) {}
  }, [tema]);
  return (
    <div className="fila-tit" style={{ alignItems: 'center' }}>
      <span className="etq">Apariencia</span>
      <div className="tema" role="group" aria-label="Apariencia">
        {[['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, n]) => (
          <button key={v} aria-pressed={tema === v} onClick={() => setTema(v)}>{n}</button>
        ))}
      </div>
    </div>
  );
}
// Aplicar el tema guardado desde el arranque (antes se hacía en Reportes)
try { const t = localStorage.getItem(LLAVE_TEMA); if (t && t !== 'auto') document.documentElement.setAttribute('data-theme', t); } catch (e) {}

function textoUltimaCopia(iso, hoy) {
  if (!iso) return 'Nunca has guardado una copia.';
  const n = diasEntre(hoyBogota(new Date(iso)), hoy);
  return `Última copia: ${n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`}.`;
}

function PantallaAjustes({ db, hoy, acciones, onRestaurar }) {
  const cfg = db.config;
  const [nombre, setNombre] = useState(cfg.nombre_negocio);
  return (
    <div className="pantalla">
      <header className="cab-simple"><h1 className="cab-titulo">Ajustes</h1></header>
      <div className="pila">
        <h2 className="seccion-tit">Copia de seguridad</h2>
        <section className="caja pila">
          <p style={{ margin: 0, fontWeight: 700 }}>{textoUltimaCopia(cfg.ultima_copia, hoy)}</p>
          <p className="ayuda" style={{ fontSize: 13 }}>Tus datos viven solo en este celular. Envíate una copia por WhatsApp o correo: si cambias de celular o se borra la app, con ella recuperas todo.</p>
          <button className="btn-prim ancho" onClick={acciones.enviarCopia}>{Ico.enviar}Enviar copia</button>
          <button className="btn-sec ancho" onClick={onRestaurar}>{Ico.subir}Restaurar una copia</button>
        </section>

        <h2 className="seccion-tit">Mi negocio</h2>
        <section className="caja pila">
          <label htmlFor="aj-nombre" className="etq">Nombre del negocio</label>
          <input id="aj-nombre" className="entrada" maxLength={40} value={nombre} placeholder="Ej. Asadero Doña Rosa"
            onChange={(e) => setNombre(e.target.value)} onBlur={() => acciones.cambiarConfig({ nombre_negocio: nombre.trim() })} />
          <div className="campo-caja" style={{ padding: 0 }}>
            <CampoPesos id="aj-base" etiqueta="Base de cada día" valor={cfg.base_por_defecto} grande placeholder="0"
              onCambio={(n) => acciones.cambiarConfig({ base_por_defecto: n })} />
          </div>
          <p className="ayuda">Los días nuevos arrancan con esta base. Cada día la puedes cambiar en Registro.</p>
          <span className="etq" style={{ marginTop: 4 }}>Gastos de siempre</span>
          <p className="ayuda">Salen cada día en Por anotar. Ahí solo pones el precio.</p>
          <EditorConceptos conceptos={cfg.conceptos} onCambio={(c) => acciones.cambiarConfig({ conceptos: c })} idBase="aj" />
        </section>

        <h2 className="seccion-tit">Apariencia</h2>
        <section className="caja"><Tema /></section>

        <h2 className="seccion-tit">Acerca de</h2>
        <section className="caja acerca">
          <Logo tam={48} />
          <div>
            <p style={{ fontWeight: 800 }}>Cuadrao <span className="cab-sub">v{VERSION_APP}</span></p>
            <p className="ayuda" style={{ fontSize: 13 }}>{MARCA.lema}</p>
            <p className="ayuda">{MARCA.firma}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ===================== App ===================== */
function App() {
  const [db, setDb] = useState(() => repo.cargar());
  const [hoy, setHoy] = useState(hoyBogota());
  const [fecha, setFecha] = useState(hoyBogota());
  const [vista, setVista] = useState('registro');
  const [toast, setToast] = useState('');
  const [reporte, setReporte] = useState(null);
  const [restaurando, setRestaurando] = useState(null);
  const refToast = useRef(null);
  const refArchivo = useRef(null);

  useEffect(() => {
    // Si la app queda abierta pasada la medianoche, mover "hoy"
    const t = setInterval(() => { const h = hoyBogota(); setHoy((prev) => (prev !== h ? h : prev)); }, 60000);
    return () => clearInterval(t);
  }, []);

  const aviso = (m) => {
    setToast(m);
    clearTimeout(refToast.current);
    refToast.current = setTimeout(() => setToast(''), 2600);
  };
  const aplicar = (fn) => {
    setDb((prev) => {
      const next = fn(prev);
      if (next !== prev && !repo.guardar(next)) aviso('No se pudo guardar en el celular. Envía una copia.');
      return next;
    });
  };
  const reemplazar = (nuevo) => { setDb(nuevo); return repo.guardar(nuevo); };

  const acciones = {
    aviso,
    cambiarCampo: (f, cambios) => aplicar((d) => { const [d2, dia] = asegurarDia(d, f); return cambiarDia(d2, dia.id, cambios); }),
    cambiarConfig: (cambios) => aplicar((d) => ({ ...d, config: { ...d.config, ...cambios } })),
    agregarGasto: (f, concepto, monto) => {
      aplicar((d) => { const [d2, dia] = asegurarDia(d, f); return { ...d2, gastos: [...d2.gastos, { id: nuevoId(), dia_id: dia.id, concepto, monto, creado_en: ahoraIso() }] }; });
      aviso(`Gasto agregado: ${concepto} ${formatoPesos(monto)}`);
    },
    agregarTransferencia: (f, monto) => {
      aplicar((d) => { const [d2, dia] = asegurarDia(d, f); return { ...d2, transferencias: [...d2.transferencias, { id: nuevoId(), dia_id: dia.id, monto, nota: '', creado_en: ahoraIso() }] }; });
      aviso(`Transferencia agregada: ${formatoPesos(monto)}`);
    },
    editar: (tipo, id, cambios) => {
      const tabla = tipo === 'gasto' ? 'gastos' : 'transferencias';
      aplicar((d) => ({ ...d, [tabla]: d[tabla].map((x) => (x.id === id ? { ...x, monto: cambios.monto, ...(tipo === 'gasto' ? { concepto: cambios.concepto || x.concepto } : {}) } : x)) }));
      aviso('Cambios guardados');
    },
    borrar: (tipo, id) => {
      const tabla = tipo === 'gasto' ? 'gastos' : 'transferencias';
      aplicar((d) => ({ ...d, [tabla]: d[tabla].filter((x) => x.id !== id) }));
      aviso(tipo === 'gasto' ? 'Gasto borrado' : 'Transferencia borrada');
    },
    cerrarDia: (f) => {
      const dia = buscarDia(db, f);
      if (!dia || !dia.efectivo) { aviso('Escribe el efectivo en caja antes de cerrar el día'); return; }
      aplicar((d) => cambiarDia(d, dia.id, { estado: 'cerrado', cerrado_en: ahoraIso() }));
      aviso('Día cerrado. Compártelo desde "Hoy".');
    },
    reabrirDia: (f) => {
      const dia = buscarDia(db, f);
      if (!dia) return;
      aplicar((d) => cambiarDia(d, dia.id, { estado: 'abierto', cerrado_en: null }));
      aviso('Día reabierto');
    },
    terminarBienvenida: ({ nombre, tipo, conceptos, base, ejemplo }) => {
      aplicar((d) => {
        let n = { ...d, config: { ...d.config, nombre_negocio: nombre, tipo_negocio: tipo, conceptos: limpiarConceptos(conceptos), base_por_defecto: base, bienvenida_hecha: true } };
        if (ejemplo) n = conEjemplo(n, hoy);
        return n;
      });
      if (ejemplo) { setFecha(sumarDias(hoy, -1)); setVista('hoy'); aviso('Así se ve un día ya cuadrado'); }
      else { setFecha(hoy); setVista('registro'); aviso('¡Listo! Ya puedes registrar el día'); }
    },
    borrarEjemplo: () => {
      aplicar((d) => sinEjemplo(d));
      setFecha(hoy);
      aviso('Ejemplo borrado. A registrar el día de verdad.');
    },
    enviarCopia: async () => {
      const copia = { app: 'Cuadrao', exportado_en: ahoraIso(), ...db, config: { ...db.config, ultima_copia: ahoraIso() } };
      const nombre = `cuadrao-copia${db.config.nombre_negocio ? '-' + nombreArchivo(db.config.nombre_negocio) : ''}-${hoy}.txt`;
      // .txt porque Android solo deja compartir ciertos tipos de archivo; adentro va el JSON de siempre
      const archivo = new File([JSON.stringify(copia, null, 2)], nombre, { type: 'text/plain' });
      const r = await compartirArchivo(archivo, { titulo: 'Copia de seguridad de Cuadrao', texto: `Copia de seguridad de Cuadrao${db.config.nombre_negocio ? ' (' + db.config.nombre_negocio + ')' : ''} del ${fechaLarga(hoy).toLowerCase()}. Guárdala: con ella recuperas tus datos.` });
      if (r === 'compartido' || r === 'descargado') {
        aplicar((d) => ({ ...d, config: { ...d.config, ultima_copia: ahoraIso() } }));
        aviso(r === 'compartido' ? 'Copia enviada' : 'Copia guardada en Descargas');
      } else if (r === 'error') aviso('No se pudo crear la copia');
    },
    elegirCopia: () => refArchivo.current && refArchivo.current.click(),
    leerCopia: (archivo) => {
      if (archivo.size > 5 * 1024 * 1024) { aviso('Ese archivo es muy grande para ser una copia'); return; }
      const lector = new FileReader();
      lector.onload = () => {
        try {
          const d = JSON.parse(String(lector.result));
          if (!esDbValida(d)) { aviso('Ese archivo no es una copia de Cuadrao'); return; }
          setRestaurando(d);
        } catch (e) { aviso('Ese archivo no es una copia de Cuadrao'); }
      };
      lector.onerror = () => aviso('No se pudo leer el archivo');
      lector.readAsText(archivo);
    },
    confirmarRestaurar: () => {
      const limpio = normalizarDb(restaurando);
      limpio.config.bienvenida_hecha = true;
      setRestaurando(null);
      if (!reemplazar(limpio)) { aviso('No se pudo guardar la copia restaurada'); return; }
      setFecha(hoy); setVista('registro');
      aviso('Copia restaurada');
    }
  };

  const irA = (v) => { setVista(v); window.scrollTo(0, 0); };
  const entradaArchivo = (
    <input ref={refArchivo} type="file" accept=".txt,.json,text/plain,application/json" className="sr" aria-label="Archivo de copia de seguridad" tabIndex={-1}
      onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) acciones.leerCopia(f); e.target.value = ''; }} />
  );
  const hojas = (
    <>
      {restaurando && <HojaRestaurar datos={restaurando} onConfirmar={acciones.confirmarRestaurar} onCerrar={() => setRestaurando(null)} />}
      {reporte && <HojaCompartir rep={reporte} negocio={db.config.nombre_negocio} aviso={aviso} onCerrar={() => setReporte(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );

  if (!db.config.bienvenida_hecha) {
    return (
      <div className="app">
        <Bienvenida db={db} acciones={acciones} onRestaurar={acciones.elegirCopia} />
        {entradaArchivo}
        {hojas}
      </div>
    );
  }

  return (
    <div className="app">
      <BarraMarca negocio={db.config.nombre_negocio} enAjustes={vista === 'ajustes'} onAjustes={() => irA('ajustes')} onVolver={() => irA('registro')} />
      {vista === 'registro' && <PantallaRegistro db={db} fecha={fecha} setFecha={setFecha} hoy={hoy} acciones={acciones} irA={irA} />}
      {vista === 'hoy' && <PantallaHoy db={db} fecha={fecha} hoy={hoy} irA={irA} compartir={setReporte} />}
      {vista === 'reportes' && <PantallaReportes db={db} hoy={hoy} compartir={setReporte} abrirDia={(f) => { setFecha(f); irA('registro'); }} />}
      {vista === 'ajustes' && <PantallaAjustes db={db} hoy={hoy} acciones={acciones} onRestaurar={acciones.elegirCopia} />}
      {entradaArchivo}

      <div className="abajo">
        <div className="abajo-in">
          <nav className="nav" aria-label="Navegación">
            <button aria-current={vista === 'registro' ? 'page' : undefined} onClick={() => irA('registro')}>{Ico.mas}Registro</button>
            <button aria-current={vista === 'hoy' ? 'page' : undefined} onClick={() => irA('hoy')}>{Ico.barras}{fecha === hoy ? 'Hoy' : 'Día'}</button>
            <button aria-current={vista === 'reportes' ? 'page' : undefined} onClick={() => irA('reportes')}>{Ico.hoja}Reportes</button>
          </nav>
        </div>
      </div>
      {hojas}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// Funciona sin internet: el service worker guarda la app la primera vez que se abre
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
