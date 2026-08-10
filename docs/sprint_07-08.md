# Sprint 07-08 — Plan organizado

_Generado el 07-08-2026_

## Resumen
- Total de Stories: 12
- Story points totales: 44
- Prioridad Alta: 6 · Media: 5 · Baja: 1

## Orden de ejecución sugerido
1. Arreglar el arranque de producción (`start:prod`)
2. Spike: autenticación en dispositivos multiusuario
3. Cargar la nómina real con el Excel de Eduardo
4. Modelar la rendición de evaluaciones
5. Exponer los endpoints que consume la app tablet
6. Conectar `sima-check-app` al backend
7. Convertir la app en PWA instalable
8. Hacer que la vigencia de un módulo gobierne de verdad
9. Registrar el historial de cambios de una persona (AuditLog)
10. Armar el informe de usuario
11. Separar Puesto y Centro de Costo y agregar filtros en Usuarios
12. Registro de ingreso al polo por QR

---

## Story 1 — Arreglar el arranque de producción (`start:prod`)
**Prioridad:** Alta · **Estimación:** 1 pt

`start:prod` apunta a `node dist/main` pero el build emite `dist/src/main.js` porque `prisma/seed.ts` entra en la compilación. Nadie lo notó porque dev usa `start:dev` y el CI solo buildea. Si en septiembre esto tiene que correr en algún lado, es bloqueante.

**Tareas:**
- [x] Excluir `prisma/seed.ts` del `tsconfig.build.json` (o ajustar `rootDir`) para que el build vuelva a emitir `dist/main.js`
- [x] Verificar corriendo `npm run build && npm run start:prod` contra la base local
- [x] Agregar el arranque de prod al CI para que no se vuelva a romper en silencio
- [x] Decidir y documentar: disco persistente en `UPLOADS_DIR` o migrar a S3 antes de activar el deploy

**Nota de cierre**: el fix de `rootDir` reveló una regresión propia — con `rootDir` seteado, TypeScript escribía el `.tsbuildinfo` incremental fuera de `dist/`, donde `deleteOutDir` no lo limpia, y el segundo build consecutivo quedaba con `dist/` vacío en silencio (exit 0). Se corrigió con `tsBuildInfoFile` explícito dentro de `dist/`. De paso se agregó `.dockerignore` (no existía: `COPY . .` metía `node_modules`/`dist`/`.env` del host a la imagen) y el CI corre `npm run build` dos veces seguidas para cubrir esa regresión, más un smoke test de `start:prod` con Postgres real y `curl /health`. Decisión de storage: object storage (S3/R2), no disco — el plan free de Render no tiene discos persistentes.

---

## Story 2 — Spike: autenticación en dispositivos multiusuario
**Prioridad:** Alta · **Estimación:** 2 pts

Investigación, sin implementación. Va temprano porque la respuesta define el endpoint de ingreso de la Story 5. El escenario difícil es la tablet en atril: un solo dispositivo, muchas personas rindiendo una detrás de otra.

**Tareas:**
- [ ] Averiguar si Auth0 sirve para un dispositivo compartido: si se puede cerrar sesión rápido entre persona y persona, y cuánto cuesta el plan según cantidad de usuarios activos
- [ ] Ver qué pasa con la sesión cacheada cuando el dispositivo es multiusuario (el patrón que describió Cristian sirve para el celular propio, no necesariamente para el atril)
- [ ] Evaluar la alternativa: DNI + token de dispositivo (la tablet se registra una vez, la persona solo pone su DNI)
- [ ] Escribir la recomendación en `docs/` con el porqué, para que la Story 5 la tome como dada

---

## Story 3 — Cargar la nómina real con el Excel de Eduardo
**Prioridad:** Alta · **Estimación:** 3 pts

El mapeo de columnas del import quedó abierto a propósito hasta tener el Excel definitivo. Ya lo tenemos, así que se cierra. Sin datos reales no hay con qué probar la tablet end-to-end.

**Tareas:**
- [ ] Cerrar el mapeo de columnas contra el archivo real
- [ ] Verificar que las empresas de cada fila resuelven a una organización existente (si no, es error de fila)
- [ ] Verificar la columna `rol` opcional contra la matriz tipo-de-organización ↔ rol
- [ ] Cargar los pares puesto + centro de costo desde el Excel
- [ ] Importar la nómina completa en la base de dev y revisar el resultado

