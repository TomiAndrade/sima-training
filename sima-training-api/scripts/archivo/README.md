# Scripts archivados

Scripts one-shot que ya cumplieron su función contra producción y **no se re-ejecutan**. Se conservan tal cual corrieron (no se tocan ni se actualizan a la API actual) como referencia de qué se hizo y cómo — no como algo para correr de nuevo.

Los dos de acá dependían de `POST /auth/login` y de `AUTH_USER`/`AUTH_PASSWORD`, que ya no existen (cleanup post-Auth0, Story 4): ninguno de los dos podría ni loguearse tal cual está. El header de cada archivo explica el resto de los motivos puntuales.

| Script | Qué hizo |
|---|---|
| `crear-administradores.ts` | Creó los 3 usuarios ADMINISTRADOR en producción antes de integrar Auth0, para que Auth0 pudiera linkear cada cuenta por email en su primer login. **Para sumar un administrador nuevo hoy: `../crear-admin.ts`**, que hace lo mismo contra la base con Prisma en vez de por HTTP |
| `migrar-contenido-a-produccion.ts` | Migró el contenido de evaluación de SIMA CHECK (bases, niveles, imágenes, preguntas y módulos) de la base local a producción, escribiendo por HTTP contra la API deployada |

Si en algún momento hace falta un script nuevo contra producción, no reusar estos — armar uno nuevo contra la API actual (Auth0, no `/auth/login`). Es lo que se hizo con `../crear-admin.ts`, que reemplaza a `crear-administradores.ts`: escribe con Prisma directo contra la `DATABASE_URL` en vez de por HTTP, justamente porque con el guard global de Auth0 un script HTTP necesitaría el token de un admin que ya exista.
