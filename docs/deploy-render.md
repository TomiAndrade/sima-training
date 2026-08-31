# Deploy de `sima-training-api` en Render

Runbook del primer deploy real del backend. Es **manual desde el dashboard de Render**, no vía Blueprint: `sima-training-api/render.yaml` no se aplica solo, es un checklist versionado de qué tipear en cada campo. Esta guía asume que el Web Service se crea a mano y usa ese archivo como referencia.

Estado de partida: cuenta Render en plan **Pro**, base Postgres **Basic-256mb** ya creada a mano en el dashboard, región **Ohio**.

> Nota sobre `docs/decisiones/infraestructura.md`: ese archivo dice que "el CI corre lint + build + test + un smoke test de `start:prod`". Al escribir esta guía se verificó que **no existe ningún workflow de CI** en el repo (`.github/workflows/` está vacío) — esa afirmación está desactualizada, no hay pipeline que valide nada antes de un deploy manual. Todo lo de acá asume que se corre y se verifica a mano.

## 1. Antes de tocar el dashboard

1. Tener a mano `sima-training-api/.env.render.example` — es la lista completa de variables, con placeholders y de dónde sale cada valor real.
2. Armar (fuera del repo, o en un `.env.render` local que **no se commitea** — ya está en `.gitignore`) los valores reales:
   - `JWT_SECRET`: generar con `openssl rand -base64 48` (o equivalente). Nunca el `dev-secret` de `auth.module.ts`.
   - `AUTH_USER` / `AUTH_PASSWORD`: las credenciales reales del backoffice.
   - Credenciales de Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`): crear el bucket y el Account API Token en el dashboard de Cloudflare (permiso "Object Read & Write" acotado al bucket) **antes** de crear el Web Service — el arranque falla si `STORAGE_DRIVER=r2` y falta cualquiera de las cuatro.
   - `SENTRY_DSN` (opcional): del proyecto de Sentry si ya existe.

## 2. Crear el Web Service

En el dashboard de Render, **New → Web Service**, conectando el repo `TomiAndrade/sima-training`.

- **Root Directory**: `sima-training-api` — el repo tiene dos proyectos hermanos (`sima-training-api`, `sima-training-backoffice`; la app tablet `sima-check-app` salió a su propio repo el 2026-08-31), y el Dockerfile vive dentro del primero.
- **Runtime**: Docker (usa `sima-training-api/Dockerfile` tal cual, sin build/start command propios de Render).
- **Plan**: Starter.
- **Region**: Ohio — **misma región que la base**, para poder usar la Internal Database URL (ver punto 4).
- **Branch**: `main` — es la rama de producción del repo (`develop`/`main` con flujo propio, nunca se pushea directo a `main`); el deploy sale de ahí, no de `develop`.
- **Health Check Path**: `/health`. No se infiere solo — si no se completa este campo, Render usa `/` por defecto.
- **Pre-Deploy Command**: `npx prisma migrate deploy`. Corre una sola vez antes de que el nuevo release reciba tráfico, y no se aplica sola: hay que tipearla en este campo. (El `CMD` del Dockerfile ya **no** corre la migración — sólo levanta `node dist/main`. Si algún día se vuelve a embeber en el `CMD`, va a correr en cada restart del contenedor y no sólo en cada deploy.)

## 3. Variables de entorno

Cargar en la sección "Environment" del Web Service, una por una, siguiendo `sima-training-api/.env.render.example`. Resumen de origen:

| Variable | De dónde sale |
|---|---|
| `PORT` | Render la inyecta sola; normalmente no hace falta tocarla |
| `NODE_ENV` | El Dockerfile ya la fija a `production` en el stage de runtime |
| `DATABASE_URL` | Dashboard → tu Postgres → pestaña "Connections" (ver punto 4) |
| `JWT_SECRET`, `AUTH_USER`, `AUTH_PASSWORD` | Generados/definidos a mano (paso 1) |
| `CORS_ORIGINS` | Dominios reales del backoffice y de la tablet en producción, separados por coma — sin ellos definidos todavía, dejar vacío hace que el backend caiga al fallback de `localhost` (ver `main.ts`), que no sirve para nada en Render pero tampoco rompe el arranque |
| `STORAGE_DRIVER`, `R2_*` | Fijo `r2` + credenciales de Cloudflare (paso 1) |
| `SENTRY_DSN` | Dashboard de Sentry, opcional — vacío = Sentry apagado |
| `TABLET_LOGIN_SIN_PIN`, `TABLET_JWT_EXPIRES_IN` | Config de producto, no son secretos — copiar tal cual de `.env.render.example` |

## 4. Trampas conocidas

- **`NODE_ENV=production` rompiendo `npm ci` por saltear devDependencies — NO aplica acá.** Es un problema típico de un build nativo de Render (sin Docker), donde el build command corre con `NODE_ENV=production` ya seteado y `npm ci`/`npm install` saltean `devDependencies` (TypeScript, `@nestjs/cli`, etc.), rompiendo la compilación. Este proyecto usa `runtime: docker`, y el `Dockerfile` ya separa build de runtime: el stage de **build** corre `npm ci` completo sin `NODE_ENV` seteado (compila con TypeScript disponible), y sólo el stage de **runtime** fija `NODE_ENV=production` y corre `npm ci --omit=dev` sobre el `dist` ya compilado. No hay nada que tocar — sólo no "arreglarlo" moviendo el `ENV NODE_ENV=production` al stage de build.
- **Internal vs External Database URL.** Con el Web Service y la base en la misma región (Ohio), usar la **Internal Database URL** (dashboard → Postgres → Connections) — es más rápida y no tiene costo de transferencia. La **External** sólo hace falta si en algún momento terminan en regiones distintas, o para conectarse desde fuera de Render (ej. un cliente de Postgres local).
- **El seed se corre a mano, una sola vez, nunca en un comando de deploy.** Ni en `preDeployCommand` ni en el `CMD` del Dockerfile. Para sembrar la organización interna (seed base) o el contenido real de SIMA CHECK (`SEED_SIMA_CHECK=true`), conectarse a la base de producción con la `DATABASE_URL` real (típicamente vía la External Database URL desde la máquina local, o un shell en el propio servicio de Render) y correr `npx prisma db seed` manualmente. No hay ningún escenario en el que este comando deba ejecutarse automáticamente en cada deploy — reharía trabajo sobre datos reales de la nómina.
- **`STORAGE_DRIVER` mal seteado no falla en silencio.** Si queda vacío, cae al default `local` del código (`storage.module.ts`) — pierde todas las imágenes en el primer redeploy porque el contenedor es efímero. Si tiene cualquier valor que no sea `local` ni `r2` (typo), el módulo tira `Error` al construirse y **el servicio no arranca** — es una falla ruidosa y rápida, a propósito.
- **`AUTH_USER`/`AUTH_PASSWORD` sin setear no rompen el arranque.** El servicio queda sano pero **nadie puede loguearse** (401 siempre) — es la falla silenciosa opuesta a la de `STORAGE_DRIVER`. Confirmar que las dos variables están cargadas antes de dar el deploy por terminado, no alcanza con que `/health` responda 200.
- **`CORS_ORIGINS` vacía bloquea todo, no lo abre.** Si se carga la variable pero con un valor vacío (en vez de no cargarla), el backend no usa el fallback de desarrollo — bloquea todos los orígenes en silencio. Si todavía no hay dominios de producción definidos, mejor no cargar la variable en absoluto que cargarla vacía.

## 5. Verificación post-deploy

1. `GET https://<tu-servicio>.onrender.com/health` → `{ status: 'ok', db: 'ok', ... }`. Si `db: 'error'`, revisar `DATABASE_URL` antes que nada más — el resto del deploy pudo haber salido bien igual.
2. Probar login contra `/auth/login` con las credenciales de `AUTH_USER`/`AUTH_PASSWORD` reales.
3. Subir una imagen de pregunta desde el backoffice (una vez que apunte a esta API) y confirmar que aparece en el bucket de R2, no en un disco que Render va a borrar en el próximo redeploy.
4. Recién ahí, si hace falta, correr el seed a mano (ver trampas arriba).
