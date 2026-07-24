# Pendientes — SIMA TRAINING

Registro vivo de lo que falta. Lista de trabajo, no documento formal — actualizar a medida que se resuelve o aparece algo nuevo.

## Backend

- **Auto-invocar `recalcular()` desde el ABM de usuarios.** Hoy solo se dispara por endpoint (`POST /asignaciones/recalcular/:usuarioId`): si se editan los pares de una persona desde `/usuarios`, las asignaciones AUTOMATICA no se actualizan y quedan desincronizadas sin aviso. Se dejó afuera a propósito para no meter un cambio transversal junto con el modelo de asignaciones.
- **Registro de aprobaciones** ("esta persona aprobó este módulo"). No existe la entidad. Bloqueado hasta que la app tablet se conecte al backend y exista el flujo de rendir evaluación. El hueco ya está aislado en `AsignacionesService.modulosAprobados()` (`sima-training-api/src/asignaciones/asignaciones.service.ts:172`), que hoy devuelve un Set vacío — cuando exista la entidad se completa solo ahí.
- **Llenar `moduloVersionId` en `Asignacion` al rendir.** Hoy queda `null` sin completar (`sima-training-api/prisma/schema.prisma:381`); mismo bloqueo que el punto anterior — depende del flujo de evaluación real.
- **Story 6: vigencia y vencimientos de módulos.** Postergada. El campo `Modulo.vigenciaMeses` ya existe en el schema pero no se usa en ninguna regla.
- **Detección de duplicados/similares al crear una pregunta directo (`POST /preguntas`).** Hoy solo corre en el flujo de import de Excel (`src/import/similitud.ts`, con preview seleccionable). El alta directa (`PreguntasService.create`, `sima-training-api/src/preguntas/preguntas.service.ts:69`) no la corre — queda un TODO explícito ahí. Da para reusar `similitud.ts` en ese path si se vuelve un problema en la práctica.
- ~~`PATCH /modulos/:id/aprobar` (flujo de aprobación de versión)~~ — **RESUELTO**, aunque con otro diseño: el README del backend (Sprint 2) lo dejaba como pendiente, pero el Sprint 3 de versionado lo reemplazó por `PATCH /modulos/:id/activar` (publica el borrador, archiva el ACTIVO anterior, asigna número `AÑO.MAYOR.MENOR`). No quedó un paso de "aprobación" separado — activar y publicar son la misma acción. `sima-training-api/README.md:180` sigue mencionando el endpoint viejo, convendría actualizarlo.
- **AuditLog completo para ISO 9001.** Trazabilidad básica (`created_at/by`, `updated_at/by`, soft-delete) ya existe en todas las entidades; falta el log de auditoría formal.
- **Activar el deploy a la nube.** `Dockerfile` + `render.yaml` están listos (`sima-training-api/render.yaml`) y el CI (`.github/workflows/ci-sima-training.yml`) ya corre lint+build+test, pero falta crear la cuenta en Render/Railway y conectar el repo — nadie lo hizo todavía. El CI no tiene paso de deploy hasta que eso pase.
- **Índices únicos parciales viven solo en las migraciones SQL**, no en `schema.prisma` (Prisma no expresa `WHERE` en `@@unique`). Afecta al menos: `principal` en `VinculacionPuestoCentro`, la asignación vigente única en `Asignacion` (`WHERE revocada_at IS NULL`). Prisma no los recrea en un `db push` ni al regenerar la tabla — tenerlo presente en cualquier migración futura que toque esas tablas.
- **Backfill de vinculación**: al reaplicarlo sobre una base con datos, contar antes los usuarios vivos sin `organizacion_id` — el JOIN los descarta en silencio y quedan sin vinculación (en dev fueron 0 casos, pero no está garantizado en otra base).

## Frontends

- **Migrar el backoffice a la forma nueva de `GET /usuarios`** (rol anidado en `vinculacion`, `parPrincipal`, filtros `?organizacionId=`/`?centroCostoId=`/`?puestoId=`/`?rol=`). Hoy consume la forma vieja (`usuario.rol` plano, `clasificacion`) y está roto — el backend ya no expone esos campos.
- **ABM de pares (puesto, centro) en el form de Usuario.** El `PATCH /usuarios` reemplaza el set completo de pares si se manda `pares` (no hace merge) — el front tiene que mandar siempre todos los pares vigentes, no solo el que cambió.
- **Ninguna pantalla real para `Asignacion`/`ReglaAsignacion`.** El backend ya tiene el modelo completo (`POST/GET /asignaciones`, `POST /asignaciones/recalcular/:usuarioId`, `PATCH /:id/revocar`, CRUD de `/reglas-asignacion`) pero el backoffice no lo consume en ningún lado: `TrainingAssignments.jsx` sigue siendo el mock viejo de HSE (`training-assignments.js`), sin relación con las tablas reales. Falta: pantalla de reglas (qué módulo exige cada par puesto+centro) y pantalla de asignaciones vigentes/revocadas por persona.
- **Conectar la app tablet al backend** (hoy 100% mockeada). Incluye traducir clave→URL de las imágenes de opciones (equivalente de `imagenUrl()` del backoffice) manteniendo la clave cruda como identidad para que `calculateScore` siga comparando bien.

## Producto / negocio

- **INVITADO**: se difirió como estado de acceso de única vez, sin modelar. Quedó fuera de la matriz tipo-de-organización ↔ rol a propósito.
- **Compartir un borrador de módulo como versión beta** para testear antes de publicar. Diseño esbozado en `CLAUDE.md` (Sprint 3): `betaToken` + endpoint público `GET /modulos/beta/:token`. Bloqueado hasta que la tablet se conecte al backend (hoy no hay dónde correr el modo beta).

## Deuda técnica

- **`npm run lint` del backend corre `eslint --fix` sobre todo `{src,test}/**/*.ts`**, no sobre el diff — reformatea archivos ajenos al cambio en curso. Revisar `git status` después de correrlo y revertir lo que no sea propio. Considerar acotarlo al diff (`--fix` solo sobre archivos modificados).
- **READMEs de nivel raíz desactualizados** (`TRAINING/README.md`, `sima-training-backoffice/README.md`, `sima-check-app/README.md`): todavía describen el modelo pre-rename (`employees.js`, `EmployeeSelection.jsx`, entidad "Empleado") que ya no existe en el código — se renombró a `usuario`/`UsuarioSelection` hace varios sprints (ver `CLAUDE.md`). El root README además quedó parado en el nivel de Sprint 1 (tabla de entidades, endpoints y estructura de carpetas no reflejan Preguntas, Módulos versionados, Vinculación ni Asignaciones). El README del backend (`sima-training-api/README.md`) está más al día pero tampoco documenta los endpoints de Sprint 3/4 (versiones, imágenes) ni `/asignaciones`/`/reglas-asignacion`.
