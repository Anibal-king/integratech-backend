# IntegraTech

Sitio web de **Servicios Integrales de Ingeniería El Salvador, S.A. de C.V. (SIIE)**.

Monorepo con dos paquetes:

```
IntegraTech0.1/
├── backend/     API REST + base de datos (Node.js 22+ / Express 5 / SQLite nativo)
└── frontend/    Sitio web (Astro + React + TypeScript)
```

## Requisitos

- Node.js **22 o superior** (`node --version`)
- npm 10+

## Arranque rápido

### Backend

```bash
cd backend
npm install
node db/seed.js     # crea y puebla db/siie.db (solo la primera vez)
node server.js      # API en http://localhost:3000
```

> Nota: si `npm start` / `npm run` fallan con `spawn ... ENOENT`, es por la variable
> de entorno `ComSpec` del sistema apuntando a una ruta inválida. Se puede usar
> `node server.js` directamente, o corregir `ComSpec` a `C:\Windows\System32\cmd.exe`.

### Frontend

```bash
cd frontend
npm install
npm run dev         # sitio en http://localhost:4321
```

El frontend consume la API del backend mediante la variable `PUBLIC_API_URL`
(ver `frontend/.env.example`).

## Documentación

- API y modelo de datos: [`backend/README.md`](backend/README.md)
