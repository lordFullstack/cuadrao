// Prueba de punta a punta en un Chromium real (con el servidor de `npm run serve` arriba).
//   npm run build && npm run serve   (en otra terminal)
//   npm test
// Revisa: datos viejos de "Caja del Día", bienvenida, reportes, imagen compartible,
// copia de seguridad y que abra sin internet. Deja capturas en prueba-salida/.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const URL_APP = process.env.URL_APP || 'http://localhost:5180/';
const salida = join(dirname(fileURLToPath(import.meta.url)), '..', 'prueba-salida');
await mkdir(salida, { recursive: true });

// Edge o Chrome del PC (o el de CHROME=ruta)
const base = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData/Local'), 'ms-playwright');
const candidatos = [process.env.CHROME,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  join(base, 'chromium-1248/chrome-win64/chrome.exe'), join(base, 'chromium-1194/chrome-win/chrome.exe')].filter(Boolean);
const executablePath = candidatos.find((p) => existsSync(p));

let fallas = 0;
const ok = (cond, texto) => { console.log(`${cond ? '✔' : '✘'} ${texto}`); if (!cond) fallas++; };

const navegador = await chromium.launch({ executablePath });
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', acceptDownloads: true });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const foto = (n) => page.screenshot({ path: join(salida, n + '.png') });
const sinSplash = () => page.waitForSelector('#splash', { state: 'detached', timeout: 4000 });

// 1) Usuario nuevo: bienvenida completa
await page.goto(URL_APP);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(400);
await foto('01-splash');
await sinSplash();
await foto('02-bienvenida-nombre');
await page.getByLabel('Nombre del negocio').fill('Asadero Doña Rosa');
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByRole('button', { name: /Restaurante/ }).click();
await page.getByLabel('Nuevo concepto de gasto').fill('Hielo');
await page.getByRole('button', { name: 'Agregar concepto' }).click();
await page.getByRole('button', { name: 'Quitar Gas' }).click();
const chips = await page.locator('.chip').allInnerTexts();
ok(chips.includes('Hielo') && !chips.includes('Gas') && chips.at(-1) === 'Otro', 'Editar conceptos: agrega Hielo, quita Gas, "Otro" queda al final');
await foto('03-bienvenida-tipo');
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByLabel('Base de cada día').fill('150000');
await foto('04-bienvenida-base');
await page.getByRole('button', { name: 'Ver primero un día de ejemplo' }).click();
await page.waitForSelector('.hero');
ok((await page.locator('.marca-negocio').innerText()) === 'Asadero Doña Rosa', 'El nombre del negocio sale arriba');
await foto('05-hoy-ejemplo');

// 2) Registro de hoy
await page.getByRole('button', { name: 'Registro' }).click();
await page.getByRole('button', { name: 'Día siguiente' }).click();
ok(await page.locator('.aviso.ejemplo').isVisible(), 'Aviso del día de ejemplo visible');
ok((await page.getByLabel('Base', { exact: true }).inputValue()) === '150.000', 'Hoy arranca con la base de la bienvenida');
await page.getByLabel('Valor del gasto').fill('20000');
await page.getByRole('button', { name: 'Agregar gasto' }).click();
await page.getByLabel('Valor de la transferencia').fill('50000');
await page.getByRole('button', { name: 'Agregar transferencia' }).click();
await page.getByLabel('Efectivo en caja').fill('300000');
ok((await page.locator('.cuadre-venta').innerText()) === '220.000', 'Cuadre: 20.000 + 50.000 + 300.000 − 150.000 = 220.000');
await foto('06-registro');
await page.getByRole('button', { name: 'Borrarlo' }).click();
ok(!(await page.locator('.aviso.ejemplo').count()), 'Borrar el ejemplo quita el aviso');

