# SIMA TRAINING — MVP

> **Estado: MVP con backend real.** El backend (NestJS + PostgreSQL) ya expone **Usuarios** (con su vinculación a organización/rol y sus pares puesto+centro de costo), **Puestos**, **Centros de Costo**, **Organizaciones**, el banco de **Preguntas**, los **Módulos** versionados y el motor de **Asignaciones automáticas** (regla puesto+centro → módulo). El backoffice ya consume 100% del backend para Usuarios, Puestos, Centros de Costo, Preguntas, Módulos, Reglas de Asignación y Asignaciones, e incluye la **hoja de vida por persona** (veredicto de habilitación, capacitaciones con su vencimiento, rendiciones y auditoría, todo en un request); quedan mockeados Clientes, el Dashboard y casi todo el Resumen de SIMA CHECK. La app tablet **también está conectada**: rinde contra `/tablet/*` y el resultado lo calcula el backend.

MVP de alta fidelidad para **Ingeniería Sima**, orientado a la industria Oil & Gas. Arquitectura multi-producto: **SIMA CHECK** (capacitaciones y evaluaciones) es el primer producto integrado. El sistema está preparado para incorporar SIMA INSPECTIONS, SIMA AUDITS, etc.

Detalle completo (modelo de dominio, decisiones de diseño por sprint, endpoints) en [`CLAUDE.md`](CLAUDE.md). Pendientes activos en [`docs/pendientes.md`](docs/pendientes.md).

---

## Proyectos

| Proyecto | Descripción | Puerto dev |
|---|---|---|
| `sima-training-api/` | **Backend** NestJS + PostgreSQL + Prisma | 3000 |
| `sima-training-backoffice/` | Backoffice de la plataforma SIMA TRAINING | 5173 |
| `sima-check-app/` | App de evaluación para tablets industriales (SIMA CHECK) | 5174 |

Cada uno tiene su propio `package.json` y se corre de forma independiente.

---

## Stack

**Frontends** (`sima-training-backoffice`, `sima-check-app`):
- **Vite + React** (sin react-router — navegación con `useState`)
- **Tailwind CSS v3** + PostCSS + Autoprefixer

**Backend** (`sima-training-api`):
- **NestJS 11** + TypeScript (monolito modular por dominio)
- **PostgreSQL 16** (local vía Docker Compose) + **Prisma 6**
- **JWT** para auth básica (sin roles todavía)

Detalle del backend en [`sima-training-api/README.md`](sima-training-api/README.md).

---

## Cómo correr

```bash
# 1. Backend (requiere Docker Desktop corriendo)
cd TRAINING/sima-training-api
npm install
cp .env.example .env
docker compose up -d db          # PostgreSQL local
npx prisma migrate dev           # crea las tablas
npx prisma db seed               # organización interna, y nada más
npm run start:dev                # → http://localhost:3000

# (opcional) el contenido REAL de SIMA CHECK, además del seed base:
#   PowerShell:  $env:SEED_SIMA_CHECK='true'; npx prisma db seed
#   bash:        SEED_SIMA_CHECK=true npx prisma db seed
# Siembra los catálogos de nómina (88 puestos, 16 centros de costo), 3 bases de
# conocimiento con su escala, las 202 preguntas de los cinco Excel de evaluación
# con sus 73 imágenes, los 5 módulos publicados y 54 reglas de asignación.
# NO siembra personas: la nómina se importa desde el backoffice.
# Apagado por defecto: es contenido, no estructura.

# 2. Backoffice
cd TRAINING/sima-training-backoffice
npm install
cp .env.example .env             # VITE_API_URL apunta al backend local
npm run dev                      # → http://localhost:5173

# 3. App tablet (consume el backend: necesita la API corriendo)
cd TRAINING/sima-check-app
npm install
npm run dev   # → http://localhost:5174
```

---

## Backoffice — navegación

Sidebar global con tres secciones:

- **Panel Principal** — vista de plataforma: KPIs operacionales, tabla de actividad reciente, estado del sistema (OPERATIVO/ADVERTENCIA), product cards
- **Administración** — Clientes · Usuarios · Puestos · Centros de Costo (Usuarios, Puestos y Centros de Costo ya consumen la API real; Clientes sigue mock). Cada fila de **Usuarios** tiene **"Ver historial"**: la hoja de vida de esa persona (`GET /usuarios/:id/informe`) con su **veredicto de habilitación** —calculado en el backend— arriba de todo, las capacitaciones asignadas con su estado de vencimiento, y tres secciones plegadas: revocadas, rendiciones y el historial de cambios del AuditLog
- **Productos** — SIMA CHECK (ítem único; al entrar aparece tab bar interno)

