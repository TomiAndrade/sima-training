# Sprint 09 — Configuración de módulo y visibilidad

_Generado el 13-08-2026_

## Resumen

- Total de Stories: 14
- Story points totales: 41
- Prioridad Alta: 4 · Media: 6 · Baja: 4

**Línea de corte sugerida: después de la Story 9 (25 pts).** El sprint pasado fueron 44 puntos y se cortó en el 7. Hasta la 9 el sprint entrega la configuración de módulo completa, el storage de producción resuelto y las mejoras de listado. De la 10 a la 14 arrancan el siguiente.

## Orden de ejecución sugerido

1. Averiguar qué son el ID de vinculación y el número de usuario
2. Migrar el storage de imágenes a object storage
3. Configuración de evaluación por módulo
4. Aplicar el límite de reintentos y la espera entre intentos
5. Elegir bases de conocimiento al crear un módulo
6. Botón de actualizar en el historial de usuario
7. Achicar el listado de reglas de asignación
8. Rehacer la columna Módulos en el banco de preguntas
9. Buscador en los filtros con listas largas
10. Que recargar la página no vuelva al panel principal
11. Agregar feedback dentro de SIMA CHECK
12. Dashboard de SIMA CHECK con datos reales
13. Sacar `backendTypeBadge` de `sima-check`
14. Cerrar el registro de ingreso por QR

---

## Story 1 — Averiguar qué son el ID de vinculación y el número de usuario
**Prioridad:** Alta · **Estimación:** 1 pt

Spike. Aparecen dos identificadores distintos y no está claro cuál se muestra dónde ni cuál usa la gente para referirse a una persona. Va primero porque puede destapar algo que afecte otras pantallas.

**Tareas:**
- [x] Rastrear de dónde sale cada uno (`Usuario.id`, `Vinculacion.id`, ¿algún campo en `datos`?)
- [x] Ver dónde se expone cada uno hoy en el backoffice y en la tablet
- [x] Decidir cuál es el identificador que ve la gente y documentarlo
- [x] Anotar si hace falta cambiar algo, sin implementarlo en esta story