---

## Story 4 — Modelar la rendición de evaluaciones
**Prioridad:** Alta · **Estimación:** 5 pts

Es la entidad que no existía y que bloqueaba todo lo demás: aprobaciones, informe de usuario, vencimientos, estadísticas. El hueco estaba aislado en `AsignacionesService.modulosAprobados()`. **Resuelta** — ver la nota de cierre.

**Tareas:**
- [x] Definir el modelo: `Sesion` (o `Intento`) + `Respuesta` por pregunta, con `usuarioId`, `moduloVersionId`, score, aprobado, timestamps
- [x] Decidir si se guardan las respuestas individuales o solo el score agregado (afecta directo a las estadísticas por base de conocimiento)
- [x] Migración + módulo NestJS nuevo (no cambio transversal)
- [x] Implementar `modulosAprobados()` de verdad y verificar que `recalcular()` sigue siendo idempotente
- [x] Completar `Asignacion.moduloVersionId` al rendir
- [x] Specs de la lógica de aprobación (umbral 70%) y del reintento tras desaprobar

**Nota de cierre**: se guardan las respuestas individuales (`Respuesta`), no sólo el score — es barato ahora e imposible retroactivamente. Decisiones que ordenaron el resto: la corrección se **persiste** (`correcta`, `aprobada`) en vez de recalcularse contra el banco, y el umbral se **congela** en la fila, así que subirlo mañana no reescribe los certificados viejos. El resultado lo calcula **siempre** el backend: `aprobada`/`porcentaje` no existen en el DTO y la `ValidationPipe` los rechaza con 400 — la corrección local de la tablet es una copia, no la fuente de verdad. Un reintento es una fila más (sin unicidad sobre usuario+versión); "aprobó" es `EXISTS(aprobada)` sobre cualquier versión del módulo, y `Asignacion.moduloVersionId` se completa **sólo al aprobar**, pasando a significar "con qué versión se cumplió la obligación". Aparecieron dos cosas no previstas: `modulosAprobados()` se invocaba sin el cliente transaccional (latente mientras devolvía vacío, real apenas consultó), y `Sesion` es la **cuarta** entidad que deja corta la cadena de borrado de `limpiar()` — cuelga de Usuario, ModuloVersion **y** Asignacion, así que bloqueaba las tres ramas.

---

## Story 5 — Exponer los endpoints que consume la app tablet
**Prioridad:** Alta · **Estimación:** 5 pts

La app necesita cuatro cosas: identificarse, ver qué le falta, traer las preguntas y devolver el resultado. Todo el modelo ya existe salvo lo de la Story 4.

**Tareas:**
- [ ] Ingreso de la persona, según lo que haya resuelto el spike de la Story 2
- [ ] `GET` de capacitaciones pendientes de una persona (asignaciones vigentes sin aprobar)
- [ ] `GET` de las preguntas de la versión ACTIVA de un módulo, con la selección aleatoria
- [ ] `POST` de resultado de evaluación → crea la sesión y marca la asignación. **Idempotente**: mandarlo dos veces no crea dos sesiones (lo necesita el offline del sprint que viene)
- [ ] Traducir clave de storage → URL en las opciones de `OPCIONES_IMAGEN` (equivalente de `imagenUrl` del backoffice)
- [ ] Documentar los endpoints nuevos en el README del backend

---

## Story 6 — Conectar `sima-check-app` al backend
**Prioridad:** Alta · **Estimación:** 8 pts

Sacar los mocks de `data/` y que la app corra contra la API real. Es el entregable que más valor genera y el que se muestra en las pruebas de septiembre.

**Tareas:**
- [ ] Capa HTTP en la app (equivalente a `core/api/client.js` del backoffice)
- [ ] Migrar `UsuarioSelection` al ingreso real
- [ ] Migrar `ModuleSelection` a las asignaciones pendientes reales
- [ ] Migrar `Evaluation` a las preguntas del backend; `QuestionCard` mantiene la clave cruda como identidad para que `calculateScore` siga comparando bien
- [ ] `Results` postea la sesión en vez de mutar estado local
- [ ] Borrar `data/usuarios.js`, `data/modules.js`, `data/assignments.js`
- [ ] Estados de error y de red caída (mensaje claro, sin offline todavía)
- [ ] Prueba end-to-end manual con la nómina de la Story 3

---

