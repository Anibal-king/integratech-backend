const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ORIGEN, iniciar, cookieAdmin, crearZip } = require('./helpers');

const DIR_CONVERSACIONES = String(process.env.CONVERSACIONES_DIR);

const VALIDO = {
  nombre: 'Ana Pérez',
  whatsapp: '7000 1234',
  tipo_proyecto: 'Soluciones Área Industrial',
  descripcion: 'Necesito cotizar un tablero eléctrico para una bodega.',
  presupuesto: '$5,000',
  fecha_deseada: '2026-12-15',
};

const CHAT = [
  '24/11/26, 9:29 p. m. - Los mensajes y las llamadas están cifrados de extremo a extremo.',
  '24/11/26, 9:30 p. m. - Ana Pérez: Hola IntegraTech 👋 Vengo por la cotización #1.',
  '24/11/26, 9:31 p. m. - IntegraTech: ¡Hola Ana! ¿Nos comparte fotos del sitio?',
  '24/11/26, 9:32 p. m. - Ana Pérez: <b>claro</b>',
  'segunda línea',
].join('\n');

let srv;
let ip = 1;
/** Cada petición pública sale de una IP distinta para no chocar con el límite. */
const publico = (body, ipFija) =>
  fetch(`${srv.url}/api/cotizaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipFija ?? `10.0.0.${ip++}` },
    body: JSON.stringify(body),
  });

/** Sube un archivo como admin (o sin sesión si cookie es ''). */
function subir(ticket, nombre, contenido, cookie) {
  const fd = new FormData();
  fd.append('archivo', new Blob([contenido]), nombre);
  return fetch(`${srv.url}/api/admin/cotizaciones/${ticket}/conversacion`, {
    method: 'POST',
    headers: { Origin: ORIGEN, ...(cookie ? { Cookie: cookie } : {}) },
    body: fd,
  });
}

test.before(async () => {
  srv = await iniciar();
});
test.after(() => srv.cerrar());

test('formulario válido → ticket creado; solo devuelve el número', async () => {
  const r = await publico(VALIDO);
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.deepEqual(Object.keys(body), ['ticket']);
  assert.ok(Number.isInteger(body.ticket) && body.ticket > 0);

  const { get } = require('../db');
  const fila = get('SELECT * FROM leads_chatbot WHERE id = ?', body.ticket);
  assert.equal(fila.origen, 'whatsapp');
  assert.equal(fila.estado, 'nuevo');
  assert.equal(fila.telefono, '50370001234'); // 8 dígitos → se antepone 503
  assert.equal(fila.alcance, VALIDO.descripcion);
  assert.equal(fila.presupuesto, '$5,000');
  assert.equal(fila.plazo, '2026-12-15');
  assert.ok(fila.fecha_creacion);
});

test('validaciones: obligatorios, tipos, largos, teléfono y fecha', async () => {
  const casos = [
    { ...VALIDO, nombre: '' },
    { ...VALIDO, whatsapp: '' },
    { ...VALIDO, descripcion: '' },
    { ...VALIDO, descripcion: 'corta' },
    { ...VALIDO, nombre: 'x'.repeat(121) },
    { ...VALIDO, descripcion: 'x'.repeat(2001) },
    { ...VALIDO, nombre: ['Ana'] },
    { ...VALIDO, whatsapp: 50370001234 },
    { ...VALIDO, whatsapp: 'llámame' },
    { ...VALIDO, whatsapp: '12345' },
    { ...VALIDO, fecha_deseada: '2026-02-30' },
    { ...VALIDO, presupuesto: 'x'.repeat(61) },
  ];
  for (const c of casos) {
    const r = await publico(c);
    assert.equal(r.status, 400, JSON.stringify(c).slice(0, 80));
    assert.ok((await r.json()).error);
  }
});

test('honeypot lleno → 400 y no se crea ticket', async () => {
  const { get } = require('../db');
  const antes = get('SELECT COUNT(*) AS n FROM leads_chatbot').n;
  const r = await publico({ ...VALIDO, sitio_web: 'http://spam.example' });
  assert.equal(r.status, 400);
  assert.equal(get('SELECT COUNT(*) AS n FROM leads_chatbot').n, antes);
});

test('límite de envíos por IP → 429', async () => {
  const codigos = [];
  for (let i = 0; i < 7; i++) codigos.push((await publico(VALIDO, '10.9.9.9')).status);
  assert.deepEqual(codigos.slice(0, 5), [201, 201, 201, 201, 201]);
  assert.equal(codigos[5], 429);
});

test('subida sin autenticación → 401', async () => {
  const r = await subir(1, 'chat.txt', CHAT, '');
  assert.equal(r.status, 401);
});

test('subir .txt: separa mensajes, autores y sistema; la misma exportación dos veces no duplica', async () => {
  const cookie = cookieAdmin();
  const { ticket } = await (await publico(VALIDO)).json();

  const r1 = await subir(ticket, 'Chat de WhatsApp con Ana.txt', CHAT, cookie);
  assert.equal(r1.status, 201);
  const s1 = await r1.json();
  assert.equal(s1.mensajes_leidos, 4);
  assert.equal(s1.mensajes_nuevos, 4);
  assert.equal(s1.necesita_autor, true);
  assert.deepEqual(s1.conversacion.autores, ['Ana Pérez', 'IntegraTech']);
  assert.equal(s1.conversacion.mensajes[0].autor, null);
  assert.equal(s1.conversacion.mensajes[3].texto, '<b>claro</b>\nsegunda línea');

  const r2 = await subir(ticket, 'otra vez.txt', CHAT, cookie);
  const s2 = await r2.json();
  assert.equal(s2.mensajes_nuevos, 0);
  assert.equal(s2.conversacion.mensajes.length, 4);

  // Exportación posterior del mismo chat: solo entra lo nuevo.
  const r3 = await subir(ticket, 'mas.txt', `${CHAT}\n24/11/26, 9:40 p. m. - IntegraTech: Le enviamos la cotización.`, cookie);
  const s3 = await r3.json();
  assert.equal(s3.mensajes_nuevos, 1);
  assert.equal(s3.conversacion.mensajes.length, 5);
  assert.equal(s3.conversacion.archivos.length, 3);

  // Elegir autor IntegraTech
  const put = await fetch(`${srv.url}/api/admin/cotizaciones/${ticket}/autor`, {
    method: 'PUT',
    headers: { Origin: ORIGEN, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ autor: 'IntegraTech' }),
  });
  assert.equal(put.status, 200);
  assert.equal((await put.json()).autor_integratech, 'IntegraTech');
  const malo = await fetch(`${srv.url}/api/admin/cotizaciones/${ticket}/autor`, {
    method: 'PUT',
    headers: { Origin: ORIGEN, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ autor: 'Nadie' }),
  });
  assert.equal(malo.status, 400);

  // Descarga .txt con los datos del ticket arriba
  const d = await fetch(`${srv.url}/api/admin/cotizaciones/${ticket}/conversacion/descarga`, { headers: { Origin: ORIGEN, Cookie: cookie } });
  assert.equal(d.status, 200);
  const txt = await d.text();
  assert.match(txt, new RegExp(`^Cotización #${ticket}`));
  assert.match(txt, /Cliente: +Ana Pérez/);
  assert.match(txt, /\[24\/11\/2026 21:40\] IntegraTech: Le enviamos la cotización\./);
});