**Resultado:** los dos salen del mismo lugar — el diff del audit log en `HistorialUsuario.jsx`, que muestra `ID` (= `Vinculacion.id`) y `Usuario` (= `Usuario.id`), las dos PK `autoincrement`. El identificador de la gente es el **DNI**. Los dos arreglos que destapó se hicieron en el acto: las PK salieron del render del audit log, y el `legajo` —que se importaba y no lo leía ningún frontend— se eliminó junto con el jsonb `Usuario.datos` entero. Rastreo completo en [decisiones/usuarios.md](decisiones/usuarios.md#el-identificador-que-ve-la-gente-es-el-dni-y-es-el-único). No afecta a ninguna otra pantalla del sprint.

---

## Story 2 — Migrar el storage de imágenes a object storage
**Prioridad:** Alta · **Estimación:** 5 pts

Bloqueante de producción. `LocalDiskStorage` escribe en disco efímero: el primer redeploy borra todas las imágenes de preguntas y la base queda con claves que apuntan a nada.

**Tareas:**
- [ ] Elegir proveedor (R2 vs S3) verificando precios actuales
- [ ] Crear la cuenta y el bucket, con las credenciales en el `.env`
- [ ] Escribir la implementación nueva de `StorageService` (la interfaz no cambia)
- [ ] Verificar que subir, servir y borrar una imagen funcionan de punta a punta
- [ ] Probar que un reinicio del servidor no pierde nada

---

## Story 3 — Configuración de evaluación por módulo
**Prioridad:** Alta · **Estimación:** 5 pts

Hoy son 3 preguntas y 70% para todos los módulos, hardcodeado. Pasa a decidirlo quien crea el módulo. Las cuatro columnas entran en la misma migración aunque los reintentos se apliquen en la story siguiente.

**Tareas:**
- [ ] Migración: `cantidadPreguntas`, `umbralAprobacion`, `cantidadReintentos` y `esperaEntreIntentos` en `Modulo`
- [ ] Sumar los campos al form de creación de módulo, con los valores de hoy como default
- [ ] Que el sorteo del examen use `cantidadPreguntas` del módulo en vez de la constante
- [ ] Que la corrección use el umbral del módulo, con la constante como fallback
- [ ] Verificar que las sesiones viejas siguen mostrando el umbral con el que se rindieron
- [ ] Specs del sorteo y de la corrección con umbral por módulo

---

## Story 4 — Aplicar el límite de reintentos y la espera entre intentos
**Prioridad:** Alta · **Estimación:** 3 pts

Usa las dos columnas de la story anterior. Es la primera regla que puede impedir que alguien arranque una evaluación, así que el mensaje de rechazo importa tanto como la validación.

**Tareas:**
- [ ] Decidir desde cuándo cuenta la espera (fin del intento anterior)
- [ ] Validar en el endpoint del examen: sin intentos disponibles o dentro de la espera, no se entrega
- [ ] Mensaje claro en la tablet: cuántos intentos quedan y desde cuándo puede volver
- [ ] Decidir qué pasa con una sesión offline que llega y ya no tenía intentos
- [ ] Specs de los dos límites

---

## Story 5 — Elegir bases de conocimiento al crear un módulo
**Prioridad:** Alta · **Estimación:** 3 pts

Hoy el módulo se crea y recién después, entrando a editar contenido, se le pueden poner criterios. Se agrega el selector al modal de creación. El endpoint ya existe.

**Tareas:**
- [ ] Sumar el selector de base y nivel al modal de creación de módulo
- [ ] Llamar a `PUT /modulos/:id/criterios` después de crear, si se eligió alguna
- [ ] Mostrar cuántas preguntas materializa cada criterio antes de confirmar
- [ ] Que crear sin criterios siga siendo válido

---

## Story 6 — Botón de actualizar en el historial de usuario
**Prioridad:** Baja · **Estimación:** 1 pt

Después de que alguien rinde en la tablet hay que salir y volver a entrar para ver el resultado. Un botón que vuelva a pedir el informe alcanza.

**Tareas:**
- [x] Botón que vuelve a llamar a `GET /usuarios/:id/informe`
- [x] Indicador de carga mientras refresca, sin desmontar lo que ya se ve

**Resultado:** botón "↻ Actualizar" arriba, al lado de "← Volver a Usuarios". La trampa era que `loading` y `error` son early returns que reemplazan la pantalla entera, así que reusar el `reintentar()` existente hubiera hecho exactamente lo que la story pide evitar; el refresco tiene su propio par `refrescando`/`errorRefresco`. Si falla, banner arriba y los datos de la última carga quedan abajo. Ver [decisiones/asignaciones.md](decisiones/asignaciones.md#la-vista-de-historial-early-return-y-coreformat).

---

## Story 7 — Achicar el listado de reglas de asignación
**Prioridad:** Baja · **Estimación:** 2 pts

El acordeón lista todos los centros activos, incluidos los que no tienen ninguna regla. Con el catálogo real eso es una lista larga de filas vacías.

**Tareas:**
- [ ] Mostrar solo los centros que tengan al menos una regla
- [ ] Buscador por nombre de centro
- [ ] Que los centros sin reglas sigan siendo alcanzables (toggle o mensaje), porque detectar centros sin capacitación configurada era el motivo original de listarlos

---

## Story 8 — Rehacer la columna Módulos en el banco de preguntas
**Prioridad:** Baja · **Estimación:** 2 pts

Hoy la columna muestra todos los badges y se desborda cuando una pregunta está en varios módulos.

**Tareas:**
- [ ] Mostrar el módulo al que se asignó primero, más un contador del resto
- [ ] Desplegable en la fila con la lista completa
- [ ] Mantener el badge de activa/inactiva por módulo

---

## Story 9 — Buscador en los filtros con listas largas
**Prioridad:** Media · **Estimación:** 3 pts

Con 88 puestos y 16 centros, un select plano es inusable. `MultiSelectFilter` ya tiene buscador; los que faltan son los selects simples.

**Tareas:**
- [ ] Inventariar qué filtros tienen buscador y cuáles no
- [ ] Decidir si se extiende `MultiSelectFilter` a selección única o se hace un componente aparte
- [ ] Aplicarlo en Usuarios (puesto, centro, organización)
- [ ] Aplicarlo en Bases y en donde haya quedado alguno suelto

---

> **Línea de corte sugerida — 25 pts hasta acá.**

---

## Story 10 — Que recargar la página no vuelva al panel principal
**Prioridad:** Media · **Estimación:** 3 pts

El backoffice no usa router a propósito y la navegación vive en `useState`, así que F5 pierde dónde estabas. Hay que persistir la página actual sin meter react-router.

**Tareas:**
- [ ] Decidir el mecanismo: hash en la URL o `sessionStorage`
- [ ] Persistir la página y la tab de SIMA CHECK
- [ ] Definir qué pasa con el estado interno de una pantalla (filtros, historial abierto): se pierde y está bien, o se persiste también
- [ ] Verificar que no rompe el early return de Ver historial

---

## Story 11 — Agregar feedback dentro de SIMA CHECK
**Prioridad:** Media · **Estimación:** 3 pts

Que quien rinde pueda reportar una pregunta mal redactada o dejar un comentario. Es la única vía para detectar preguntas malas: hoy solo se ve el score.

**Tareas:**
- [ ] Definir el alcance: reporte por pregunta, comentario libre al final, o los dos
- [ ] Modelar la entidad y su migración
- [ ] Endpoint que lo recibe, con el usuario saliendo del token
- [ ] UI en la tablet, sin interrumpir la evaluación
- [ ] Dónde se lee el feedback en el backoffice

---

## Story 12 — Dashboard de SIMA CHECK con datos reales
**Prioridad:** Media · **Estimación:** 8 pts

El Resumen es casi todo mock: KPIs, gráfico de aprobación y últimas evaluaciones. Necesita endpoints de agregados que hoy no existen — no hay nada que liste sesiones o asignaciones de toda la gente.

**Tareas:**
- [ ] Definir qué métricas van y cuáles se descartan
- [ ] Endpoint de agregados: aprobación por módulo, gente con módulos vencidos, evaluaciones recientes
- [ ] Decidir si se calcula al vuelo o se cachea (mirar el costo de las queries con la nómina completa)
- [ ] Reemplazar los StatCards mockeados por los datos reales
- [ ] Gráfico de aprobación contra datos reales, no contra el array literal de nombres
- [ ] Definir el refresco: al entrar, o polling cada N segundos
- [ ] Borrar los mocks que queden sin consumidor y actualizar `CLAUDE.md`

---

## Story 13 — Sacar `backendTypeBadge` de `sima-check`
**Prioridad:** Baja · **Estimación:** 1 pt

`core/components/ImportPreguntasModal.jsx` importa de `sima-check/`, violando la regla de dependencia. Es anterior al sprint pasado y el arreglo es el mismo que se le hizo a `formatVersionNumero`.

**Tareas:**
- [ ] Mover el helper a `core/format/` (ojo: devuelve JSX, así que el archivo tiene que ser `.jsx`)
- [ ] Actualizar los imports y verificar que no queda ningún puente
- [ ] Correr el build

---

## Story 14 — Cerrar el registro de ingreso por QR
**Prioridad:** Baja · **Estimación:** 1 pt

El formulario ya está armado. Falta generar el QR, imprimirlo y probarlo. No toca el repo.

**Tareas:**
- [ ] Generar el QR estático apuntando a la URL del formulario
- [ ] Verificar escaneando que la URL sea la de Google y no la de un intermediario
- [ ] Imprimirlo con margen blanco y un texto arriba que diga qué es
- [ ] Probar el escaneo desde un celular a distancia real

---

## Notas / dudas

- **"Y mostrar fecha en…" quedó cortado.** La nota de F5 termina ahí. ¿Fecha en el header del backoffice, en la fila de cada usuario, en el historial? Sin eso no se puede estimar.
- **Reintentos y espera chocan con el modo offline.** Si la tablet rinde sin conexión, no puede saber cuántos intentos previos hay ni cuándo fue el último. El backend puede rechazar la sesión al sincronizar, pero ahí la persona ya rindió. Depende de lo que haya respondido Eduardo.
- **El umbral por módulo ya estaba previsto.** `Sesion.umbralAprobacion` se congela por fila desde la Story 4, y el comentario de `corregir.ts` dice que `UMBRAL_APROBACION_DEFAULT` pasa a ser el fallback el día que sea por módulo. No hay que migrar sesiones viejas.
- **"Dashboard en tiempo real" necesita definición.** Refrescar al entrar es una cosa; polling cada N segundos es otra; websockets es otra escala de trabajo. Se asumió polling simple.
- **Feedback en SIMA CHECK: falta el qué.** ¿Feedback sobre una pregunta puntual, sobre la evaluación entera, o un campo libre? Se asumió reporte por pregunta + comentario libre al final.
- **El buscador en filtros es menos trabajo del que parece.** `MultiSelectFilter` ya tiene buscador; los que no lo tienen son los `<select>` simples que entraron con la Story 11 y los de Bases.
- **El Dashboard real cubre parte de la deuda de mocks.** Quedan afuera Clientes y el Resumen de SIMA CHECK.
- **Object storage sigue sin proveedor decidido.** R2 no cobra egreso y suele salir más barato que S3 para este caso, pero hay que verificar precios actuales.
- **Faltan las respuestas de Eduardo.** Las de PIN, offline y catálogo de puestos no están registradas en el repo. Varias stories dependen de eso.
