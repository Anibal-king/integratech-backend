# Pruebas manuales de QA — IntegraTech

Lo que Playwright no puede comprobar de forma fiable. **Nunca** con datos falsos en el
sistema real: las pruebas en producción se coordinan con SIIE y se borran después.

| ID | Qué | Cómo | Resultado esperado | ✔ |
|---|---|---|---|---|
| D02 | iPhone real con Safari | Recorrer inicio, hero (tocar íconos), servicios, carruseles, formulario | Igual que en la prueba automática D01 (WebKit no es iOS real) | ☐ |
| D07 | Firefox de escritorio | En esta Mac, Firefox de Playwright no arranca («Could not find profile folder»): abrir el sitio local en Firefox normal y repetir hero (hover, clic, Esc, teclado), carruseles y botón «atrás» | Mismo comportamiento que en Chrome | ☐ |
| U06 | Lector de pantalla real | VoiceOver (Mac/iPhone) o NVDA (Windows): recorrer el inicio por títulos y regiones; enviar el formulario | Se entiende sin ver la pantalla; marcas y clientes se leen una sola vez; el cambio del hero se anuncia | ☐ |
| U08b | 3G real y celular de gama baja | Teléfono Android de gama baja con datos móviles | Titular y botones en < 4 s; scroll fluido | ☐ |
| P01 | Correo de aviso (SMTP) | **Producción, coordinado:** una cotización de prueba marcada «PRUEBA QA» | Llega el correo al encargado; luego se borra el ticket | ☐ |
| P02 | WhatsApp abre el chat correcto | Teléfono real: «Continuar en WhatsApp» | Abre el chat de IntegraTech con el mensaje y el número de ticket | ☐ |
| P03 | HTTPS y cookie del panel | Producción: iniciar sesión y revisar la cookie | Cookie `HttpOnly` y `Secure`; todo el sitio en HTTPS | ☐ |
| P04 | Límite de envíos detrás del proxy | Producción: `TRUST_PROXY` configurado | El límite usa la IP real del visitante, no la del proxy | ☐ |
| P05 | Respaldo y restauración | Restaurar la base y las fotos en otra máquina | El sitio y el panel quedan completos | ☐ |