### SIMA CHECK (tab bar interno)

| Tab | Descripción |
|---|---|
| Resumen | Métricas operacionales + gráfico SVG de aprobación por módulo + últimas evaluaciones (mock, salvo el StatCard "Módulos activos" que ya es dato real) |
| Módulos | **100% backend**: tabla de módulos contra `/modulos`, con su ciclo de vida (BORRADOR/ACTIVO/ARCHIVADO) y versionado (`AÑO.MAYOR.MENOR`) |
| Preguntas | **100% backend**: banco de preguntas contra `/preguntas`, filtros combinables por módulo/texto/papelera/clasificación, asignación a módulos |
| Bases | **100% backend**: la taxonomía del banco contra `/bases-conocimiento`. Cada base es un **tema** ("Gestión de residuos") y adentro define su propia escala **ordinal** de dificultad — la escala es por base a propósito, una puede necesitar 3 niveles y otra 5. Va pegada a Preguntas porque es donde se definen los temas con los que después se clasifica |
| Reglas | **100% backend**: ABM de `ReglaAsignacion` contra `/reglas-asignacion`, en acordeón por centro de costo. Una regla puede ser por par exacto (puesto, centro) o de centro (todos sus puestos) |
| Asignaciones | **100% backend**: pantalla de **consulta por persona**, no de acción — las asignaciones las deriva el motor desde las reglas y los pares de cada quien. Muestra vigentes con su origen (AUTOMATICA/MANUAL) y el porqué, más las revocadas en una sección aparte |

---

## App SIMA CHECK — flujo

Todas las pantallas son tarjetas blancas (`bg-white border border-slate-200 shadow-2xl`) sobre un fondo claro con imagen de industria de fondo (modo claro, pensado para uso en exteriores Oil & Gas) — no fondo oscuro.

1. **Ingreso por DNI** — campo numérico, validación vacío / no encontrado
2. **Capacitaciones pendientes** — nombre y empresa de la persona + lo que devuelve `GET /tablet/pendientes`: sus asignaciones vigentes **sin aprobación**
3. **Evaluación** — 3 preguntas aleatorias, barra de progreso (avanza al responder), opciones táctiles grandes; V/F con verde/rojo; opción múltiple seleccionada en oscuro; `image-options` en grid 2×2
4. **Resultado** — score %, badge APROBADO / DESAPROBADO, botones de acción. **El resultado lo calcula el backend**: la app manda respuestas crudas y recibe el veredicto

Al finalizar, el módulo sale de pendientes sólo si aprobó. No cambia ningún estado: la `Asignacion` sigue vigente y se completa su `moduloVersionId`, así que "pendiente" es *vigente sin aprobación* — ver [`docs/decisiones/sesiones.md`](docs/decisiones/sesiones.md).

---

## Datos

> **Usuarios, Organizaciones, Puestos, Centros de Costo, Preguntas, Módulos, Reglas y Asignaciones** ya viven en el backend real (PostgreSQL); el seed carga la organización interna (Ingeniería SIMA) y los módulos base, sin datos de prueba. Lo que sigue mockeado en archivos `.js` es **Clientes**, el **Dashboard** y casi todo el **Resumen** de SIMA CHECK.
>
> Una persona puede tener **varios pares** (puesto, centro de costo) y debe hacer los módulos que le corresponden por **todos** ellos — el par marcado como `principal` es solo el que se muestra en el listado. Qué roles admite cada tipo de organización lo fija una matriz (`INTERNA` → todos · `CLIENTE` → auditor · `SUBCONTRATISTA` → alumno) que el backend valida tanto en el alta manual como en el import de Excel. Detalle en el [README del backend](sima-training-api/README.md) (Sprint 5).
>
> El backoffice ya consume la **forma nueva** de `GET /usuarios`: rol y organización anidados en `vinculacion`, más el ABM de pares puesto/centro. La clasificación se disolvió como concepto y no se persiste en ningún lado.

