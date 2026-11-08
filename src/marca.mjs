// Marca de Cuadrao: un solo lugar para el logo, los colores y el eslogan.
// El build los inyecta en index.html (splash), en app.js y en los íconos PNG.

export const NOMBRE = 'Cuadrao';
export const LEMA = 'La caja cuadrá, la plata clara';
export const FIRMA = 'por Synaptix AI Labs';

export const COLORES = {
  verde: '#127A4B',      // verde billete (principal)
  verdeOscuro: '#0C3B26',
  amarillo: '#FFC93C',   // amarillo caribeño (acento)
  crema: '#F5F6F1'       // fondo claro
};

// Logo en una caja de 100×100: cuadrado redondeado abierto arriba a la derecha
// y un chulito que sale por esa abertura.
export const LOGO_CUADRO = 'M62 20H34Q20 20 20 34V66Q20 80 34 80H66Q80 80 80 66V50';
export const LOGO_CHECK = 'M37 50L49 62L84 24';
export const GROSOR_CUADRO = 9;
export const GROSOR_CHECK = 10;

export function logoSvg({ tam = 512, fondo = COLORES.verde, trazo = COLORES.crema, redondeo = 112, escala = 1 } = {}) {
  // escala < 1 achica el logo dentro del fondo (ícono maskable: zona segura)
  const d = (100 - 100 * escala) / 2;
  const rect = fondo ? `<rect width="100" height="100" rx="${(redondeo / 512) * 100}" fill="${fondo}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${tam}" height="${tam}">${rect}` +
    `<g transform="translate(${d} ${d}) scale(${escala})" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${LOGO_CUADRO}" stroke="${trazo}" stroke-width="${GROSOR_CUADRO}"/>` +
    `<path d="${LOGO_CHECK}" stroke="${COLORES.amarillo}" stroke-width="${GROSOR_CHECK}"/></g></svg>`;
}
