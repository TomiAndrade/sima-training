# SIMA Training — Arquitectura y Sprint 1

**Fecha:** 2026-06-19 · **Actualizado:** 2026-06-23
**Deciders:** Equipo SIMA Training
**Stack confirmado:** Node.js + PostgreSQL · Despliegue en cloud gestionado (Render/Railway)
**Input:** Resumen del Modelo de Datos — SIMA Training · Próximas Implementaciones — SIMA Training · Estado de la Plataforma — SIMA Training & SIMA Check (23/06/2026)

> **Nota de actualización (23/06):** se incorporan dos documentos nuevos que cambian el punto de partida real del proyecto: ya existen dos frontends prototipo (React, sin backend) presentados como demo, y un roadmap de ABMs/reportes más concreto. Los cambios respecto a la versión anterior de este documento están marcados como **[ACTUALIZADO]**.

---

## 1. Contexto

SIMA Training nace de un prototipo tipo quiz ya funcional que evalúa conocimiento de personas. El objetivo es escalarlo a toda la organización, soportando múltiples empresas (clientes y subcontratistas), múltiples roles, capacitaciones versionadas con vencimiento, y trazabilidad completa.

**[ACTUALIZADO] Punto de partida real.** Lo que existe hoy no es un único prototipo, sino dos aplicaciones React independientes, navegables, presentadas en demo, pero sin backend, sin base de datos y sin persistencia (los datos son hardcodeados y se pierden al refrescar):

| | `sima-training-backoffice` | `sima-check-app` |
|---|---|---|
| Qué es | Backoffice de administración interna | App de evaluación para tablets |
| Stack | React 19 + Vite 8 + Tailwind v3, sin router (navegación con `useState`) | Mismo stack |
| Datos | 5 empresas, 8 usuarios, 15 empleados, 4 módulos (~41 preguntas), 27 asignaciones, 20 evaluaciones — todo hardcodeado | Lee los mismos datos hardcodeados, pero como **copia separada** del backoffice (sin sincronización entre ambos) |
| Auth | Usuario hardcodeado | Ingreso solo por DNI numérico contra lista local, sin contraseña ni sesión |
| Funcional hoy | Empresas (alta/edición/activar-desactivar), Usuarios (alta/edición), Módulos, Preguntas (con ranking de error y % aprobación), Asignaciones (con validación de duplicados y filtros). **Sin baja en ninguna entidad.** | Flujo completo: ingreso por DNI → selección de módulo (asignaciones pendientes) → evaluación (3 preguntas aleatorias) → resultado (≥70% aprobado). Si aprueba, la asignación pasa a "completada" en memoria. |

Esto cambia el foco de la arquitectura: **no se trata de construir un cliente nuevo**, sino de construir el backend real y conectar estos dos frontends existentes a una única fuente de datos. El "ABM de usuarios" del Sprint 1 no es una pantalla nueva — es la pantalla de Usuarios que ya existe en `sima-training-backoffice`, ahora hablándole a una API real en lugar de a un array en memoria.

**[ACTUALIZADO] Sobre "SIMA CHECK": dos cosas distintas con el mismo nombre.** El documento original de modelo de datos menciona un "repositorio de SIMA CHECK" con funcionalidad de offline/sync/Metabase, al que todavía no hay acceso, como un sistema hermano ya en producción. El documento de estado de plataforma (23/06) describe `sima-check-app` como un prototipo nuevo, mockeado, sin relación de código con ese sistema. **No está confirmado si son el mismo proyecto en distintas etapas o dos cosas diferentes** — esto se agrega a las preguntas abiertas (§4) porque condiciona si `sima-check-app` reemplaza, complementa o eventualmente se integra con el SIMA CHECK de producción.

El modelo de datos completo ya está diseñado y consensuado (ver documento fuente); este documento traduce ese modelo en una arquitectura técnica concreta y en un plan de Sprint 1 ejecutable.

## 2. Principio de diseño que gobierna la arquitectura

> Separar la identidad de la persona (`Usuario`) de su contexto laboral (`Vinculacion`).

Esto no es solo una decisión de modelo de datos — condiciona toda la arquitectura:

- Los permisos y roles no son atributos del usuario, son atributos de la vinculación activa. Esto implica que la capa de autorización debe resolver "rol efectivo" consultando vinculaciones, no el usuario directamente.
- La vigencia de capacitaciones (`Capacitacion_Vigente`) cuelga del usuario, no de la vinculación: una persona conserva su historial de aprobados aunque cambie de organización. Esto es relevante para cualquier futura integración con SIMA CHECK, que sí necesita saber "¿esta persona, hoy, está habilitada?" independientemente de para quién trabaje en ese momento.
- El sistema es un registro de hechos (qué se asignó, qué se rindió), no un motor de reglas de negocio. Esto simplifica mucho el backend: no hay un engine de "qué le corresponde a quién" que mantener.

## 3. Arquitectura técnica

### 3.1 Decisión: monolito modular, no microservicios

| Dimensión | Monolito modular (elegido) | Microservicios |
|---|---|---|
| Complejidad operativa | Baja — un solo deploy | Alta — orquestación, red, observabilidad distribuida |
| Velocidad para Sprint 1 | Alta | Baja — overhead de infraestructura antes de tener una sola entidad andando |
| Familiaridad del equipo | Asumida (Node.js estándar) | Requiere más experiencia previa |
| Escala esperada | Una organización (SIMA) con N clientes/subcontratistas — no es escala de miles de microservicios | — |
| Camino de evolución | Se puede extraer un módulo a servicio aparte el día que haga falta (ej. motor de exámenes con alta concurrencia) | — |

**Decisión:** un monolito modular en Node.js, organizado por dominio (no por capa técnica), para que extraer un módulo a futuro sea un corte limpio y no una reescritura.

### 3.2 Stack

- **Runtime:** Node.js + TypeScript.
- **Framework:** NestJS. Se eligió sobre Express plano porque el dominio tiene módulos claramente separables (Usuarios, Organizaciones, Vinculaciones, Módulos/Examenes, Asignaciones) y NestJS fuerza esa modularidad desde el día uno — paga dividendos cuando el modelo crezca a las ~10 entidades descritas en el documento fuente.
- **Base de datos:** PostgreSQL. Encaja naturalmente con un modelo fuertemente relacional (FKs entre Usuario, Organizacion, Vinculacion, Modulo, Sesion, etc.) y soporta nativamente el campo JSON flexible que pide la entidad Usuario para el Sprint 1.
- **ORM:** Prisma. Da migraciones versionadas (crítico porque el modelo va a crecer sprint a sprint) y tipado end-to-end con TypeScript.
- **Autenticación:** JWT con sesión simple para el Sprint 1 (no hay roles ni permisos todavía — eso depende de `Vinculacion`, que es post–Sprint 1). Diseñar el middleware de auth ahora pero sin lógica de roles, para no bloquear el ABM.
- **Despliegue:** cloud gestionado (Render o Railway) — un servicio web + una instancia de PostgreSQL gestionada. Sin Kubernetes, sin IaC pesado: el objetivo del Sprint 1 es tener algo demostrable, no una plataforma.
- **CI:** pipeline simple (lint + test + deploy a un ambiente único) desde el primer commit, para no acumular deuda de "ya lo configuro después".

### 3.3 Componentes (vista de alto nivel) — **[ACTUALIZADO]**

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  sima-training-backoffice    │   │   sima-check-app              │
│  (React 19 + Vite, existente)│   │   (React 19 + Vite, existente,│
│  Login JWT (admin/coordinador│   │   tablet, ingreso por DNI,    │
│  hoy → roles a futuro)       │   │   sin password ni sesión)     │
└───────────────┬───────────────┘   └───────────────┬───────────────┘
                │ HTTPS / REST                       │ HTTPS / REST
                └───────────────┬─────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────┐
│                  API (NestJS, monolito)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Módulo      │  │  Módulo       │  │  Módulo       │     │
│  │  Usuarios    │  │  Organizacion │  │  Import Excel │     │
│  │  (Sprint 1)  │  │  (Sprint 1)   │  │  (esqueleto)  │     │
│  └─────────────┘  └──────────────┘  └──────────────┘     │
│  ┌───────────────────────────────────────────────────┐   │
│  │  (futuro) Vinculacion · Modulo · Pregunta · Sesion ·│   │
│  │  Capacitacion_Vigente · Asignacion · Roles ·        │   │
│  │  Reportes de cumplimiento/éxito                     │   │
│  └───────────────────────────────────────────────────┘   │
└───────────────────────┬───────────────────────────────────┘
                         │ Prisma