// 3) Reportes: abrir un día (en la versión anterior esto rompía la app) y compartir
await page.getByRole('button', { name: 'Reportes' }).click();
await page.locator('.fila-dia').first().click();
ok((await page.locator('.cuaderno').first().innerText()).includes('220.000'), 'Reportes: el día abierto muestra el cuaderno');
await page.getByRole('button', { name: 'Compartir', exact: true }).click();
await page.waitForSelector('img.vista-previa', { timeout: 8000 });
const tam = await page.evaluate(() => { const i = document.querySelector('img.vista-previa'); return [i.naturalWidth, i.naturalHeight]; });
ok(tam[0] === 1080 && tam[1] > 1000, `Imagen del cuadre armada (${tam.join('×')})`);
await foto('07-compartir');
const b64 = await page.evaluate(async () => {
  const b = await (await fetch(document.querySelector('img.vista-previa').src)).blob();
  return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b); });
});
await writeFile(join(salida, '08-reporte-dia.png'), Buffer.from(b64, 'base64'));
await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

// 4) Ajustes y copia de seguridad
await page.getByRole('button', { name: 'Ajustes y copia de seguridad' }).click();
ok((await page.locator('text=Nunca has guardado una copia.').count()) === 1, 'Ajustes: dice que nunca se ha hecho copia');
await foto('09-ajustes');
// En lugar del menú de compartir del sistema, se atrapa el archivo que se iba a enviar
await page.evaluate(() => {
  window.__enviado = null;
  navigator.canShare = () => true;
  navigator.share = async ({ files }) => { const f = files[0]; window.__enviado = { nombre: f.name, tipo: f.type, texto: await f.text() }; };
});
await page.getByRole('button', { name: 'Enviar copia' }).click();
await page.waitForFunction(() => window.__enviado);
const enviado = await page.evaluate(() => window.__enviado);
const ruta = join(salida, enviado.nombre);
await writeFile(ruta, enviado.texto);
ok(/^cuadrao-copia-asadero-dona-rosa-\d{4}-\d{2}-\d{2}\.txt$/.test(enviado.nombre) && enviado.tipo === 'text/plain', `Copia enviada como ${enviado.nombre}`);
await page.waitForSelector('text=Última copia: hoy.');
ok(true, 'Ajustes: "Última copia: hoy."');

// 5) Restaurar esa copia en un celular "nuevo"
await page.evaluate(() => localStorage.clear());
await page.reload();
await sinSplash();
const [selector] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Ya tengo una copia/ }).click()]);
await selector.setFiles(ruta);
await page.waitForSelector('text=Restaurar copia');
await foto('10-restaurar');
await page.getByRole('button', { name: 'Sí, restaurar' }).click();
await page.waitForSelector('.marca');
ok((await page.locator('.cuadre-venta').innerText()) === '220.000', 'Restaurar devuelve los datos completos');

// 6) Datos viejos de "Caja del Día" (sin la configuración nueva)
await page.evaluate(() => {
  localStorage.setItem('cajadia:v1', JSON.stringify({ version: 1, config: { base_por_defecto: 300000, conceptos: ['Pollo', 'Cocacola', 'Otro'] },
    dias: [{ id: 'd1', fecha: '2026-11-05', base: 300000, efectivo: 520000, estado: 'cerrado' }],
    gastos: [{ id: 'g1', dia_id: 'd1', concepto: 'Pollo', monto: 80000 }], transferencias: [{ id: 't1', dia_id: 'd1', monto: 45000 }] }));
});
await page.reload();
await sinSplash();
ok(await page.locator('.marca').isVisible(), 'Quien ya usaba Caja del Día entra directo, sin bienvenida');
ok((await page.locator('.chip').allInnerTexts()).join() === 'Pollo,Cocacola,Otro', 'Conserva sus conceptos de siempre');

// 7) Sin internet
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForTimeout(500);
await ctx.setOffline(true);
await page.reload();
await sinSplash();
ok(await page.locator('.marca').isVisible(), 'Abre sin internet (service worker)');
await ctx.setOffline(false);

// 8) Modo oscuro
await page.emulateMedia({ colorScheme: 'dark' });
await foto('11-oscuro');

ok(errores.length === 0, `Sin errores de JavaScript${errores.length ? ': ' + errores.join(' | ') : ''}`);
await navegador.close();
console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo en verde');
process.exit(fallas ? 1 : 0);
