# Chatbot de captura de leads — diseño del flujo

Widget flotante (abajo a la derecha en todo el sitio). Dos objetivos:

1. **Capturar leads de cotización** → los envía a `POST /api/lead-chatbot`, que
   guarda el lead y manda un correo con el resumen al cliente.
2. **Derivar a WhatsApp** → abre `https://wa.me/<número>` con un mensaje
   prellenado (con el resumen si ya hay datos capturados).

## Árbol de pasos

```
┌─ inicio ───────────────────────────────────────────────┐
│ "¿Cómo te podemos ayudar?"                              │
│   [📝 Cotizar un proyecto] ─────────────► tipo_servicio │
│   [💬 Hablar por WhatsApp] ─────────────► (WhatsApp)    │
└────────────────────────────────────────────────────────┘

tipo_servicio   (opciones rápidas)
  • Proyectos de Automatización
  • Soluciones Área Comercial
  • Soluciones Área Industrial
  • Soluciones Energía Renovable y Calidad
  • Auditorías Energéticas
  • Mantenimiento de Infraestructura
  • Asesoría para Ahorro Energético
  • Otro / No estoy seguro
        └──► alcance

alcance         (texto libre, multilínea)
  "¿Qué necesitás resolver / qué equipos o áreas involucra?"
        └──► ubicacion

ubicacion       (texto libre)
  "Municipio y departamento"
        └──► plazo

plazo           (opciones rápidas)
  • Lo antes posible
  • En 1–3 meses
  • En más de 3 meses
  • Solo estoy cotizando
        └──► nombre

nombre          (texto, obligatorio, mín. 2 caracteres)
        └──► empresa

empresa         (texto, opcional — botón "Omitir")
        └──► correo

correo          (texto, opcional si hay teléfono; valida formato email)
        └──► telefono

telefono        (texto, obligatorio, mín. 7 dígitos)
        └──► resumen

resumen         (revisión + opciones)
  Muestra todos los datos capturados.
   [✅ Enviar solicitud] ──► enviando ──► POST /api/lead-chatbot
   [↺ Empezar de nuevo]  ──► inicio
   [💬 Mejor por WhatsApp]──► (WhatsApp con resumen)

enviando  → llamada al backend
   éxito  → enviado : "Un asesor te contactará…"  [💬 WhatsApp] [↺ Nueva consulta]
   fallo  → error   : "No pudimos enviar…"        [↻ Reintentar] [💬 WhatsApp] [↺ Reiniciar]
```

### Regla de contacto
El backend exige **al menos uno** de `correo` o `telefono`. En el flujo, `correo`
es opcional y `telefono` es obligatorio → siempre hay una vía de contacto.

## Campos que se envían al backend

| Campo           | Origen del paso   | Obligatorio |
|-----------------|-------------------|-------------|
| `tipo_servicio` | tipo_servicio     | no          |
| `alcance`       | alcance           | no          |
| `ubicacion`     | ubicacion         | no          |
| `plazo`         | plazo             | no          |
| `nombre`        | nombre            | **sí**      |
| `empresa`       | empresa           | no          |
| `correo`        | correo            | correo o teléfono |
| `telefono`      | telefono          | correo o teléfono |
| `origen`        | fijo: `chatbot`   | —           |

## Configuración

**backend/.env** (copiar de `.env.example`):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=cuenta@gmail.com
SMTP_PASS=clave-de-aplicacion-16-digitos
MAIL_FROM=IntegraTech <no-reply@integratech.com>
MAIL_TO_LEADS=cliente@ejemplo.com
```

Sin SMTP configurado el lead igual se guarda en la tabla `leads_chatbot` y el
endpoint responde `{"emailSent": false}`.

**frontend/.env**:

```
PUBLIC_API_URL=http://localhost:3000
PUBLIC_WHATSAPP_NUMBER=50378654321        # número del cliente, sin "+"
PUBLIC_WHATSAPP_MESSAGE=Hola, escribo desde el sitio web…
```

Si `PUBLIC_WHATSAPP_NUMBER` está vacío, el botón de WhatsApp del paso inicial se
oculta (el resto del flujo funciona igual).

## Archivos

| Parte    | Archivo |
|----------|---------|
| Flujo    | `frontend/src/components/ChatWidget.tsx` (constante `STEPS`) |
| Endpoint | `backend/routes/lead-chatbot.js` |
| Correo   | `backend/lib/mailer.js` |
| Tabla    | `backend/db/schema.sql` → `leads_chatbot` |

## Revisar leads recibidos

```
GET /api/lead-chatbot        → JSON con todos los leads, más recientes primero
```
(Endpoint administrativo; conviene protegerlo con autenticación antes de producción.)