┌───────────────────────▼───────────────────────────────────┐
│                  PostgreSQL (gestionada)                    │
└───────────────────────────────────────────────────────────┘
```

**Decisión clave [ACTUALIZADO]: no se reescriben los frontends.** Los dos prototipos ya resuelven UX y flujos (incluyendo casos finos como el ranking de preguntas por tasa de error, o el flujo de evaluación con 3 preguntas aleatorias en tablet). El trabajo de backend consiste en exponer una API que ambos consuman, y migrar cada pantalla del backoffice de "datos en memoria" a "datos reales" de forma incremental, ABM por ABM. Esto cierra la brecha que el documento de estado llama "Backoffice y app: dos copias separadas → una fuente de datos compartida".

**Autenticación diferenciada por cliente.** Los dos frontends tienen necesidades de auth distintas y no conviene forzarlos a un único esquema:
- `sima-training-backoffice`: login real con JWT. Hoy alcanza con roles simples (administrador/coordinador, como ya simula el prototipo); migra a roles formales (Alumno/Preceptor/Docente/Auditor vía `Vinculacion`) cuando esa entidad exista.
- `sima-check-app`: no necesita login tradicional — el flujo real es "ingreso por DNI" en un dispositivo compartido (tablet). La API debe exponer un endpoint de identificación liviano (buscar persona por DNI + sus asignaciones pendientes), no una sesión JWT completa. Forzar JWT aquí sería sobre-ingeniería para un flujo que es, en esencia, un kiosco.

Cada módulo futuro (Vinculacion, Modulo, Sesion, etc.) se agrega como un módulo de NestJS nuevo, no como cambios transversales — el corte por dominio ya definido en el modelo de datos se refleja 1:1 en la estructura de carpetas del código.

### 3.4 Decisiones de modelo de datos con impacto técnico directo

**a) Campo JSON flexible en `Usuario`.**
El documento fuente pide esto porque "todavía no se sabe cómo se cargan los empleados". Técnicamente: en Postgres esto es una columna `jsonb`, indexable parcialmente si en el futuro se necesita buscar por un atributo específico ahí adentro. Se trata como dato de tránsito: cuando se cierre el mapeo del Excel de nómina (pregunta abierta del documento), los campos que resulten estables se promueven a columnas reales vía migración. No se diseña esto como el modelo final.

**b) `Capacitacion_Vigente` como tabla vs. cálculo al vuelo.**
El documento ya lo marca como nota técnica: es información derivada. Para el Sprint 1 esto no aplica (no existe `Modulo` ni `Sesion` todavía), pero queda registrado como decisión a tomar en el sprint donde se implemente: arrancar calculándolo al vuelo (sin tabla) y materializarlo solo si el volumen de sesiones hace que la query sea lenta. Evita mantener una tabla derivada sincronizada desde el primer día sin necesidad real.

**c) Trazabilidad básica desde el día 1.**
`created_at`, `updated_at`, `created_by`, `updated_by` en las entidades principales se implementan en el Sprint 1, aunque la entidad de auditoría completa (historial de cambios) se posterga. Esto es barato de hacer ahora (un mixin de Prisma) y costoso de retrofittear después si no se hizo desde el inicio.

**d) Importación Excel — esqueleto, no implementación cerrada.**
El documento es explícito: falta el archivo definitivo. La arquitectura prepara el endpoint y el parser de forma genérica (recibe un archivo, lo valida estructuralmente, lo deja en estado "preview" antes de confirmar la carga), pero el mapeo de columnas específico queda como configuración a cerrar cuando llegue el Excel real — no se hardcodea un mapeo de columnas que probablemente esté mal.

**e) [ACTUALIZADO] Choque de terminología "Usuario" entre el prototipo y el modelo objetivo — riesgo a resolver antes de conectar el ABM.**
El prototipo `sima-training-backoffice` ya usa la palabra "Usuario" para las cuentas del sistema con rol administrador/coordinador (8 registros), y "Empleado" para las personas que rinden evaluaciones (15 registros) — dos conceptos separados. El modelo de datos objetivo usa "Usuario" para la identidad de **cualquier** persona (alumno, docente, preceptor, auditor, administrador), y el rol vive en la `Vinculacion`, no en el usuario. Son dos significados distintos de la misma palabra. Si el Sprint 1 conecta el ABM "Usuarios" del prototipo directo contra una tabla `Usuario` con el significado del modelo objetivo, sin aclarar esto, se corre el riesgo de mezclar "cuentas de acceso al sistema" con "personas evaluadas" en la misma entidad por arrastre del prototipo. **Recomendación:** antes de escribir el primer endpoint, confirmar con el equipo si "usuario del sistema" (quien loguea al backoffice) y "persona evaluada" (quien tiene un DNI y rinde exámenes) son la misma entidad con distintos roles, o dos entidades relacionadas. El modelo fuente sugiere que sí son la misma persona vista en distintos roles vía `Vinculacion`, pero el prototipo actual no lo modela así.

**f) [ACTUALIZADO] Categoría de contenido en `Modulo` — necesaria para los reportes, no para el Sprint 1.**
El roadmap de reportes (§7) cruza tipo de persona (SIMA vs. Subcontratista) con tipo de contenido (Reglas del cliente vs. Propios I.S., y dentro de "Propios I.S." las categorías H y E / TAC / Otros — siglas a confirmar, ver §4). Esto implica que `Modulo` necesita, a futuro, un campo de categoría/origen de contenido además de `validez_meses`. No se implementa en el Sprint 1 (no existe `Modulo` todavía), pero se deja registrado para no descubrirlo recién cuando se construya el módulo de reportes.

## 4. Riesgos y preguntas abiertas que condicionan sprints futuros

Estas preguntas (ya identificadas en el documento fuente) bloquean decisiones de modelo, no de arquitectura técnica, así que no frenan el Sprint 1, pero sí los siguientes:

1. **Vinculaciones simultáneas** — define si `Vinculacion` activa es 1:1 o 1:N con el usuario. Afecta el diseño de la capa de autorización (qué rol "gana" si hay varias vinculaciones activas).
2. **Origen real de los datos de empleados** (RRHH / Excel maestro / otra base) — define el mapeo de importación y qué tan rígido puede ser el modelo de `Usuario` a futuro.
3. **Excel de nómina definitivo** — bloqueante para cerrar el módulo de importación.
4. **Acceso al repo de SIMA CHECK (producción)** — bloqueante para la decisión de integrar vs. reconstruir (offline, sync, Metabase). No bloquea el Sprint 1, pero sí cualquier decisión de arquitectura de sincronización futura.
5. **Plazos de validez reales por módulo** — no bloquea Sprint 1 (no hay `Modulo` aún).
6. **[ACTUALIZADO] ¿`sima-check-app` (el prototipo nuevo) es el reemplazo de SIMA CHECK de producción, o un proyecto distinto?** Condiciona si vale la pena invertir en conectar `sima-check-app` a la API real ahora, o si ese esfuerzo se descarta el día que se decida integrar con el SIMA CHECK existente.
7. **[ACTUALIZADO] Significado de las siglas "I.S." y "TAC"** (categorías de contenido en el reporte de cumplimiento) — no bloquea Sprint 1, pero sí el diseño del campo categoría en `Modulo` (§3.4-f).
8. **[ACTUALIZADO] Relación entre "Usuario" (cuenta de sistema, rol admin/coordinador) y "Empleado" (persona evaluada) en el modelo objetivo** — ver §3.4-e. Este es el más urgente de los nuevos: afecta directamente cómo se construye el ABM del Sprint 1 en curso.

**Recomendación:** resolver la pregunta 8 esta misma semana, antes de cerrar el esquema de `Usuario` del Sprint 1 — es la única de este grupo que toca código que se está escribiendo ahora. Asignar dueño y fecha límite a las preguntas 1, 2 y 3 antes de planear el Sprint 2, porque ese sprint probablemente ataque `Vinculacion` y el cierre de la importación.

---

## 5. Sprint 1 — Plan semanal

**Objetivo del sprint:** tener el backend y la base de datos funcionando, con el ABM de usuarios del backoffice existente conectado a datos reales (no hardcodeados), y el esqueleto de importación Excel listo para recibir el mapeo cuando llegue el archivo.

**Duración:** 1 semana. **[ACTUALIZADO]** Según el documento de estado del 23/06, este sprint ya está en curso y su foco confirmado es la carga de empleados (manual y por Excel) sobre un backend real — coincide con el alcance ya definido acá.

**Entregable demostrable:** la pantalla de Usuarios de `sima-training-backoffice` funcionando contra una base de datos real (no contra el array hardcodeado actual), desplegado en un ambiente accesible.

**Dato útil para pruebas:** el prototipo ya tiene un set de datos hardcodeado (5 empresas, 8 usuarios, 15 empleados) que puede usarse como fixture/semilla para validar que la migración a backend real no rompe los casos que el prototipo ya cubre (ej. duplicados, filtros por empresa).

### Backlog

| # | Historia / Tarea | Detalle | Criterio de aceptación |
|---|---|---|---|
| 1 | Setup de repositorio y proyecto NestJS | Inicializar repo, estructura de carpetas por módulo (`usuarios`, `organizaciones`, `import`), linter, formateo, variables de entorno | Proyecto corre localmente con `npm run start:dev` sin errores |
| 2 | Setup de PostgreSQL gestionada + Prisma | Provisionar instancia en Render/Railway, configurar Prisma, primera migración vacía | Conexión exitosa desde el backend a la DB en cloud |
| 3 | Pipeline de CI básico | Lint + build + test en cada push, deploy automático a un ambiente único | Push a `main` dispara deploy sin intervención manual |
| 4 | Entidad `Usuario` (esquema) | Campos estables: `id`, `nombre`, `apellido`, `dni` (único), `created_at/updated_at/created_by/updated_by` + columna `jsonb` para datos flexibles | Migración aplicada; constraint de unicidad en `dni` verificado |
| 5 | Entidad `Organizacion` (esquema) | Campos: `id`, `nombre`, `tipo` (CLIENTE/SUBCONTRATISTA), `organizacion_padre_id` (FK nullable, self-referencial), trazabilidad | Migración aplicada; FK auto-referencial probada con un caso subcontratista→cliente |
| 6 | API CRUD de `Usuario` | Endpoints crear, listar, ver detalle, editar, (soft) eliminar | Casos de prueba cubren alta con DNI duplicado (debe rechazar) y edición del campo flexible |
| 7 | API CRUD de `Organizacion` | Endpoints crear, listar, ver detalle, editar | Caso de prueba: crear subcontratista vinculado a un cliente existente |
| 8 | **[ACTUALIZADO]** Conectar la pantalla de Usuarios existente a la API real | No se construye UI nueva: se reemplazan los datos hardcodeados de `sima-training-backoffice` por llamadas a la API de Usuarios/Organizaciones. Implementar la baja (delete), que el prototipo todavía no tiene | Una persona no técnica puede dar de alta, editar y dar de baja un usuario sin asistencia, y los cambios persisten tras refrescar la página |
| 9 | Autenticación básica (sin roles) | Login simple con JWT, sin lógica de permisos todavía | Un endpoint protegido rechaza requests sin token válido |
| 10 | Esqueleto de importación Excel | Endpoint que recibe un `.xlsx`, valida estructura genérica (filas, columnas no vacías) y devuelve un preview sin persistir | Subir un Excel de prueba devuelve preview correcto; no hay mapeo de columnas cerrado todavía (a propósito) |
| 11 | Documentación técnica mínima | README con setup local, variables de entorno, comando de migración | Alguien nuevo puede levantar el proyecto siguiendo solo el README |

### Fuera de alcance (explícitamente, según el documento fuente)

`Vinculacion`, `Extension`, `Modulo`, `Modulo_Version`, `Pregunta`, `Sesion`, `Capacitacion_Vigente`, `Asignacion`, roles y permisos. Todo esto es diseño a futuro y no se toca en este sprint.

### Definition of Done del sprint

- Código en repo, con CI verde.
- Migraciones de `Usuario` y `Organizacion` aplicadas en la base de datos de cloud (no solo local).
- ABM de usuarios accesible y demostrable por alguien fuera del equipo de desarrollo.
- Esqueleto de importación Excel acepta un archivo y devuelve preview, sin persistir nada (porque el mapeo no está cerrado).
- README permite a otra persona levantar el entorno desde cero.

---

## 6. Qué revisar a medida que el sistema crece

- Si el volumen de sesiones de examen crece mucho, revisar si `Capacitacion_Vigente` necesita materializarse como tabla (ver §3.4-b).
- Si en el futuro se conecta con el SIMA CHECK de producción, revisar si conviene extraer el módulo de exámenes/sesiones a un servicio separado para no acoplar el ciclo de release de Training al de Check.
- Una vez resueltas las preguntas abiertas 1 y 2 (§4), revisar si el modelo de `Vinculacion` necesita soportar múltiples vinculaciones activas simultáneas — eso cambia la forma de resolver "rol efectivo" en la capa de autorización.

## 7. Roadmap más allá del Sprint 1 — **[NUEVO]**

Tomado de "Próximas Implementaciones" y "Estado de la Plataforma" (23/06). Esto no es planificación de sprint todavía, es el backlog priorizado que alimenta los sprints siguientes una vez resueltas las preguntas abiertas críticas (§4, ítem 8 primero).

### 7.1 Pantallas de gestión (ABM) pendientes

Todas siguen el mismo patrón que el Sprint 1: la UI ya existe como prototipo en `sima-training-backoffice`, el trabajo es construir la entidad real en el backend y conectar.

| ABM | Entidad de backend asociada | Nota |
|---|---|---|
| Clientes | `Organizacion` (tipo CLIENTE) | Backend ya contemplado desde Sprint 1 (§3) |
| Subcontratistas | `Organizacion` (tipo SUBCONTRATISTA) + `Vinculacion` | Necesita fecha de vencimiento **por vinculación**, no por organización — depende de que `Vinculacion` exista |
| Temas / Módulos | `Modulo` (+ futuro campo categoría, ver §3.4-f) | Con plazo de validez y categoría (H y E, TAC, Otros — siglas a confirmar) |
| Cronogramas | Nueva entidad, no descrita aún en el modelo de datos fuente | Requiere su propio diseño de modelo antes de poder estimarse |

### 7.2 Capacitaciones (motor de asignación y vigencia)

Ya cubierto conceptualmente por el modelo de datos fuente (`Asignacion`, `Capacitacion_Vigente`, aviso de redundancia, revalidación por versión) — no agrega entidades nuevas respecto a lo ya diseñado, es la implementación de lo que el modelo ya prevé.

### 7.3 Reportes de cumplimiento y éxito

Tablero que cruza **tipo de persona** (SIMA vs. Subcontratista) con **tipo de contenido** (Reglas del cliente vs. Propios I.S., y dentro de Propios I.S.: H y E, TAC, Otros).

- **% Cumplimiento** = alumnos que rindieron ÷ alumnos que debían rendir (mide participación). Depende de que existan asignaciones — sin asignaciones no hay denominador.
- **% Éxito** = alumnos que aprobaron ÷ alumnos que rindieron (mide desempeño).

Esto es una vista de agregación sobre `Asignacion` + `Sesion` + `Organizacion.tipo` + la futura categoría de `Modulo`. No requiere una entidad nueva, pero sí que `Modulo` tenga la categoría resuelta (§3.4-f) y que el motor de asignaciones esté funcionando — por eso depende de §7.2.

### 7.4 Brecha código-objetivo (de "Estado de la Plataforma", para referencia rápida)

| Tema | Hoy (prototipo) | Objetivo |
|---|---|---|
| Backend / BD | No existe | Backend con base de datos y persistencia |
| Backoffice y app | Dos copias separadas | Una fuente de datos compartida |
| Empleado ↔ empresa | Asociación directa | Vía `Vinculacion` (con historial) |
| Evaluaciones | 20 registros estáticos | Generadas al rendir, con vigencia |
| Baja de registros | No implementada | ABM completo |
| Autenticación | Usuario hardcodeado | Login real, diferenciado por cliente (§3.3) |
| Importación Excel | No implementada | Carga de nómina |

Esta tabla es el mapa de qué Sprint resuelve qué fila — sirve como checklist de avance a medida que se cierren sprints.
