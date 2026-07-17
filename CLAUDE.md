# TRAINING — SIMA TRAINING Platform

## Qué es esto

MVP de alta fidelidad para validar la plataforma **SIMA TRAINING** de **Ingeniería Sima** ante clientes de la industria Oil & Gas. Nació como demo navegable solo-frontend (datos mockeados) y desde el **Sprint 1** tiene un **backend real** (NestJS + PostgreSQL): el ABM de Usuarios del backoffice ya persiste contra base de datos. La app tablet sigue mockeada por ahora.

**SIMA CHECK** (capacitaciones y evaluaciones industriales) es el primer producto integrado en la plataforma. La arquitectura está preparada para incorporar productos futuros (SIMA INSPECTIONS, SIMA AUDITS, etc.) sin reorganizaciones.

## Tres proyectos independientes

| Proyecto | Descripción | Puerto dev |
|---|---|---|
| `sima-training-api/` | **Backend** NestJS + PostgreSQL + Prisma (Sprint 1) | 3000 |
| `sima-training-backoffice/` | Backoffice de la plataforma SIMA TRAINING | 5173 |
| `sima-check-app/` | App de evaluación para tablets industriales (producto SIMA CHECK) | 5174 |

## Stack técnico

**Frontends** (`sima-training-backoffice`, `sima-check-app`):
- **Vite + React** (template react)
- **Tailwind CSS v3** + PostCSS + Autoprefixer
- Sin router (navegación con `useState`)

**Backend** (`sima-training-api`):
- **NestJS 11** + TypeScript (monolito modular por dominio)
- **PostgreSQL 16** (local vía Docker Compose)
- **Prisma 6** (ORM + migraciones)
- **JWT** para auth básica (sin roles todavía)

> El backoffice ya consume la API real para **Usuarios** (ver `src/core/api/`). El resto de las pantallas sigue con datos mockeados; se migran ABM por ABM en sprints siguientes. La app tablet (`sima-check-app`) todavía no está conectada.

## Cómo correr

Detalle completo del backend en [`sima-training-api/README.md`](sima-training-api/README.md).

```bash
# 1. Backend (requiere Docker Desktop corriendo)
cd TRAINING/sima-training-api
npm install
cp .env.example .env
docker compose up -d db          # PostgreSQL local
npx prisma migrate dev           # crea las tablas
npx prisma db seed               # organización interna + módulos base
npm run start:dev                # → http://localhost:3000

# 2. Backoffice
cd TRAINING/sima-training-backoffice
npm install
cp .env.example .env             # VITE_API_URL apunta al backend local
npm run dev                      # → http://localhost:5173

# 3. App tablet (mockeada, sin backend aún)
cd TRAINING/sima-check-app
npm install
npm run dev                      # → http://localhost:5174
```

## Paleta de colores

**Backoffice** — estética industrial/corporativa, paleta `zinc` (sin tinte azul del `slate`):
- Fondo general: `zinc-950`
- Superficies de contenido (cards, modales, tablas): `zinc-800` con bordes `zinc-700`
- Acento principal: `red-600`
- Tipografía Inter, valores técnicos en `font-mono`
- Estados: `emerald-500` (aprobado) · `red-600` (desaprobado/peligro) · `amber-500` (advertencia)

**App tablet** — modo claro, optimizado para uso en exteriores (Oil & Gas):
- Fondo general: imagen `public/SIMACHECK-FONDO.png` con `backgroundSize: cover` en `App.jsx`
- Cards: `bg-white border border-slate-200 shadow-2xl`
- Texto principal: `slate-900` · secundario: `slate-500`
- Acento: `red-600`
- Logo: siempre visible encima de la card, cargado desde `public/logo.png` en `App.jsx`

## Backend — `sima-training-api` (Sprint 1)

Monolito NestJS organizado por dominio. Detalle en [`sima-training-api/README.md`](sima-training-api/README.md).

### Entidades reales (Prisma — `prisma/schema.prisma`)