## Story 7 — Convertir la app en PWA instalable
**Prioridad:** Media · **Estimación:** 3 pts

Una PWA es una app web que se instala como si fuera nativa. Esta story cubre solo eso: instalable y con actualizaciones. El modo offline (cachear datos y sincronizar al reconectar) queda para el sprint siguiente, que es donde está el trabajo caro.

**Tareas:**
- [ ] `manifest.json` con íconos, nombre y modo standalone
- [ ] Service worker que cachee el shell de la app (HTML, JS, CSS), todavía no los datos
- [ ] Flujo de actualización: avisar y recargar cuando hay versión nueva
- [ ] Probar la instalación en una tablet real

---

## Story 8 — Hacer que la vigencia de un módulo gobierne de verdad
**Prioridad:** Media · **Estimación:** 3 pts

Hoy `vigenciaMeses` se guarda pero no gobierna nada. Sin esto, "módulos vencidos" en el informe de usuario no tiene de dónde salir.

**Tareas:**
- [ ] Definir desde cuándo cuenta la vigencia (fecha de aprobación de la sesión)
- [ ] Calcular el estado vencido / por vencer / vigente
- [ ] Decidir qué hace `recalcular()` con un módulo vencido: ¿vuelve a generar la asignación automáticamente?
- [ ] Exponer el estado en el listado de asignaciones de una persona
- [ ] Specs del cálculo

---

## Story 9 — Registrar el historial de cambios de una persona (AuditLog)
**Prioridad:** Media · **Estimación:** 5 pts

Hoy el `PATCH /usuarios` reemplaza el set completo de pares, así que el historial de puestos y centros se pierde al editar. Un AuditLog cubre esto y el requisito ISO 9001 de una sola vez, y es mucho más barato ahora que retrofitteado.

**Tareas:**
- [ ] Modelar `AuditLog` genérico (entidad, entidadId, acción, diff jsonb, quién, cuándo)
- [ ] Enganchar los cambios de `Vinculacion` y `VinculacionPuestoCentro`
- [ ] `GET` del log de una persona
- [ ] Definir alcance: qué entidades se auditan en esta primera vuelta y cuáles no

---

## Story 10 — Armar el informe de usuario
**Prioridad:** Media · **Estimación:** 5 pts

La "hoja de vida" de cada persona que pidieron Cristian y Eduardo: entrar a un usuario y ver todo su recorrido. Depende de las Stories 4, 8 y 9 — sin ellas no hay qué mostrar. Va en la sección Usuarios del backoffice, no dentro de SIMA CHECK.

**Tareas:**
- [ ] Vista de detalle de un usuario con sus datos y su vinculación
- [ ] Resultados: todas las veces que rindió, con score y aprobado/desaprobado
- [ ] Módulos pendientes y módulos vencidos
- [ ] Historial de puestos, centros y organización (del AuditLog)
- [ ] Fecha de primera alta
- [ ] Exportar a CSV

---

## Story 11 — Separar Puesto y Centro de Costo y agregar filtros en Usuarios
**Prioridad:** Media · **Estimación:** 3 pts

Trabajo de frontend nada más: los filtros `?organizacionId=` / `?puestoId=` / `?centroCostoId=` ya existen en el backend y el filtro por par es exacto (quien ejerce ese puesto *dentro de* ese centro).

**Tareas:**
- [ ] Separar la columna actual en dos: Puesto y Centro de Costo
- [ ] Filtro por centro de costo
- [ ] Filtro por puesto
- [ ] Filtro por organización
- [ ] Que los filtros combinen entre sí y con las tabs existentes

---

## Story 12 — Registro de ingreso al polo por QR
**Prioridad:** Baja · **Estimación:** 1 pt

Formulario de Google para que quien entra al polo deje sus datos escaneando un QR. No toca el monorepo.

**Tareas:**
- [ ] Armar el form con los campos que hagan falta
- [ ] Generar el QR e imprimirlo
- [ ] Probar el escaneo desde un celular

---

## Notas

- **44 puntos es cerca del doble de un sprint.** Un corte razonable es la Story 7: hasta ahí son 27 puntos y el resultado es la tablet conectada, instalable y con nómina real, que es lo que hay que mostrar en septiembre. De la 8 a la 12 arrancan el sprint siguiente.
- La Story 12 no depende de nada y no toca código: se puede hacer en cualquier hueco.
