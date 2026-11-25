const test = require('node:test');
const assert = require('node:assert/strict');
const { leerChat } = require('../lib/chat-export');

test('Android, 12 h con "p. m." y año de 2 dígitos', () => {
  const r = leerChat('24/11/26, 9:30 p. m. - Ana: Hola, quiero cotizar\n24/11/26, 9:31 p. m. - IntegraTech: ¡Hola Ana!');
  assert.deepEqual(r.mensajes, [
    { fecha_hora: '2026-11-24 21:30:00', autor: 'Ana', texto: 'Hola, quiero cotizar' },
    { fecha_hora: '2026-11-24 21:31:00', autor: 'IntegraTech', texto: '¡Hola Ana!' },
  ]);
  assert.deepEqual(r.autores, ['Ana', 'IntegraTech']);
  assert.equal(r.noReconocidas, 0);
});

test('iPhone, 12 h con segundos y corchetes', () => {
  const r = leerChat('[24/11/26, 9:30:12 p. m.] Ana: Hola, quiero cotizar');
  assert.deepEqual(r.mensajes, [{ fecha_hora: '2026-11-24 21:30:12', autor: 'Ana', texto: 'Hola, quiero cotizar' }]);
});

test('24 h y años de 4 dígitos (Android e iPhone)', () => {
  const r = leerChat('24/11/2026, 21:30 - Ana: Android 24 h\n[25/11/2026, 08:05:09] Ana: iPhone 24 h');
  assert.deepEqual(
    r.mensajes.map((m) => m.fecha_hora),
    ['2026-11-24 21:30:00', '2026-11-25 08:05:09']
  );
});

test('12 a. m. es medianoche y 12 p. m. mediodía; variantes "a.m."/"PM"', () => {
  const r = leerChat('1/2/26, 12:05 a. m. - A: x\n1/2/26, 12:05 p.m. - A: y\n1/2/26, 3:00 PM - A: z');
  assert.deepEqual(
    r.mensajes.map((m) => m.fecha_hora),
    ['2026-02-01 00:05:00', '2026-02-01 12:05:00', '2026-02-01 15:00:00']
  );
});

test('mensajes de varias líneas (líneas en blanco incluidas)', () => {
  const r = leerChat('24/11/26, 9:30 p. m. - Ana: Necesito:\n- tablero eléctrico\n\n- 3 luminarias\n24/11/26, 9:31 p. m. - Ana: Gracias');
  assert.equal(r.mensajes.length, 2);
  assert.equal(r.mensajes[0].texto, 'Necesito:\n- tablero eléctrico\n\n- 3 luminarias');
  assert.equal(r.noReconocidas, 0);
});

test('mensajes del sistema sin autor (Android y aviso de cifrado de iPhone)', () => {
  const r = leerChat(
    [
      '24/11/26, 9:29 p. m. - Los mensajes y las llamadas están cifrados de extremo a extremo. Nadie fuera de este chat, ni siquiera WhatsApp, puede leerlos ni escucharlos.',
      '[24/11/26, 9:29:00 p. m.] Ana: ‎Los mensajes y las llamadas están cifrados de extremo a extremo.',
      '24/11/26, 9:30 p. m. - Ana: Hola',
    ].join('\n')
  );
  assert.equal(r.mensajes[0].autor, null);
  assert.equal(r.mensajes[1].autor, null);
  assert.equal(r.mensajes[2].autor, 'Ana');
  assert.deepEqual(r.autores, ['Ana']);
});

test('caracteres invisibles \\u200e, \\u202f, \\u00a0 y BOM', () => {
  const r = leerChat('﻿‎[24/11/26, 9:30:12 p. m.] Ana: ‎Hola mundo');
  assert.deepEqual(r.mensajes, [{ fecha_hora: '2026-11-24 21:30:12', autor: 'Ana', texto: 'Hola mundo' }]);
  const a = leerChat('24/11/26, 9:30 p. m. - Ana: Hola');
  assert.equal(a.mensajes[0].fecha_hora, '2026-11-24 21:30:00');
});

test('líneas raras: no falla, las pega al mensaje anterior y las cuenta', () => {
  const r = leerChat(
    [
      'basura antes del primer mensaje',
      '24/11/26, 9:30 p. m. - Ana: Hola',
      '32/13/26, 9:31 p. m. - Ana: fecha imposible',
      '24/11/26 sin hora',
      'continuación normal',
      '30/02/26, 10:00 - Ana: 30 de febrero',
    ].join('\n')
  );
  assert.equal(r.mensajes.length, 1);
  assert.equal(r.noReconocidas, 4); // basura inicial + 3 líneas con fecha inválida
  assert.match(r.mensajes[0].texto, /fecha imposible/);
  assert.match(r.mensajes[0].texto, /continuación normal/);
});

test('CRLF y multimedia omitida', () => {
  const r = leerChat('24/11/26, 9:30 p. m. - Ana: <Multimedia omitido>\r\n24/11/26, 9:31 p. m. - Ana: ok\r\n');
  assert.equal(r.mensajes.length, 2);
  assert.equal(r.mensajes[1].texto, 'ok');
  assert.equal(r.multimediaReferenciada, true);
});

test('el texto puede contener HTML: se guarda tal cual (se escapa al mostrar)', () => {
  const r = leerChat('24/11/26, 9:30 p. m. - Ana: <script>alert(1)</script>');
  assert.equal(r.mensajes[0].texto, '<script>alert(1)</script>');
});