test('subir .zip (iPhone con multimedia): solo lee _chat.txt e indica multimedia; no extrae rutas al disco', async () => {
  const cookie = cookieAdmin();
  const { ticket } = await (await publico(VALIDO)).json();
  const zip = crearZip({
    '_chat.txt': '[24/11/26, 9:30:12 p. m.] Ana: Hola\n[24/11/26, 9:31:00 p. m.] Ana: ‎<adjunto: 0001-PHOTO.jpg>',
    '0001-PHOTO.jpg': Buffer.alloc(100, 1),
    '../../fuera.txt': 'no debe salir del zip',
  });
  const r = await subir(ticket, 'WhatsApp Chat - Ana.zip', zip, cookie);
  assert.equal(r.status, 201);
  const s = await r.json();
  assert.equal(s.mensajes_nuevos, 2);
  assert.equal(s.tenia_multimedia, true);
  assert.equal(fs.existsSync(path.resolve(DIR_CONVERSACIONES, '../../fuera.txt')), false);
  // Se guardó el original con nombre aleatorio
  const guardados = fs.readdirSync(DIR_CONVERSACIONES);
  assert.ok(guardados.some((f) => /^[0-9a-f-]{36}\.zip$/.test(f)));
});

test('subida: rechaza extensiones, zip falso, bomba zip y archivos de más de 10 MB', async () => {
  const cookie = cookieAdmin();
  const { ticket } = await (await publico(VALIDO)).json();
  assert.equal((await subir(ticket, 'chat.pdf', CHAT, cookie)).status, 400);
  assert.equal((await subir(ticket, 'chat.zip', CHAT, cookie)).status, 400);
  assert.equal((await subir(ticket, 'vacio.txt', 'nada que ver', cookie)).status, 422);
  const bomba = crearZip({ '_chat.txt': Buffer.alloc(25 * 1024 * 1024, 0x61) });
  assert.ok(bomba.length < 10 * 1024 * 1024);
  assert.equal((await subir(ticket, 'bomba.zip', bomba, cookie)).status, 400);
  assert.equal((await subir(ticket, 'grande.txt', Buffer.alloc(10 * 1024 * 1024 + 1, 0x61), cookie)).status, 413);
});

test('cambio de estado guarda historial (quién y cuándo) y avisos cuenta las nuevas', async () => {
  const cookie = cookieAdmin();
  const { ticket } = await (await publico(VALIDO)).json();
  const h = { Origin: ORIGEN, Cookie: cookie, 'Content-Type': 'application/json' };

  const avisos = await (await fetch(`${srv.url}/api/admin/avisos`, { headers: h })).json();
  assert.ok(avisos.cotizaciones_nuevas >= 1);

  const p = await fetch(`${srv.url}/api/admin/solicitudes/chatbot/${ticket}`, { method: 'PATCH', headers: h, body: JSON.stringify({ estado: 'contactado' }) });
  assert.equal(p.status, 200);
  const sol = await p.json();
  assert.equal(sol.canal, 'whatsapp');
  assert.equal(sol.chatbot.presupuesto, '$5,000');

  const hist = await (await fetch(`${srv.url}/api/admin/cotizaciones/${ticket}/historial`, { headers: h })).json();
  assert.equal(hist.length, 1);
  assert.equal(hist[0].estado_anterior, 'nuevo');
  assert.equal(hist[0].estado_nuevo, 'contactado');
  assert.match(hist[0].admin_correo, /@test\.local$/);
});
