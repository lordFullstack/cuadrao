// Arma dist/ (la app lista para publicar): compila app.jsx, copia React y la fuente,
// genera los íconos PNG y el service worker con la lista de archivos para uso sin internet.
//   npm run build
import { transform } from 'esbuild';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, rm, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/marca.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(raiz, 'src');
const dist = join(raiz, 'dist');
const pkg = JSON.parse(await readFile(join(raiz, 'package.json'), 'utf8'));

await rm(dist, { recursive: true, force: true });
for (const d of ['vendor', 'fonts', 'icons']) await mkdir(join(dist, d), { recursive: true });

// 1) App: JSX → JS minificado, con la marca y la versión adelante
const marca = {
  verde: M.COLORES.verde, verdeOscuro: M.COLORES.verdeOscuro, amarillo: M.COLORES.amarillo, crema: M.COLORES.crema,
  lema: M.LEMA, firma: M.FIRMA, logoCuadro: M.LOGO_CUADRO, logoCheck: M.LOGO_CHECK,
  grosorCuadro: M.GROSOR_CUADRO, grosorCheck: M.GROSOR_CHECK
};
const jsx = await readFile(join(src, 'app.jsx'), 'utf8');
const cabecera = `const MARCA = ${JSON.stringify(marca)};\nconst VERSION_APP = ${JSON.stringify(pkg.version)};\n`;
const { code } = await transform(cabecera + jsx, { loader: 'jsx', minify: true, target: 'es2019', legalComments: 'none' });
await writeFile(join(dist, 'app.js'), code);

// 2) React y la fuente, locales (nada se baja de internet al abrir)
await copyFile(join(raiz, 'node_modules/react/umd/react.production.min.js'), join(dist, 'vendor/react.production.min.js'));
await copyFile(join(raiz, 'node_modules/react-dom/umd/react-dom.production.min.js'), join(dist, 'vendor/react-dom.production.min.js'));
for (const w of [400, 600, 700, 800]) {
  await copyFile(join(raiz, `node_modules/@fontsource/manrope/files/manrope-latin-${w}-normal.woff2`), join(dist, `fonts/manrope-${w}.woff2`));
}

// 3) Íconos
const png = (svg, tam, archivo) => sharp(Buffer.from(svg)).resize(tam, tam).png().toFile(join(dist, 'icons', archivo));
const redondo = M.logoSvg({ tam: 1024 });
const completo = M.logoSvg({ tam: 1024, redondeo: 0, escala: 0.62 }); // maskable: fondo completo y logo en zona segura
const apple = M.logoSvg({ tam: 1024, redondeo: 0, escala: 0.8 });
await writeFile(join(dist, 'icons/icon.svg'), M.logoSvg({ tam: 512 }));
await png(redondo, 192, 'icon-192.png');
await png(redondo, 512, 'icon-512.png');
await png(completo, 512, 'icon-maskable-512.png');
await png(apple, 180, 'apple-touch-icon.png');

// 4) index.html y manifest
let html = await readFile(join(src, 'index.html'), 'utf8');
html = html.replaceAll('{{LOGO_CUADRO}}', M.LOGO_CUADRO).replaceAll('{{LOGO_CHECK}}', M.LOGO_CHECK)
  .replaceAll('{{LEMA}}', M.LEMA).replaceAll('{{FIRMA}}', M.FIRMA).replaceAll('{{VERSION}}', pkg.version);
await writeFile(join(dist, 'index.html'), html);
await copyFile(join(src, 'manifest.webmanifest'), join(dist, 'manifest.webmanifest'));

// 5) Service worker: versión = versión del paquete + huella del contenido
async function listar(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await listar(p)); else out.push(p);
  }
  return out;
}
const archivos = (await listar(dist)).sort();
const huella = createHash('sha256');
for (const a of archivos) huella.update(relative(dist, a)).update(await readFile(a));
const version = `cuadrao-${pkg.version}-${huella.digest('hex').slice(0, 8)}`;
const lista = ['./', ...archivos.map((a) => './' + relative(dist, a).split('\\').join('/'))];
const sw = (await readFile(join(src, 'sw.js'), 'utf8')).replace('__VERSION__', version).replace('__ARCHIVOS__', JSON.stringify(lista, null, 2));
await writeFile(join(dist, 'sw.js'), sw);

console.log(`dist/ listo · ${version} · ${lista.length} archivos en caché`);