| Entidad | Campos clave |
|---|---|
| `Usuario` | `id, nombre, apellido, dni` (único), `email?, rol` (ADMINISTRADOR/COORDINADOR/ALUMNO), `clasificacion?` (SIMA/CLIENTE/SUBCONTRATISTA/INVITADO, solo si `rol = ALUMNO`), `organizacionId` (FK), `datos` (jsonb) + trazabilidad + `deletedAt` (soft-delete) |
| `Organizacion` | `id, nombre, tipo` (CLIENTE/SUBCONTRATISTA/**INTERNA**), `organizacionPadreId` (FK self-referencial), `activa` + trazabilidad |
| `Pregunta` | `id (uuid), texto, tipo` (VERDADERO_FALSO/OPCION_MULTIPLE/OPCIONES_IMAGEN/TEXTO_LIBRE), `opciones?` (jsonb: array de strings — texto en OPCION_MULTIPLE, **claves de storage** en OPCIONES_IMAGEN), `respuestaCorrecta?` (el string exacto de una de las opciones; el backend lo valida), `imagen?, puntajeMax?, activa` + trazabilidad. Única: se comparte entre módulos, nunca se duplica. `imagen` es la **imagen del enunciado**: guarda una **clave opaca** de storage (`preguntas/<uuid>.png`, se sirve bajo `/uploads`) o una ruta legacy relativa a `public/` si vino del import de Excel. Se setea solo al crear y es **inmutable** (ver Sprint 4) |
| `Etiqueta` | `id (uuid), nombre` (único), `categoria` (TEMA/AREA/NORMA/ROL), `color?` — categoriza preguntas |
| `Modulo` | `id (uuid), nombre, descripcion?` + trazabilidad. Contenedor estable; el contenido real vive en `ModuloVersion` |
| `ModuloVersion` | `id (uuid), moduloId, numeroVersion` (contador interno monotónico), `estado` (BORRADOR/ACTIVO/ARCHIVADO), `anio?/mayor?/menor?` (número público `AÑO.MAYOR.MENOR`, se asigna al Activar), `activadaEn?` (timestamp de publicación), `esNuevaLinea?` (elección guardada en el borrador: true = sube MAYOR, false = sube MENOR) + trazabilidad. Editar un módulo activo crea una versión nueva (borrador); al activarla la anterior queda `ARCHIVADO` e inmutable |

**Tipo `INTERNA`:** La organización **"Ingeniería SIMA"** usa este tipo. Los usuarios que pertenecen a ella son usuarios internos de SIMA (administradores del sistema); el resto (CLIENTE/SUBCONTRATISTA) son usuarios de clientes.

**Decisión clave — `Usuario` es UNA sola entidad** para cualquier persona (cuenta de sistema y/o persona evaluada). El rol vive en `Usuario` de forma transitoria y migrará a `Vinculacion` en sprints futuros. Esto unifica los conceptos `User` y `Employee` que el prototipo modelaba por separado. `rol = ALUMNO` es la persona evaluada (equivalente al `Employee`/"Empleado" del modelo de roles); ADMINISTRADOR/COORDINADOR son las cuentas de sistema del backoffice.

**Clasificación de usuario (SIMA/CLIENTE/SUBCONTRATISTA/INVITADO):** persistida y editable en `Usuario.clasificacion`, **no derivada** de `Organizacion.tipo` al vuelo — decisión deliberada para permitir que un admin fuerce una excepción manual (ej. marcar a alguien como INVITADO aunque su organización sea CLIENTE). Al elegir la organización en el form se sugiere automáticamente la clasificación correspondiente, pero queda editable. Solo aplica a `rol = ALUMNO`.

**Banco de preguntas y módulos versionados (SIMA CHECK):** `Pregunta` es única y reutilizable entre módulos vía el pivot `ModuloVersionPregunta` (N a N). `Modulo` nunca se edita en el lugar: cambiar su contenido crea una `ModuloVersion` nueva y la anterior queda archivada e inmutable — no se pierden versiones viejas. Los tipos de pregunta (`VERDADERO_FALSO`/`OPCION_MULTIPLE`/`OPCIONES_IMAGEN`) mapean 1:1 a los tipos del mock frontend (`truefalse`/`multiple`/`image-options`); `TEXTO_LIBRE` está en el enum para uso futuro, sin implementación todavía.

**Baja lógica de preguntas por módulo:** una pregunta **no se edita, se activa/desactiva**. El pivot `ModuloVersionPregunta` tiene un flag `activa` (default `true`) que es la baja lógica **por módulo**: desactivar una pregunta la saca solo de ese módulo (togglea el flag en la versión vigente, in place — no crea versión nueva). Es distinto de `Pregunta.activa`, que es el flag global del banco. `GET /modulos/:id` devuelve todas las preguntas del módulo (activas e inactivas) para poder reactivarlas desde el backoffice.

**Papelera global de preguntas (distinta de la baja por módulo):** `Pregunta.activa` es un segundo flag, independiente del anterior — "enviar a papelera" (`PATCH /preguntas/:id { activa: false }`) saca la pregunta de **todo** el banco y cascadea `activa=false` a **todas** sus filas de `ModuloVersionPregunta` (cualquier módulo donde estuviera). "Recuperar" (`activa: true`) revierte el flag global pero **no** restaura los pivots por módulo — asimetría a propósito, para no adivinar en qué módulos el admin la quiere de vuelta. `GET /preguntas` soporta filtrar por `?activa=`, por `?moduloId=` (repetible, combina como OR entre módulos), y por `?sinAsignar=true` (preguntas sin ninguna asignación vigente, también OR con `moduloId`); cada pregunta devuelta trae `modulos: [{moduloId, moduloNombre, activaEnModulo}]` con sus asignaciones actuales.

**Detección de duplicados/similares (resuelto, en memoria):** `src/import/similitud.ts` normaliza el texto en español (sin acentos/puntuación) y compara por coeficiente de Dice sobre trigramas de caracteres, contra el banco completo y contra las filas del mismo archivo importado. Se eligió esta vía en vez de la extensión `pg_trgm` de Postgres porque el proyecto es local-first sin deploy cloud activo todavía; queda encapsulado en funciones puras, reemplazable el día que el banco crezca lo suficiente como para justificar un índice en base.

### Endpoints

`GET /health` · `GET /uploads/*` (archivos subidos, lectura pública) · `POST /auth/login` · CRUD `/usuarios` (soft-delete, paginación `?page=`/`?limit=` y filtro `?clasificacion=`, responde `{ data, total, page, limit }`) · CRUD `/organizaciones` · `POST /import/usuarios/preview`/`confirm` (Excel) · `POST /import/preguntas/preview` (clasifica cada fila nueva/duplicada/parecida contra el banco) · `POST /import/preguntas/confirm` (JSON con la selección del preview + `moduloId?` opcional) · `/etiquetas` (POST/GET) · `/preguntas` (POST/GET con filtros `?q=`/`?etiqueta=`/`?categoria=`/`?activa=`/`?moduloId=` (repetible, OR)/`?sinAsignar=` (OR con moduloId), GET `/:id`, PATCH `/:id` papelera global con cascada, POST `/imagen` sube la imagen de un enunciado (multipart `file`, máx 2 MB, formato detectado por magic bytes PNG/JPG/WEBP) y devuelve `{ imagen: "preguntas/<uuid>.png" }` para mandar en el `imagen` del POST `/preguntas`, DELETE `/imagen/:clave` (clave url-encoded) borra **solo huérfanas** — 409 si alguna pregunta la referencia) · `/modulos` (GET lista todos con `vigente` {estado, anio, mayor, menor} y `borradorId` si hay un borrador en curso, POST crea con `ModuloVersion` v1 BORRADOR, GET `/:id` con versión activa/última + preguntas, PATCH `/:id` edita metadata (nombre/descripcion), GET `/:id/versiones` historial con `preguntasCount` por versión, GET `/:id/versiones/:versionId` detalle de una versión puntual + sus preguntas, POST `/:id/versiones` crea un borrador nuevo copiando las preguntas del ACTIVO (sin body: la elección actualización/versión nueva se pospone a Activar), DELETE `/:id/borrador` cancela/descarta el borrador en curso sin publicarlo — si era la única versión (módulo nunca publicado) elimina el módulo entero, PATCH `/:id/activar` publica el borrador vigente (body `{esNuevaLinea?}`: obligatorio solo si el módulo ya tiene un ACTIVO publicado del cual derivar el número; le asigna número `AÑO.MAYOR.MENOR` y archiva el ACTIVO anterior), POST `/:id/preguntas` asigna a la versión BORRADOR (cada item con `orden?` **opcional**: si no viene, se appendea al final de la versión), PATCH `/:id/preguntas/:preguntaId` activa/desactiva la asignación de una pregunta **en la versión que se está editando** — el BORRADOR en curso si existe, si no la vigente publicada, DELETE `/:id/preguntas/:preguntaId` unassign duro (borra el pivot en vez de desactivarlo) — solo sobre un BORRADOR, rechaza sobre versiones publicadas). Lecturas abiertas; escrituras protegidas con JWT.

### Módulos NestJS

`auth/` (login JWT + guard) · `usuarios/` · `organizaciones/` · `import/` (usuarios y preguntas desde Excel + `similitud.ts`; importa `PreguntasModule` y `ModulosModule`) · `etiquetas/` · `preguntas/` (importa `ModulosModule` para resolver versiones vigentes al filtrar/enriquecer, y `StorageModule` para la imagen del enunciado) · `modulos/` · `storage/` (`StorageService` abstracto + `LocalDiskStorage`; `formato-imagen.ts` con la detección por magic bytes) · `prisma/` (service global) · `health/`. Cada entidad futura (`Vinculacion`, `Sesion`…) se agrega como módulo nuevo, no como cambio transversal.

Pendiente para el próximo sprint: AuditLog completo (ISO 9001), el arranque de `Vinculacion` (alumno vs operador), y compartir un borrador como versión beta para testear antes de publicar (diseño esbozado, sin implementar — ver Sprint 3 más abajo). La detección de duplicados de preguntas y el versionado/aprobación de módulos (`PATCH /modulos/:id/activar`) ya están resueltos (ver más arriba); el unassign duro de pregunta↔módulo también se resolvió, ver Sprint 3.

## Modelo de dominio (frontends mockeados)

> El backoffice ya migró **Usuarios** a la API real. El resto de estas entidades sigue hardcodeado en archivos `.js` (se migran ABM por ABM).

### Core Platform — entidades compartidas por toda la plataforma

| Entidad | Archivo | Campos |
|---|---|---|
| `Client` | `core/data/clients.js` | `id, name, active` |
| `User` | `core/data/users.js` | `id, name, role, clientId` |
| `UsuarioMock` | `core/data/usuarios-mock.js` (export `usuariosMock`) | `id, dni, name, clientId` — consumido por `Dashboard.jsx` y `TrainingAssignments.jsx`. Es el mock de la persona evaluada (el ex-`Employee`); no confundir con `User`, que son las cuentas del backoffice |

### SIMA CHECK — entidades del producto de capacitaciones

| Entidad | Archivo | Campos |
|---|---|---|
| `TrainingModule` | `sima-check/data/training-modules.js` | `id, backendId, name, active, questions[]` (`questions[]` vacío, ver arriba). **La pantalla Módulos (`TrainingModules.jsx`) ya no usa este mock**: lista/crea/edita módulos y su versionado 100% contra `/modulos`. El StatCard "Módulos activos" de `Overview.jsx` tampoco lo usa (trae `GET /modulos` y reusa `estadoModulo`, ver abajo). El archivo sigue siendo consumido, solo para metadata liviana (`name`/`active`), por `Dashboard.jsx`, el resto de `Overview.jsx` (gráfico de aprobación, que compara por nombre de módulo) y `TrainingAssignments.jsx` — pendiente de migrar; mientras tanto esos conteos/selects pueden divergir del estado real del backend |
| `TrainingAssignment` | `sima-check/data/training-assignments.js` | `id, usuarioId, moduleId, assignedBy, assignedAt, status` |
| `Evaluation` | `sima-check/data/evaluations.js` | `id, usuarioName, moduleName, score, approved, date, clientId` |

`status` admite: `'pending' | 'completed' | 'expired'`

## Modelo de roles

| Rol | Acceso |
|---|---|
| `administrador` | Backoffice completo: clientes, usuarios, módulos, preguntas, asignaciones, métricas globales |
| `coordinador` | Backoffice limitado: asignaciones de su empresa, empleados de su empresa |
| Empleado | Solo App SIMA CHECK (acceso por DNI) |

## Backoffice — pantallas y navegación

### Sidebar global

Tres secciones:
- **Panel Principal** → Dashboard de plataforma
- **Administración** → Clientes, Usuarios
- **Productos** → SIMA CHECK (ítem único; resaltado en cualquier sub-página del producto)

### Dashboard (Panel Principal)

Vista de plataforma con cuatro bloques:
- KPIs operacionales: clientes activos, empleados registrados, asignaciones pendientes, completadas
- Tabla de actividad reciente (mockeada): Fecha / Usuario / Acción / Detalle
- Estado del sistema: indicadores OPERATIVO (emerald) / ADVERTENCIA (amber) por servicio
- Product cards: SIMA CHECK (activo, con stats y botón de acceso) + SIMA INSPECTIONS y SIMA AUDITS (roadmap, con ETA)

### SIMA CHECK (producto)

Al navegar a cualquier página de SIMA CHECK aparece una **barra de tabs** entre el header y el contenido:

| Tab | ID de página | Descripción |
|---|---|---|
| Resumen | `sima-check-overview` | Métricas: 6 StatCards + gráfico SVG de aprobación por módulo + lista de últimas evaluaciones. El StatCard **"Módulos activos" ya es dato real** (`GET /modulos` + `estadoModulo`, ver abajo); el resto (clientes, usuarios, % aprobación, asignaciones, gráfico, últimas evaluaciones) sigue mockeado |
| Módulos | `training-modules` | **100% backend** (sin mock). Tabla de módulos contra `GET /modulos`, columna Estado con badge de ciclo de vida (BORRADOR ámbar/ACTIVO esmeralda/ARCHIVADO slate) + número `AÑO.MAYOR.MENOR` de la versión vigente. **"+ Nuevo módulo"**/**"Editar"** editan metadata (nombre/descripción) vía `POST`/`PATCH /modulos`; el modal de creación incluye además el picker de preguntas del banco (`PreguntaBancoPicker`, compartido con "Asignar pregunta" de Preguntas) para arrancar el borrador ya con preguntas elegidas — es opcional, y el módulo queda como BORRADOR igual con o sin preguntas (`POST /modulos/:id/preguntas` se dispara después de crear el módulo, solo si se tildó alguna). Por fila, según estado: módulo **nunca publicado** → **"Editar contenido"** entra directo al borrador (es la única versión, no hay nada que elegir); módulo **publicado sin borrador** → **"Ver preguntas"** (solo lectura del ACTIVO) + **"Editar contenido"** (crea el borrador copiando las preguntas del ACTIVO vía `POST /:id/versiones`, **sin preguntar nada** — la elección actualización/versión nueva se pospone al momento de Activar, no antes) y entra directo a editarlo; módulo **con borrador en curso** → "Ver preguntas" + **"Continuar borrador"** (retoma el borrador sin repreguntar). **Cancelar/eliminar un borrador vive solo dentro de la vista de contenido del borrador** (junto a "Activar"), no en la fila de la lista, para no saturarla de acciones: **"Cancelar borrador"** descarta el borrador y vuelve a mostrar el ACTIVO publicado (`DELETE /:id/borrador`); si el módulo **nunca se publicó** el mismo botón dice **"Eliminar módulo"** (mismo endpoint: al no haber ACTIVO de respaldo, cancelar el único borrador borra el módulo entero). Ambos casos piden confirmación con un modal que explica la consecuencia. La vista de contenido del borrador reusa `BancoAcciones`/`PreguntasAsignadasPanel` (mismos componentes que Preguntas) — acá `PreguntasAsignadasPanel` recibe `onToggle` (Activar/Desactivar, gris, baja lógica) y `onRemove` (**"Quitar"**, rojo/danger, unassign duro — solo válido en un BORRADOR, ver Sprint 3) como acciones independientes por fila — y agrega el botón **"Activar"**, que abre un modal: si el módulo ya tiene un ACTIVO publicado, pide elegir **Actualización**/**Versión nueva** (con preview en vivo del número de cada opción) y muestra ahí mismo, junto a la opción "Actualización", una advertencia si el borrador acumuló muchos cambios de preguntas respecto al ACTIVO del que partió (recomendando "Versión nueva" en su lugar); si es la primera publicación del módulo no hay nada que elegir, solo confirmar. Al confirmar llama `PATCH /:id/activar` (body `{esNuevaLinea?}`), que archiva el ACTIVO anterior. **"← Volver" pide confirmación mientras se edita un borrador** (no en las vistas de solo lectura, ahí vuelve directo): un modal con tres salidas — "Seguir editando" (cierra el modal, no navega), **"Guardar y volver"** (recién acá se mandan al backend los cambios de la sesión — asignar/quitar/activar-desactivar viven en memoria hasta este punto, ver Sprint 3) y **"Descartar cambios"**/**"Eliminar módulo"** (si el módulo ya tiene un ACTIVO, no hace falta llamar a nada — como no se mandó nada al servidor, alcanza con navegar; si nunca se publicó, reutiliza el mismo modal de confirmación y el mismo `cancelarBorrador` que el botón de abajo, porque ahí sí hay que eliminar el módulo entero). **"Historial"** por fila abre la lista de versiones (`GET /:id/versiones`, más reciente primero, con cantidad de preguntas y fecha de publicación); "Ver" en una fila del historial reusa la misma vista de solo-lectura para mostrar el contenido de esa versión archivada, y "← Volver" vuelve al historial (no a la lista de módulos). `estadoModulo(mod)` (bucket activo/borrador/inactivo a partir de `mod.activo` + `mod.vigente.estado`) vive en `components/bancoModulo.jsx` para poder reusarse fuera de esta pantalla (ej. el conteo de Resumen) |
| Preguntas | `questions` | **100% backend** (sin mock). Barra de filtros combinables: buscador de texto (debounce, atraviesa todos los módulos/estados) + multi-select de módulos con buscador y "seleccionar todos" (incluye la opción sintética "— Sin asignar —") + dos chips **Activas**/**Papelera** (ambos ON = "Todas"; no se puede apagar el último encendido). Con **exactamente 1 módulo real** seleccionado (sin papelera ni búsqueda) se muestra la vista por-módulo: tabla de sus preguntas asignadas con botón **Activar/Desactivar** por fila (`PATCH /modulos/:id/preguntas/:preguntaId`) y `BancoAcciones` (Nueva pregunta / Asignar del banco, atadas a ese módulo). En cualquier otro caso (0/2+ módulos, papelera, o con búsqueda) se muestra la vista global contra `GET /preguntas`, con columna **Módulos** (badges de a qué módulos está asignada) y dos acciones por fila: **Editar módulos** (`EditarModulosModal`: multi-select prefilleado con los módulos activos; agregar = `POST /modulos/:id/preguntas`, quitar/reactivar = `PATCH /modulos/:id/preguntas/:preguntaId`) y **Enviar a papelera/Recuperar** (`PATCH /preguntas/:id`, papelera global). "Enviar a papelera" abre un modal de confirmación (no "Recuperar", que sigue siendo instantáneo) listando los módulos donde la pregunta está activa, con badge de estado del módulo y una advertencia en rojo si es la última pregunta activa de ese módulo (`totalActivasEnModulo === 1`, calculado en el backend); si no está asignada activamente a ningún módulo, se manda a papelera directo sin modal. En las vistas por-módulo (Questions.jsx vista por-módulo y `PreguntasAsignadasPanel` del borrador de Módulos) una pregunta en papelera global se muestra con badge ámbar **"En papelera"** en vez de "Inactiva", sin botón de Activar — reactivar el pivot de una pregunta en papelera está bloqueado en el backend (`ConflictException`, hay que recuperarla desde Preguntas primero). El header de la página siempre tiene, además, un botón **"Nueva pregunta"** (`NuevaPreguntaModal` con multi-select de módulos: crea en el banco y asigna a los módulos elegidos —preseleccionado el módulo si viene del camino por-módulo—; oculto solo cuando ya se ve el de `BancoAcciones` para no duplicar. Incluye el campo opcional **"Imagen del enunciado"** y, si el tipo es `OPCIONES_IMAGEN`, **4 slots uploader** para las opciones con su selector de correcta por miniatura: en los dos casos el archivo se queda en el browser con preview (`URL.createObjectURL`) y se sube recién al confirmar, así quitarlo/cambiarlo antes de crear es estado local y abrir y cerrar el modal no deja huérfanos — ver Sprint 4) y **"Importar Excel"** (`ImportPreguntasModal`: preview con checkbox por fila, badge nueva/parecida-con-%/duplicada/error, selector de módulo destino opcional). Badge de tipo: sky=V/F · violet=Múltiple · amber=Imágenes · slate=Texto libre. |
| Asignaciones | `training-assignments` | Tabla (empleado, empresa, módulo, estado, asignado por, fecha) + modal crear con validación de duplicados |

La barra de tabs y el breadcrumb `SIMA TRAINING › SIMA CHECK › {tab}` se renderizan en `BackofficeLayout.jsx` usando `SIMA_CHECK_PAGES` (Set) y `SIMA_CHECK_TABS` (array).

### Administración (Core)

- **Clientes** — tabla + modal crear/editar + toggle activo/inactivo
- **Usuarios** — dos tabs (**SIMA** / **Clientes**), misma tabla/ABM. Un usuario es "SIMA" si su `organizacionId` apunta a una org `tipo = INTERNA`; el resto son de clientes. Al crear desde cada tab, la org se predefine a la correspondiente. El select del form filtra orgs por tab.

### Configuración *(placeholder)*

Sección visible en el sidebar — Roles y Permisos se agregarán en el futuro.

## App SIMA CHECK — flujo

Todas las pantallas son **tarjetas blancas** (`bg-white border border-slate-200 rounded-2xl shadow-2xl`) sobre un fondo claro con gradiente gris. Para usar imagen de fondo real, reemplazar el `background` inline en `App.jsx` por `backgroundImage: "url('/bg-industrial.jpg')"`.

El **logo** (`public/logo.png`) se renderiza en `App.jsx` encima de la card, visible en todas las pantallas.

1. **Ingreso por DNI** — campo numérico (`inputMode="numeric"`), botón INGRESAR, validaciones: vacío / DNI no encontrado
2. **Capacitaciones pendientes** — nombre y empresa del empleado + solo módulos con `assignment.status === 'pending'`; lista vertical de botones (`red-600`) con ícono y título; estado vacío si no hay pendientes
3. **Evaluación** — 3 preguntas aleatorias del módulo; barra de progreso avanza **al responder** (no al llegar); tipos de pregunta:
   - `truefalse`: 2 botones V/F (verde/rojo)
   - `multiple`: lista vertical, selección en `slate-900`
   - `image-options`: grid 2×2 de imágenes, selección con borde `red-600` + ring
   - Campo opcional `image` en cualquier pregunta: muestra la imagen del enunciado encima de las opciones (la ejercita la pregunta mock 112). Cuando la app se conecte al backend, `image` va a llegar como la URL armada desde `Pregunta.imagen` — `QuestionCard` no cambia, usa el `src` tal cual
4. **Resultado** — score %, badge APROBADO (≥70%) / DESAPROBADO (<70%), botones: Mis capacitaciones / Reintentar / Volver al inicio

Al finalizar una evaluación, la asignación cambia de `pending → completed` **solo si el empleado aprueba** (≥70%). Si desaprueba, queda `pending` y el módulo sigue apareciendo en la lista.

## Datos mockeados

- **Clientes**: YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy
- **Usuarios**: 8 usuarios con roles `administrador` o `coordinador`
- **Empleados**: 15 empleados con `id`, `dni`, `name`, `companyId` (y `company` para display en la app)
- **Módulos de capacitación**: 4 módulos, ~10 preguntas cada uno (incluye preguntas reales de SIMA Avanzado)
- **Evaluaciones**: 20 registros históricos para el dashboard del backoffice
- **Asignaciones**: 27 asignaciones mockeadas con `status: 'pending' | 'completed' | 'expired'`

Las preguntas mock se retiraron del backoffice (`sima-check/data/training-modules.js` quedó con `questions: []`) antes de arrancar el trabajo real sobre el dominio de preguntas; el banco real vive en backend. La **app tablet** (`sima-check-app/src/data/modules.js`) **mantiene su mock de preguntas** (módulo SIMA Avanzado, IDs 301–310, etc.) hasta que se conecte al backend.

## Arquitectura de archivos

```
sima-training-api/                (backend NestJS)
├── prisma/            schema.prisma · seed.ts · migrations/
├── src/
│   ├── auth/          login JWT + jwt-auth.guard
│   ├── usuarios/      controller · service · dto/
│   ├── organizaciones/ controller · service · dto/
│   ├── import/        preview de Excel (sin persistir)
│   ├── etiquetas/     controller · service · dto/ (categorización de preguntas)
│   ├── preguntas/     controller · service · dto/ (banco único, reutilizable entre módulos)
│   ├── modulos/       controller · service · dto/ (Modulo + ModuloVersion + asignación de preguntas)
│   ├── storage/       storage.service.ts (abstracto + LocalDiskStorage) · formato-imagen.ts
│   ├── prisma/        prisma.service.ts (global)
│   ├── health/        health.controller.ts
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.yml · Dockerfile · render.yaml (deploy preparado, no activo)

sima-training-backoffice/src/
├── core/
│   ├── api/           client.js · usuarios.js · organizaciones.js  ← capa HTTP
│   ├── data/          clients.js · users.js · usuarios-mock.js (mock, en migración)
│   └── pages/         Clients.jsx · Users.jsx (Users ya usa la API real)
├── sima-check/
│   ├── data/          training-modules.js · training-assignments.js · evaluations.js
│   └── pages/         Overview.jsx · TrainingModules.jsx · Questions.jsx · TrainingAssignments.jsx
├── pages/             BackofficeLayout.jsx · Dashboard.jsx
├── components/        Button · Card · Modal · Table · StatCard · ProgressBar
└── hooks/             useNavigation.js

sima-check-app/src/
├── data/              usuarios.js · modules.js · assignments.js
├── components/        Button · ProgressBar · QuestionCard
├── hooks/             useNavigation.js
├── utils/             evaluation.js (pickRandomQuestions, calculateScore)
└── pages/             UsuarioSelection · ModuleSelection · Evaluation · Results
```

## Decisiones de arquitectura

- No se usa react-router intencionalmente.
- No existe persistencia entre sesiones — todo es estado local en React.
- **Regla de dependencia**: `sima-check/` puede importar de `core/`. `core/` nunca importa de `sima-check/`. `Dashboard` puede importar de ambos.
- El estado de `assignments` se eleva a `App.jsx` en la app tablet para permitir actualizaciones reactivas durante la sesión.
- Los modales manejan estado local.
- Los gráficos son SVG puro (sin librerías).
- Tailwind v3 es obligatorio.
- El campo `company` (string) se mantiene en el usuario de la app junto a `companyId` para evitar importar `companies.js` en la app tablet.
- **Los dos frontends nombran la entidad `usuario`, no `employee`** — alineado con el `Usuario` del backend, que unifica `User` + `Employee` (ver arriba). En la **app tablet** alcanza a los archivos (`data/usuarios.js`, `pages/UsuarioSelection.jsx`), al prop que se pasa entre pantallas (`usuario`) y al campo `assignments[].usuarioId`. En el **backoffice**, a `core/data/usuarios-mock.js` (export `usuariosMock`), al campo `trainingAssignments[].usuarioId` y a `evaluations[].usuarioName`. Los duplicados del modelo viejo (`sima-check-app/src/data/employees.js` + `pages/EmployeeSelection.jsx`, `sima-training-backoffice/src/core/data/employees.js`) se eliminaron; quedan en el historial de git. `User` (`core/data/users.js`) **no** entra en este rename: son las cuentas del backoffice (administrador/coordinador), otra cosa.
- La navegación de SIMA CHECK en el backoffice usa un Set (`SIMA_CHECK_PAGES`) en `BackofficeLayout.jsx` para detectar cuándo renderizar la barra de tabs y el breadcrumb de dos niveles.
- La pantalla Preguntas maneja su propia navegación interna (`selectedModuleId`) con `useState` — no requiere cambios en el router global.
- El campo `image` de las preguntas **mockeadas de la app tablet** es una ruta relativa a `public/` (ej: `/images/cartel.png`). En el backend, `Pregunta.imagen` ya no es eso: guarda una clave de storage y se sirve bajo `/uploads` (ver Sprint 4); las rutas a `public/` sobreviven solo como formato legacy del import de Excel.
- El tipo `image-options` usa las mismas rutas en `options[]` y `correctAnswer` — la comparación de respuesta correcta es por igualdad de string (misma ruta).

### Backend (Sprint 1)

- **Monolito modular por dominio**, no microservicios (un solo deploy). Cada entidad futura es un módulo NestJS nuevo, no un cambio transversal.
- **`Usuario` es una sola entidad** para toda persona; el rol es transitorio en `Usuario` y migrará a `Vinculacion`. Unifica `User` + `Employee` del prototipo.
- **Trazabilidad** (`created_at/updated_at/created_by/updated_by`) y **soft-delete** (`deleted_at`) desde el día 1 — barato ahora, caro de retrofittear.
- **`datos` (jsonb)** en `Usuario` para nómina flexible hasta cerrar el mapeo del Excel real. El **mapeo de columnas del import queda abierto a propósito**.
- **Auth básica sin roles**: el backoffice se autentica con credenciales de entorno (`AUTH_USER`/`AUTH_PASSWORD`); el cliente front hace auto-login y cachea el token (no hay pantalla de login todavía). Lecturas abiertas, escrituras con JWT.
- **Deploy preparado, no activo**: `Dockerfile` + `render.yaml` listos; falta crear la cuenta cloud. CI (`.github/workflows/ci-sima-training.yml`) corre lint + build + test, sin deploy.
- **Local-first**: PostgreSQL corre en Docker Compose; requiere Docker Desktop.

### Backend (Sprint 2 — SIMA CHECK)

- **`clasificacion` persistida, no derivada**: se decidió que `Usuario.clasificacion` sea una columna editable (con sugerencia automática desde `Organizacion.tipo`) en vez de calcularse al vuelo, para permitir que un admin marque excepciones manuales. Solo aplica a `rol = ALUMNO`.
- **Banco de preguntas único**: `Pregunta` nunca se duplica; se comparte entre módulos vía el pivot `ModuloVersionPregunta`.
- **Módulos versionados e inmutables**: `Modulo` es un contenedor estable; editar su contenido crea una `ModuloVersion` nueva, la anterior queda `ARCHIVADO` y no se modifica.
- **Baja lógica de preguntas por módulo (no edición)**: regla de negocio deliberada — las preguntas no se editan, se activan/desactivan. Se agregó `activa` al pivot `ModuloVersionPregunta` (baja por módulo) en vez de reusar `Pregunta.activa` (global), para que desactivar afecte solo al módulo donde se hace. El toggle es in place sobre la versión vigente (no versiona): es la alternativa liviana explícita a editar contenido. La vista Preguntas del backoffice quedó 100% contra el backend (se eliminó el mock de esa pantalla; `training-modules.js` sigue para las demás, en migración).
- **Papelera global independiente de la baja por módulo**: `Pregunta.activa` (ya existía en el schema, sin usar) se activó como la baja lógica del banco entero. Enviar a papelera cascadea `activa=false` a los pivots de esa pregunta en versiones BORRADOR/ACTIVO — **nunca ARCHIVADO**, esas versiones son inmutables y no deben mutarse aunque sea para dar de baja una pregunta (bug corregido: el cascade original pegaba sobre todos los pivots sin filtrar por versión). Recuperar **no** restaura los pivots (asimetría intencional). Son dos ejes ortogonales: por-módulo (`ModuloVersionPregunta.activa`, el admin la maneja mientras arma un módulo puntual) vs. global (`Pregunta.activa`, "esta pregunta ya no sirve en ningún lado"). Para que estos dos ejes no queden inconsistentes, `ModulosService.setPreguntaActiva(id, true)` rechaza con `ConflictException` si la pregunta sigue en papelera global — si no, un admin podía "reactivar" el pivot de un módulo mientras el banco la seguía mostrando dada de baja. El backoffice refleja esto con un badge **"En papelera"** (distinto de "Inactiva") y sin botón de Activar en las vistas por-módulo, y con un modal de confirmación antes de enviar a papelera que lista los módulos afectados y avisa si alguno se queda sin preguntas activas (`totalActivasEnModulo`, calculado en `enriquecerConModulos`).
- **Filtro de módulo pasó de `<select>` único a multi-select con búsqueda** (`MultiSelectFilter.jsx`, componente nuevo reusable), con una opción sintética "Sin asignar" (no es un id real de `Modulo`, se traduce a `?sinAsignar=true`). El buscador de texto (`?q=`) es universal: cuando hay texto escrito, siempre se usa la vista global aunque haya 1 módulo seleccionado, para no tener que replicar la búsqueda en el camino por-módulo.
- **Detección de duplicados/similares resuelta en memoria**, no con `pg_trgm`/embeddings (decisión que revierte el TODO original): normalización de texto en español + coeficiente de Dice sobre trigramas de caracteres (`src/import/similitud.ts`), sin dependencias nuevas ni cambios de infraestructura de base. Motivo: el proyecto es local-first sin deploy cloud activo; atar la portabilidad a que el Postgres administrado permita `CREATE EXTENSION pg_trgm` no se justificaba a la escala actual del banco. Queda encapsulado en funciones puras, reemplazable el día que haga falta más escala.
- **Importación de preguntas con preview seleccionable fila por fila**: a diferencia de la importación de usuarios (todo-o-nada por fila, sin intervención), acá el preview clasifica cada fila (nueva/duplicada/parecida/error) y el usuario elige con checkboxes cuáles confirmar — necesario porque "parecida" es una señal de alerta, no un error automático a descartar. El confirm recibe esa selección como JSON (no vuelve a leer el Excel) con un `moduloId` de destino opcional.
- **Asignación pregunta↔módulo desde el backoffice (crear y editar), reusando endpoints existentes**: la relación ya vivía en el modelo (`ModuloVersionPregunta`); esta story la expuso en la UI sin agregar endpoints nuevos. Al **crear** una pregunta se elige el/los módulo(s) con un multi-select y se asigna a cada uno; al **editar** la asignación de una pregunta existente (vista global) el diff usa **asignar** para módulos nuevos, **reactivar** (`setPreguntaActiva true`) cuando el pivot ya existía inactivo —evita el `P2002` del PK compuesto— y **baja lógica por módulo** (`setPreguntaActiva false`) para quitar. "Quitar" no borra el pivot (queda tachado en la columna Módulos); un unassign duro (DELETE del pivot) queda como refinamiento futuro. Para soportar el alta multi-módulo sin calcular `orden` por módulo en el cliente, `asignarPreguntas` ahora **appendea** el `orden` cuando el item no lo trae. `asignarPreguntas` apunta a la versión BORRADOR y `setPreguntaActiva` a la vigente (ACTIVO-o-última); desde Sprint 3 (versionado real) ambas pueden divergir — ver limitación conocida más abajo.

### Backend (Sprint 3 — Versionado de módulos)

- **Numeración pública de 3 partes `AÑO.MAYOR.MENOR`** (ej. `2026.01.00`), distinta del `numeroVersion` interno (contador monotónico de creación, usado solo para ordenar/versionar internamente). El número público se asigna **recién al Activar** (publicar); un borrador sin publicar no tiene número y se muestra como "Borrador". Semántica: **Actualización** (misma línea) sube MENOR (`2026.01.00 → 2026.01.01`); **Versión nueva** sube MAYOR y resetea MENOR (`→ 2026.02.00`); MAYOR es la secuencia del módulo **por año** (primera publicación del año = `01`).
- **La elección actualización/versión nueva (`esNuevaLinea`) se decide recién al Activar, no al crear el borrador** — decisión revertida respecto al diseño original de este sprint. Al principio se preguntaba al crear el borrador (`POST /:id/versiones`) y se guardaba de entrada; se cambió porque no tiene sentido comprometerse a esa elección antes de saber cuánto se va a terminar modificando. `crearVersion` ya no recibe `esNuevaLinea` ni lo persiste; `activar(moduloId, esNuevaLinea?)` lo recibe como parámetro y recién ahí lo escribe en el `ModuloVersion` (`esNuevaLinea: activo ? esNuevaLinea : null`). Es obligatorio (el service tira `ConflictException` si falta) únicamente cuando ya hay un ACTIVO publicado del cual derivar el número; en la primera publicación no hay de qué elegir y queda `null`. El endpoint `PATCH /:id/borrador` (`actualizarEleccionBorrador`) que existía para cambiar la elección a mitad de edición se eliminó por completo — ya no hace falta, ahora todo pasa por el modal de Activar.
- **A lo sumo un BORRADOR y un ACTIVO por módulo.** `crearVersion` rechaza si ya hay un borrador en curso (hay que activarlo o cancelarlo primero, ver `cancelarBorrador` más abajo) o si no hay un ACTIVO del cual partir (primera publicación no pasa por esta elección: se edita directo el v1 y se activa). Crea el borrador **copiando los pivots** (`ModuloVersionPregunta`) del ACTIVO, así el punto de partida de la edición es el contenido publicado, no uno vacío.
- **`activar` es transaccional**: en la misma transacción, calcula el número (según el `esNuevaLinea` recibido en el body y el ACTIVO base), pasa el borrador a `ACTIVO` con ese número + `activadaEn` + `esNuevaLinea`, y el ACTIVO anterior (si había) a `ARCHIVADO` — nunca quedan dos `ACTIVO` simultáneos.
- **`cancelarBorrador` (descartar el borrador en curso)**: borra el `ModuloVersion` en BORRADOR y sus pivots `ModuloVersionPregunta` (las FK son `ON DELETE RESTRICT`, así que hay que borrar los pivots antes que la versión, en una transacción). Si el módulo tenía un ACTIVO, queda tal cual estaba antes de empezar a editar. Si el borrador era su única versión (el módulo nunca se publicó), no tiene sentido un módulo sin ninguna versión, así que la misma operación borra el `Modulo` entero — el backoffice etiqueta el botón distinto según el caso ("Cancelar borrador" vs "Eliminar módulo") pero es el mismo endpoint y el mismo método de servicio. El modal de confirmación de **"← Volver"** (dentro del editor del borrador) reusa este mismo flujo para su opción "Descartar": no duplica lógica, solo abre el modal de cancelar-borrador ya existente en vez de tener su propio handler.
- **`unassignPregunta` (unassign duro) vs `setPreguntaActiva` (baja lógica) — cuándo usar cada uno.** Ambos actúan sobre `versionParaEditar` (BORRADOR en curso si existe, si no la vigente), pero `unassignPregunta` además exige `version.estado === 'BORRADOR'` y tira `ConflictException` si no — a diferencia de `setPreguntaActiva`, que sí puede togglear sobre una versión ya publicada (es reversible, no rompe inmutabilidad). Borrar un pivot de una versión ARCHIVADO/ACTIVO sí rompería la inmutabilidad del historial, por eso el hard-delete está limitado al borrador. En el backoffice, el editor del borrador ofrece ambos como acciones independientes por fila ("Desactivar", gris/secondary — "Quitar", rojo/danger), no una reemplaza a la otra: "Desactivar" es reversible sin perder la fila, "Quitar" saca la pregunta del todo (hay que reasignarla desde el banco si te arrepentís).
- **`findVersiones` devuelve `preguntasCount`** (no la lista completa de preguntas) para el historial; el detalle de una versión puntual con sus preguntas es un endpoint aparte (`GET /:id/versiones/:versionId`), reservado para cuando el backoffice necesita mostrar el contenido real (evita traer preguntas de más al listar el historial).
- **El backoffice reusa la vista de solo-lectura para dos casos** (ver preguntas del ACTIVO vigente, y ver el detalle de una versión archivada del historial) en vez de duplicar UI: ambos son "mostrar las preguntas de una versión puntual, sin poder editarlas", solo cambia de qué versión.
- **`versionParaEditar` vs `ultimaOActivaVersion` — resuelto el gotcha de edición sobre la versión equivocada.** `findOne` y `setPreguntaActiva` usan `versionParaEditar` (BORRADOR en curso si existe, si no la vigente publicada) en vez de `ultimaOActivaVersion` (ACTIVO-o-última, ignora si hay un borrador). Antes de este ajuste, con un ACTIVO y un BORRADOR coexistiendo, togglear una pregunta desde `Questions.jsx` (pantalla Preguntas, vista por-módulo) afectaba por error a la versión **publicada** en vez de al borrador en edición. `versionesVigentesDe` (reportes/enriquecimiento de `PreguntasService`, "qué módulos publicados tiene esta pregunta") sigue usando `ultimaOActivaVersion` sin cambios — ahí sí interesa lo publicado, no el trabajo en progreso.
- **Sacar preguntas del borrador — dos formas, a propósito.** `PreguntasAsignadasPanel` (compartido entre Preguntas y Módulos) acepta `onToggle` y `onRemove` opcionales, independientes entre sí. `onToggle` es la baja lógica de siempre (`setPreguntaActiva`): la fila queda atenuada con badge "Inactiva", se puede reactivar, y funciona tanto en un borrador como en la vigente publicada. `onRemove` es el unassign duro (`unassignPregunta`): borra el pivot del todo, la fila desaparece — solo tiene sentido en un BORRADOR (el backend lo rechaza sobre ACTIVO/ARCHIVADO, inmutables). En el editor de borrador de Módulos ambos son **locales** (staged, ver bullet siguiente) — no pegan al backend hasta Guardar/Activar; las vistas read-only (ver vigente, detalle del historial) no pasan ninguno de los dos y quedan de solo lectura.
- **Staging real en el editor de borrador de Módulos — nada se manda al backend hasta "Guardar y volver" o "Activar".** Diseño revertido respecto a las primeras versiones de esta pantalla (donde cada acción —asignar, activar/desactivar, quitar— pegaba al backend al toque). `TrainingModules.jsx` mantiene `localAsignadas`, una copia editable que arranca como foto de `banco.asignadas` una sola vez por sesión de edición (una `sessionKeyRef` con `${moduleId}:${versionId}` evita retomar la foto en cada render, solo cuando se entra a otro borrador); mientras se edita, `banco.asignadas` no se vuelve a pedir. Los handlers de fila (`handleTogglePreguntaLocal`, `handleQuitarPreguntaLocal`, `handleAsignarLocal`, `handleNuevaPreguntaLocal`) solo mutan ese estado local, sin `await` ni loading — no hay red de por medio. `flushCambios()` diffea `banco.asignadas` (foto del server al entrar) contra `localAsignadas` (lo armado) y dispara la mínima cantidad de llamadas (`unassignPregunta` para lo sacado, `asignarPreguntas` para lo nuevo, `setPreguntaActiva` para lo que cambió de activo/inactivo); la usan tanto "Guardar y volver" como "Activar" (que primero flushea y recién después publica, para que lo publicado incluya los cambios de la sesión). `AsignarPreguntaModal`/`NuevaPreguntaModal`/`BancoAcciones` ganaron un `onAssign`/`onAssignExisting`/`onAssignNew` opcional: si el padre lo pasa, el modal le devuelve lo elegido en vez de pegarle al backend él mismo — la vista por-módulo de Preguntas (`Questions.jsx`) no lo pasa y sigue guardando de inmediato como siempre, ese camino no es staged.
- **"Descartar" en el modal de Volver ahora es liviano — no delega a `cancelarBorrador` salvo un caso.** Como nada se mandó al servidor durante la sesión, descartar cuando el módulo **ya tiene un ACTIVO** publicado es solo no flushear y navegar (el borrador queda con lo que tenía guardado de sesiones anteriores, si las hubo). La excepción es el módulo **nunca publicado**: ahí no hay ACTIVO al cual volver, así que "Descartar" sigue delegando al flujo completo de `cancelarBorradorModal` (elimina el módulo entero) — mismo criterio que el botón standalone "Cancelar borrador"/"Eliminar módulo", que sigue existiendo sin cambios y sigue siendo la única vía para tirar sesiones ya guardadas anteriormente, no solo la actual.
- **Recomendar "versión nueva" cuando el borrador acumula muchos cambios — mostrado dentro del modal de Activar, no durante la edición.** Se compara el borrador contra el ACTIVO del que partió (preguntas activas agregadas + quitadas, `contarCambios`/`deberiaRecomendarVersionNueva` en `TrainingModules.jsx`). Si los cambios llegan a `RECOMENDAR_MIN_CAMBIOS` (2) **y** son ≥30 % de las preguntas de la base, al abrir el modal de "Activar" (con la opción "Actualización" seleccionada, que es el default) aparece una advertencia ahí mismo sugiriendo elegir "Versión nueva" en su lugar — el usuario puede simplemente clickear esa opción antes de confirmar, no hace falta un endpoint aparte para "cambiar de opinión" a mitad de edición. Motivo: sin este aviso, alguien podría encadenar puras "actualizaciones" hasta que el módulo termine siendo completamente distinto sin que la línea mayor lo refleje nunca. El umbral es una heurística simple (constantes en el componente), ajustable si en la práctica resulta muy sensible o muy laxo.
- **Compartir un borrador como versión beta (diseño, sin implementar):** para que un tester pruebe un borrador sin activarlo ni afectar las estadísticas de la versión publicada. Propuesta: un `betaToken` (+ opcional `betaExpiraEn`) sobre el `ModuloVersion` en BORRADOR, generado al "Compartir"; `POST /modulos/:id/beta` para generar/rotar el token y un endpoint público `GET /modulos/beta/:token` que sirva las preguntas del borrador. Bloqueado hasta que la app tablet se conecte al backend (hoy sigue 100% mockeada, no hay dónde correr el modo beta); cuando se implemente, decidir si las respuestas del modo beta se persisten (feedback) o son efímeras — probablemente efímero al principio, y sumar persistencia cuando exista el modelo de respuestas/estadísticas por pregunta.

### Backend (Sprint 4 — Imágenes en el enunciado)

- **`Pregunta.imagen` ya existía en el schema pero estaba muerto**: el POST y el import de Excel lo aceptaban, pero no había forma de subir el binario ni de servirlo, y el backoffice nunca lo seteaba (solo pintaba un 🖼 si venía del Excel). Este sprint cerró las dos brechas, sin migración de datos ni cambio de schema.
- **Storage detrás de una interfaz chica, para que migrar a S3 sea barato.** `StorageService` (abstracto) expone solo `guardar(buffer, carpeta, extension) → clave` y `borrar(clave)`; `LocalDiskStorage` escribe en `UPLOADS_DIR` (default `./uploads`, gitignoreado) y `main.ts` lo sirve con `useStaticAssets` bajo `/uploads` (se eligió sobre `ServeStaticModule` para no sumar `@nestjs/serve-static`: son dos líneas y `platform-express` ya estaba). **La base guarda una clave opaca, nunca una ruta de filesystem ni una URL absoluta** — eso es lo que hace que migrar a S3 sea escribir otra implementación de la clase, sin tocar schema, controllers ni frontend. Al deployar hay que montar un disco persistente en `UPLOADS_DIR`, o migrar a S3 ahí mismo.
- **El formato se detecta por magic bytes, no por `originalname` ni `mimetype`** (`storage/formato-imagen.ts`, funciones puras al estilo de `import/similitud.ts`): los dos son input del cliente y se pueden mentir. La extensión con la que se guarda sale del tipo detectado, y el nombre es siempre un uuid generado — construir un path con el `originalname` sería path traversal. Límite de 2 MB (multer aborta con 413; el service revalida para dejar el mensaje en castellano si esa red falla).
- **La subida va separada del alta (dos pasos), no como un multipart único.** `POST /preguntas/imagen` devuelve la clave y `POST /preguntas` sigue siendo el mismo JSON de siempre con esa clave en `imagen` — así el `CreatePreguntaDto` no cambió, y el modal puede mostrar el preview antes de confirmar. En el frontend el archivo **se queda en el browser hasta confirmar**: por eso quitar/cambiar la imagen antes de crear es estado local, y abrir y cerrar el modal no genera huérfanos. La única fuente de huérfanos es que el alta falle después de subir, y para eso está `DELETE /preguntas/imagen/:clave`, que el modal llama en su catch (ignorando el error de limpieza para no tapar el del alta).
- **La imagen de una pregunta ya creada no se reemplaza ni se borra — decisión de diseño, no una limitación pendiente.** Respeta la regla vigente ("las preguntas no se editan, se activan/desactivan": no hay endpoint de edición) y, sobre todo, la inmutabilidad del historial: todas las versiones de módulo comparten el mismo `preguntaId` (`crearVersion` copia el pivot, no la pregunta), así que mutar `imagen` cambiaría retroactivamente versiones `ARCHIVADO` que deben seguir mostrando lo que se rindió. Para cambiarla: papelera + pregunta nueva, igual que para corregir un texto. El backend lo hace cumplir: `DELETE /preguntas/imagen/:clave` responde **409** si alguna pregunta referencia la clave, y valida la forma exacta de la clave (regex) para no ser un borrado arbitrario de archivos. La papelera **no** borra el archivo: `setActiva(false)` es reversible.
- **Que la imagen "se copie" al generar un borrador salió gratis**, sin código: `imagen` vive en `Pregunta` y las versiones comparten el `preguntaId`, así que el borrador ve la misma imagen. Verificado end-to-end; el mecanismo ya estaba cubierto por el test de `crearVersion` que fija la copia de pivots.
- **`imagenUrl()` (backoffice, `core/api/preguntas.js`) centraliza la traducción clave → URL** porque conviven dos formatos: la clave opaca nueva (se prefija con `${BASE_URL}/uploads/`) y las rutas relativas a `public/` que escribe el import de Excel (`/images/cartel.png`), que se usan tal cual. Por eso `BASE_URL` pasó a exportarse desde `client.js`.
- **Las opciones de `OPCIONES_IMAGEN` también se suben** (antes eran rutas tipeadas a mano en el form: había que dejar el archivo en `public/` por fuera del sistema y escribir la ruta exacta). Reusan el mismo endpoint y la misma carpeta `preguntas/` que el enunciado — son todas imágenes de preguntas, no hacía falta separarlas. Las rutas legacy del import de Excel se siguen renderizando vía `imagenUrl()`.
- **La opción correcta se trackea guardando el `File`, no un índice ni un texto.** Cuando se elige cuál es la correcta, las claves **todavía no existen**: se generan al subir, y la subida pasa recién al confirmar (patrón de la Story 5 que evita huérfanos). Guardar la referencia al `File` evita además que la marca se desincronice al quitar o reemplazar un slot. En `handleGuardar` se traduce a clave tomando la que quedó en su misma posición del **array compactado** (`opciones[files.indexOf(correctaFile)]`): los slots vacíos no viajan, así que un hueco en el medio (ej. `[A, vacío, C, D]`) no debe desalinear la respuesta correcta — está verificado con imágenes de contenido distinguible.
- **El `<select>` de respuesta correcta no aplica a `OPCIONES_IMAGEN`** (no hay texto que mostrar, y con claves opacas el label sería `preguntas/<uuid>.png`): se elige tocando la miniatura, como en la app del alumno. Para `VERDADERO_FALSO`/`OPCION_MULTIPLE` el select queda igual.
- **`borrarImagen` mira los dos lugares donde puede vivir una clave**: la columna `imagen` (enunciado) y el jsonb `opciones` (`OR` con `array_contains`). Mirar solo la columna —como hacía al principio— dejaba borrar una imagen de opción en uso, rompiendo la pregunta en silencio.
- **Validación de opciones en `PreguntasService.create`** (`validarOpciones`): los tipos con opciones requieren ≥2, y `respuestaCorrecta` (opcional) debe ser una de ellas. Va en el service y no en el DTO porque son reglas cruzadas entre campos, que class-validator no expresa. Se agregó junto con las opciones-como-archivo porque con textos legibles un desalineamiento se veía a simple vista y con claves opacas es invisible: rompería la corrección de la evaluación sin que nadie lo note. El import de Excel entra por el mismo `create()`, así que su **preview** adelanta la misma comprobación de membresía (junto al `opciones.length < 2` que ya tenía) para que la fila se marque como `error` y se pueda destildar, en vez de que el confirm falle a mitad de la importación.
- **Pendiente**: `QuestionCard` de la app tablet usa el string de la opción como `src` del `<img>` y como identidad de selección. Con rutas mock funciona; el día que la app se conecte al backend hay que traducir clave → URL ahí también (equivalente de `imagenUrl`), manteniendo la clave cruda como identidad para que `calculateScore` siga comparando bien.
- ⚠️ **`npm run lint` del backend corre `eslint --fix` sobre todo `{src,test}/**/*.ts`**, no sobre el diff: reformatea archivos ajenos al cambio en curso. Conviene revisar `git status` después de correrlo y revertir lo que no sea tuyo.

## Cómo agregar un producto futuro (ej: SIMA INSPECTIONS)

1. Crear `src/sima-inspections/data/` con sus entidades.
2. Crear `src/sima-inspections/pages/` con sus pantallas (incluyendo un `Overview.jsx`).
3. Agregar el producto al sidebar en `BackofficeLayout.jsx`:
   - Nuevo ítem en la sección "Productos"
   - Nuevo Set equivalente a `SIMA_CHECK_PAGES` y array de tabs
4. Registrar las páginas nuevas en `PAGES` de `App.jsx`.
5. Agregar una product card en `Dashboard.jsx`.