| Entidad | Origen | Detalle |
|---|---|---|
| Clientes | Mock en backoffice (el backend ya modela `Organizacion` tipo CLIENTE, pero la pantalla no la consume) | YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy |
| Usuarios | **Backend** (API real) | `Usuario` es **identidad pura** (nombre, apellido, DNI, email). La pertenencia vive en `Vinculacion` — una por usuario, con **organización y rol** (`ADMINISTRADOR` · `COORDINADOR` · `AUDITOR` · `ALUMNO`) — y el par **puesto + centro de costo** en `VinculacionPuestoCentro` |
| Puestos / Centros de Costo | **Backend** (API real) | Catálogos de nómina, baja lógica con `activo` |
| Preguntas | **Backend** (API real) | Banco único y reutilizable entre módulos, con detección de duplicados/similares en el import de Excel |
| Módulos | **Backend** (API real) | Versionados e inmutables (`ModuloVersion`, numeración `AÑO.MAYOR.MENOR`). El mock `training-modules.js` sobrevive solo para metadata liviana en `Dashboard.jsx` |
| Asignaciones | **Backend** (API real) | `Asignacion` (Vigente/Revocada, origen AUTOMATICA/MANUAL) + `ReglaAsignacion` (por par puesto+centro o a nivel centro). Dos pantallas: Reglas y Asignaciones por persona. El mock `training-assignments.js` quedó solo para los KPIs de Dashboard y Resumen |
| Evaluaciones | Mock | 20 registros históricos, para el dashboard |
| `UsuarioMock` (persona evaluada) | Mock (`usuarios-mock.js`) | 15 personas con DNI, nombre y cliente — hoy solo lo consume Dashboard; no confundir con el `Usuario` real del backend |

---

## Estructura de archivos

```
sima-training-api/                # Backend NestJS
├── prisma/         schema.prisma · seed.ts · migrations/
└── src/            auth/ · usuarios/ · organizaciones/ · puestos/ · centros-costo/
                    · bases-conocimiento/ · preguntas/ · modulos/ · asignaciones/
                    · import/ · storage/ · prisma/ · health/

sima-training-backoffice/src/
├── core/
│   ├── api/        client.js · usuarios.js · organizaciones.js · puestos.js ·
│   │               centrosCosto.js · preguntas.js · modulos.js ·
│   │               basesConocimiento.js · import.js · reglasAsignacion.js ·
│   │               asignaciones.js   # capa HTTP
│   ├── data/       clients.js · users.js · usuarios-mock.js (mock, en migración)
│   ├── format/     version.js (número AÑO.MAYOR.MENOR) · badges.js (roleBadge,
│   │               origenBadge)   # helpers compartidos entre core/ y sima-check/
│   ├── components/ ImportUsuariosModal.jsx · ImportPreguntasModal.jsx ·
│   │               ParesPuestoCentro.jsx · estadoSimilitudBadge.jsx
│   └── pages/      Clients.jsx (mock) · Usuarios.jsx · Puestos.jsx · CentrosCosto.jsx ·
│                   HistorialUsuario.jsx (hoja de vida de una persona)
├── sima-check/
│   ├── data/       training-modules.js · training-assignments.js · evaluations.js
│   │               (mock; hoy solo alimentan Dashboard y Resumen)
│   ├── components/ BancoPreguntas.jsx · CriteriosPanel.jsx · bancoModulo.jsx
│   └── pages/      Overview.jsx (mock) · TrainingModules.jsx · Questions.jsx ·
│                   BasesConocimiento.jsx · ReglasAsignacion.jsx ·
│                   TrainingAssignments.jsx   (los 5 últimos, backend)
├── pages/          BackofficeLayout.jsx · Dashboard.jsx
├── components/     Button · Modal · Table · StatCard · MultiSelectFilter
└── hooks/          useNavigation.js

sima-check-app/src/
├── core/api/       client.js · tablet.js · imagenes.js   # capa HTTP
├── components/     Button · ProgressBar · QuestionCard · BannerActualizacion
├── pages/          UsuarioSelection · ModuleSelection · Evaluation · Results
└── App.jsx         eleva el estado del flujo y registra el service worker
```

---

## Paleta de colores

| Contexto | Uso | Clase |
|---|---|---|
| Backoffice | Fondos | Modo **claro**, paleta `slate`: `slate-50` (root) / `slate-200` (contenido) / `bg-white` (cards, tablas, modales) |
| Backoffice | Bordes | `slate-200` |
| Backoffice | Acento | `red-600` |
| App tablet | Fondo | Imagen de industria (`SIMACHECK-FONDO.png`), modo **claro** |
| App tablet | Cards | `bg-white` / texto `slate-900` (principal) · `slate-500` (secundario) |
| Ambos | Aprobado | `emerald`, tríada `-50` fondo / `-200` borde / `-600` texto |
| Ambos | Advertencia | `amber`, misma tríada |
| Ambos | Desaprobado / peligro / acento | `red-600` |
