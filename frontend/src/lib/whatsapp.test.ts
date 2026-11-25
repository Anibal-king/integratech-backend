// Pruebas de los enlaces de WhatsApp: `npm test` (Node 22.18+ ejecuta TypeScript sin compilar).
import test from 'node:test';
import assert from 'node:assert/strict';
import { enlaceCotizacion, enlaceDirecto, enlaceWa, mensajeCotizacion, whatsappCliente } from './whatsapp.ts';

test('el enlace de cotización lleva el número de ticket y va codificado', () => {
  const url = enlaceCotizacion('+503 7000-0000', 42, 'Ana Pérez', 'Soluciones Área Industrial');
  assert.ok(url.startsWith('https://wa.me/50370000000?text='));
  const texto = decodeURIComponent(new URL(url).searchParams.get('text') ?? '');
  assert.equal(texto, 'Hola IntegraTech 👋 Vengo por la cotización #42. Soy Ana Pérez, proyecto: Soluciones Área Industrial.');
  // Nada sin codificar que rompa la URL (#, espacios, &)
  assert.ok(!url.split('?text=')[1].includes('#'));
  assert.ok(!url.includes(' '));
});

test('caracteres especiales en el nombre no rompen el enlace', () => {
  const url = enlaceCotizacion('50370000000', 7, 'Ana & <Co>', 'A/B?');
  assert.equal(new URL(url).searchParams.get('text'), mensajeCotizacion(7, 'Ana & <Co>', 'A/B?'));
});

test('sin tipo de proyecto dice "por definir"', () => {
  assert.match(mensajeCotizacion(3, 'Ana', ''), /proyecto: por definir\.$/);
});

test('"Prefiero escribir directo" no lleva ticket', () => {
  const url = enlaceDirecto('50370000000');
  assert.equal(new URL(url).searchParams.get('text'), 'Hola IntegraTech, quiero cotizar un proyecto');
  assert.equal(enlaceWa('503 7000 0000'), 'https://wa.me/50370000000');
});

test('WhatsApp del cliente: código de país por defecto y validaciones', () => {
  assert.deepEqual(whatsappCliente('503', '7000 1234'), { ok: true, valor: '50370001234' });
  assert.deepEqual(whatsappCliente('+1', '(305) 555-0100'), { ok: true, valor: '13055550100' });
  assert.equal(whatsappCliente('503', '').ok, false);
  assert.equal(whatsappCliente('503', '123').ok, false);
  assert.equal(whatsappCliente('503', 'llámame').ok, false);
});
