# La Cerámica — Web

Sitio estático con **Astro** para el restaurante **La Cerámica** (Barbastro, Huesca), más una **API en Node (Express)** para reservas, horarios en zona **Europa/Madrid** y un panel de administración.

## Qué incluye el repositorio

| Área | Descripción |
|------|-------------|
| **Landing** (`src/pages/index.astro`) | Página principal con secciones: hero, nosotros, carta, experiencia, horario, testimonios, ubicación, FAQ y CTA a reservas. |
| **Reservas** (`src/pages/reservar.astro`) | Formulario con calendario, franjas horarias según API y preferencia de zona (terraza, interior, barra). |
| **Admin** (`src/pages/admin.astro`) | Listado de reservas y cambio de estado (pendiente / confirmada / cancelada) tras iniciar sesión. |
| **API** (`server/index.js`) | Express en el puerto configurado (por defecto `3000`). Rutas bajo `/api`. |
| **Datos** (`server/db.js` + `server/data/db.json`) | Persistencia con **lowdb** (JSON). El archivo real de datos **no** se versiona (ver `.gitignore`). |
| **Horarios** (`server/schedule.js`) | Generación de slots, límites de antelación, aforo por franja, etc. |
| **Correo** (`server/mail.js`) | Confirmación por **Nodemailer** si defines SMTP; si no, el contenido del mail se registra en consola. |

## Estructura de carpetas (resumen)

```text
la-ceramica/
├── public/              # Estáticos servidos tal cual (p. ej. logo.svg)
├── src/
│   ├── components/      # Bloques Astro de la landing y pie
│   ├── layouts/         # Layout base (meta, estilos globales)
│   └── pages/           # index, reservar, admin
├── server/
│   ├── index.js         # App Express y rutas API
│   ├── schedule.js      # Lógica de franjas y calendario
│   ├── db.js            # lowdb
│   ├── mail.js          # Envío de correos de reserva
│   └── data/            # db.json generado en runtime (gitignored)
├── astro.config.mjs     # Proxy /api → http://127.0.0.1:3000 en desarrollo
├── .env.example         # Plantilla de variables (copiar a .env)
└── package.json
```

## Requisitos

- **Node.js** LTS (recomendado 20+)
- npm

## Puesta en marcha

```bash
cd la-ceramica
npm install
cp .env.example .env   # En Windows: copy .env.example .env
```

Edita `.env` con tus valores (sobre todo `SESSION_SECRET`, `ADMIN_PASSWORD` o `ADMIN_PASSWORD_HASH`, y opcionalmente SMTP).

### Desarrollo (recomendado)

Arranca **Astro** y la **API** a la vez (el front en desarrollo hace proxy de `/api` al servidor Node):

```bash
npm run dev
```

- Front: suele ser `http://localhost:4321`
- API: `http://127.0.0.1:3000` (según `PORT` en `.env`)

### Por separado

```bash
npm run dev:astro   # Solo Astro
npm run dev:api     # Solo Express
```

### Build de la web

```bash
npm run build
```

Genera `dist/` (sitio estático). La API **no** se empaqueta ahí: en producción hay que desplegar el proceso Node (o integrar las rutas en otro backend) y configurar el dominio para que `/api` apunte a ese servicio.

## API (rutas principales)

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/api/health` | Comprobación rápida. |
| `GET` | `/api/meta` | Metadatos (opciones de servicio, límites, etc.). |
| `GET` | `/api/calendar-month?year=&month=` | Días relevantes del mes para el calendario. |
| `GET` | `/api/slots?date=YYYY-MM-DD` | Franjas disponibles para una fecha. |
| `POST` | `/api/reservations` | Crear reserva (cuerpo JSON con fecha, hora, comensales, contacto, notas, `services` opcional). |
| `POST` | `/api/admin/login` | Inicio de sesión (contraseña en `.env`). |
| `POST` | `/api/admin/logout` | Cerrar sesión. |
| `GET` | `/api/admin/session` | Estado de sesión admin. |
| `GET` | `/api/admin/reservations?from=&to=` | Listado (requiere sesión). |
| `PATCH` | `/api/admin/reservations/:id` | Actualizar `status` de una reserva (requiere sesión). |

## Variables de entorno

La referencia completa está en **`.env.example`**. Resumen:

- **`PORT`**: puerto de Express (por defecto `3000`).
- **`SESSION_SECRET`**: clave de la cookie de sesión del admin.
- **`ADMIN_PASSWORD`** o **`ADMIN_PASSWORD_HASH`**: acceso al panel `/admin`.
- **`RESTAURANT_MAX_COVERS_PER_TIMESLOT`**, **`MAX_BOOKING_DAYS_AHEAD`**, **`BOOKING_MIN_LEAD_MINUTES`**: aforo y reglas de reserva.
- **`SMTP_*`**, **`MAIL_FROM`**, **`MAIL_BCC`**: correo transaccional (opcional).

> **Importante:** no subas `.env` ni `server/data/db.json` al repositorio. Mantén contraseñas y SMTP fuera del control de versiones.

## Licencia y uso

Proyecto **privado** (`"private": true` en `package.json`). Ajusta licencia y `site` en `astro.config.mjs` cuando tengas dominio definitivo.
