# Decisiones — Usuarios y vinculación

Cubre `Usuario` (identidad pura), `Vinculacion` (organización + rol), `VinculacionPuestoCentro` (los pares puesto+centro), la matriz tipo-de-organización ↔ rol, el import de nómina desde Excel, y la pantalla de Usuarios del backoffice con su ABM de pares.

**No cubre**: qué módulos le corresponden a una persona por sus pares — eso es [asignaciones.md](./asignaciones.md), que consume estos pares pero decide aparte. Tampoco el historial de cambios de una vinculación ([auditoria.md](./auditoria.md)) ni la hoja de vida de una persona ([asignaciones.md](./asignaciones.md#veredicto-de-habilitación)).

## `Usuario` es una sola entidad, y es identidad pura

Una sola entidad para **cualquier persona**, sea cuenta de sistema, persona evaluada o las dos cosas: unifica los conceptos `User` y `Employee` que el prototipo modelaba por separado.

Y es **identidad pura**: nombre, apellido, DNI, email, `datos`. Todo lo que es pertenencia —rol y organización— vive en `Vinculacion`, y el par puesto+centro en `VinculacionPuestoCentro`.

`Vinculacion` tiene `usuarioId @unique`: la regla *"una sola organización por persona"* **es el índice**, no disciplina del service.

No hay endpoints `/vinculaciones`, y el ABM sigue siendo uno solo (`/usuarios`): la vinculación se crea y se edita **anidada** en el mismo request, porque no tiene ciclo de vida propio.

## El campo `datos` (jsonb)

Está en `Usuario` para datos de nómina flexibles. Hoy lo escribe **únicamente** el import de Excel y, desde que puesto y centro de costo se resuelven contra el catálogo real (ver más abajo), guarda sólo `legajo`: ya no hay mapeo abierto de columnas no reconocidas ni el viejo `puesto`/`sector` de texto libre.

El ABM de Usuarios del backoffice **no lo edita ni lo muestra**. Se sacó la sección "Datos de nómina" del modal porque duplicaba Puesto y Centro de Costo con el catálogo real, y porque el PATCH pisaba sin merge las columnas extra que dejaba el import.

## Puesto y centro de costo van APAREADOS, no como ejes independientes

La capacitación obligatoria depende del **par**: *"Soldador en YPF" ≠ "Soldador en PAE"*, y el mismo puesto en dos centros son dos filas distintas. Con dos listas sueltas, alguien con puestos {Soldador, Amolador} y centros {YPF, PAE} se leía como habilitado para cualquier combinación.

Por eso el filtro `?puestoId=&centroCostoId=` del listado es **exacto**: devuelve a quien ejerce ese puesto *dentro de* ese centro, no a quien tiene los dos por separado. Y sólo matchea pares con `activo: true` — un par dado de baja no cuenta como "trabaja ahí".

Una persona puede tener **cero, uno o varios** pares, y la regla de negocio es que **rinde los módulos de TODOS**, no sólo los del principal.

## `principal` es sólo display, con el manejo mínimo

El alumno rinde los módulos de todos sus pares, así que el principal **no decide nada**: sólo qué fila puesto/centro muestra el listado. El primer par que se carga queda principal y listo — sin herencia automática al desactivarlo, sin promoción de otro par, sin specs (no vale la pena testear algo cosmético; que se muestre un par inactivo es cosmético, no un bug).

La única cautela técnica, por si algún día hace falta un swap: van **dos UPDATEs dentro de una transacción** (bajar el viejo, subir el nuevo). El índice único parcial no es diferible y un `updateMany` único lo violaría a mitad de camino. Hoy no existe ningún flujo de swap y no se construyó uno.

Ese índice es `UNIQUE (vinculacion_id) WHERE principal AND activo`, y **filtra por `activo` y no sólo por `principal` a propósito**: con el predicado corto, un par con `principal = true` y `activo = false` —un *principal fantasma*, un estado que no debería poder existir— seguía ocupando el único lugar disponible y bloqueaba promover otro par. Con el predicado completo, desactivar el par principal libera el lugar. Un unique común no sirve en ninguna de las dos formas: sobre `(vinculacion_id)` prohibiría tener más de un par, y sobre `(vinculacion_id, principal)` dejaría pasar N filas con `principal = false`.

## El listado no oculta a quien no tiene pares

Las condiciones sobre `vinculacion` se agregan al `where` **sólo si el filtro correspondiente viene**. Sin filtros aparecen también las personas con cero pares —el pivote arranca vacío, es una cardinalidad válida— y su `parPrincipal` viaja en `null`.

Filtrar por puesto o centro es lo único que las deja afuera.

## Un solo `include` para lista y detalle

`USUARIO_INCLUDE` es compartido, así que las dos rutas devuelven **la misma forma**: `vinculacion: { rol, organizacion, parPrincipal, pares }`. Se devuelve `pares` completo además de `parPrincipal` para no tener dos contratos distintos según el endpoint.

## La matriz tipo-de-organización ↔ rol se valida en el service, no en el DTO

`INTERNA` → todos los roles · `CLIENTE` → sólo AUDITOR · `SUBCONTRATISTA` → sólo ALUMNO.

Cruza dos tablas —el rol está en `Vinculacion`, el tipo en `Organizacion`—, así que class-validator no puede expresarla y tampoco hay CHECK constraint posible sin un trigger. Vive en `src/usuarios/matriz-rol-organizacion.ts` como **función pura que devuelve el motivo del rechazo o `null`**: no lanza, para que el alta lo convierta en 400 y el import lo reporte como error de esa fila sin abortar el archivo.

La validan por igual el alta manual y el import, porque los dos pasan por el mismo `UsuariosService.create` (ver abajo).

## El PATCH de `pares` reemplaza el set completo, no mergea

Mandar `pares` borra los que había y crea los de la lista, dentro de una transacción y **borrando antes de crear** (por el índice único parcial de `principal`, que no es diferible). Omitir `pares` los deja intactos.

El borrado de `VinculacionPuestoCentro` es **físico**: la fila desaparece. Que eso sea legítimo —y no una pérdida de historial— depende de que el cambio quede registrado en el log de auditoría, que es la única fuente de "qué pares tuvo" esta persona: ver [auditoria.md](./auditoria.md#el-borrado-físico-de-los-pares-se-vuelve-legítimo-gracias-a-esta-decisión-no-a-pesar-de-ella).

## El import de nómina no reimplementa el alta

`ImportService.confirmarUsuarios` arma un `CreateUsuarioDto` por fila y llama a `UsuariosService.create(dto, 'import')`, cada una en su propio try/catch. Así la matriz, el revive-por-DNI, el recálculo de asignaciones y la trazabilidad son **literalmente el mismo código** en los dos caminos.

El rol quedó **fijado a `ALUMNO`** y la organización se elige una sola vez en el modal, antes de subir el archivo: el Excel no tiene columnas `rol` / `empresa` / `email` / `sector`. Como `Vinculacion.organizacionId` es NOT NULL y la matriz rechaza una nómina de alumnos contra una organización `CLIENTE`, el frontend filtra los tipos válidos antes de dejar analizar el archivo. Consecuencia: una fila cuya empresa no resuelve pasó de "usuario huérfano sin organización" a **error de fila**.

## El import resuelve Puesto y Centro de Costo contra el catálogo real

Antes esas dos columnas iban al jsonb `datos` como texto libre sin validar, así que un usuario importado **no aparecía con puesto ni centro en ningún listado** hasta que un admin se lo cargaba a mano. Ahora se resuelven contra `Puesto`/`CentroCosto` y se crea el par `VinculacionPuestoCentro` igual que si se hubiera cargado a mano — el objetivo era cerrar ese hueco, no sólo mostrar el texto.

- **Reusa el matching de `similitud.ts`**, el mismo del import de preguntas: normalización en español + coeficiente de Dice sobre trigramas, con `UMBRAL_PARECIDA = 0.7`. El campo `preguntaId` de `RefSimilitud`/`ClasificacionCatalogo` es el nombre genérico que ya define ese archivo compartido; no vale la pena tocarlo sólo por naming al reusarlo para `puestoId`/`centroCostoId`.
- **`previewUsuarios` clasifica pero NO empuja las filas nuevas de vuelta a `refs`**, a diferencia de `previewPreguntas`, que sí lo hace para detectar duplicados intra-archivo. Acá dos filas con el mismo puesto nuevo ("Pintor" ×2) deben salir **ambas** `'nueva'` de forma independiente: el catálogo todavía no tiene "Pintor", así que la 2ª fila no es "duplicada de la 1ª". El dedupe de "crear este catálogo nuevo una sola vez" queda del lado del frontend, agrupando por texto normalizado.
- **`confirmarUsuarios` es JSON puro, no multipart** (mismo patrón que `confirmarPreguntas`): el Excel no se re-sube, el frontend manda las filas ya resueltas con `puestoId`/`centroCostoId` reales. Son obligatorios a nivel de DTO (`@IsUUID()` sin `@IsOptional`), así que la regla *"nunca un usuario activo sin puesto y centro de costo"* queda garantizada **estructuralmente**, no por convención de service.
- **Crear un catálogo nuevo lo dispara el frontend** (`crearOResolverCatalogo`), llamando a los endpoints que ya existen; el import no abre una transacción propia para esto. Si dos filas piden el mismo puesto nuevo, el frontend agrupa por texto (trim + lowercase) y crea **una sola vez**; si aun así el POST choca con el `@unique` de nombre —otra fila o otro admin lo creó en el medio—, recupera el id buscándolo en el catálogo recién refrescado en vez de abortar.
- **La UI de revisión tiene 3 pasos**: *seleccionar* (archivo + organización) → *revisión* (tabla con checkbox por fila y badge nueva/parecida/duplicada, más un resolver **por grupo** separado para Puestos y para Centros de Costo, con `<select>` para usar el sugerido, crear nuevo o elegir del catálogo) → *resultado* (creados/omitidos/errores por fila). El botón "Importar" queda deshabilitado hasta que todos los grupos que tocan las filas tildadas estén resueltos.
- **La columna `sector` se eliminó del todo**: no era una entidad del modelo, era texto libre al jsonb sin uso real.

## Frontend: el alta está fijada a ALUMNO

Decisión de producto, no una limitación técnica: la abstracción de roles del sistema todavía no está definida, y el único admin previsto entra con `AUTH_USER`/`AUTH_PASSWORD` del `.env` en vez de ser un `Usuario`. El backend sigue soportando los cuatro roles y la matriz sin cambios.

El formulario no tiene `<select>` de rol: al crear manda siempre `rol: 'ALUMNO'`, y **al editar no manda `rol` en absoluto**, así que el rol real de un usuario legacy con otro rol nunca se pisa en silencio — se muestra como texto de solo lectura.

El frontend tiene una **copia chica de la matriz** (`TIPOS_ORG_POR_ROL`, comentada como espejo de `matriz-rol-organizacion.ts`) para filtrar el `<select>` de Organización según el rol efectivo y no ofrecer una combinación que el backend vaya a rechazar con 400. Si el filtro deja el select sin ninguna organización válida, se muestra un mensaje en vez de un `<select>` vacío y se deshabilita Guardar.

## Frontend: el ABM de pares es 100% en memoria

`ParesPuestoCentro.jsx` no pega al backend fila por fila: arma la lista en memoria y se manda entera al guardar, coherente con que el PATCH reemplace el set completo.

Dos detalles del contrato que condicionan el componente:

- **`ParPuestoCentroDto` sólo acepta `puestoId`/`centroCostoId`** — no hay campo `principal` ni `activo` en el payload. El backend deriva `principal` de la **posición 0 del array**, así que el frontend reordena localmente (principal primero) recién al guardar.
- Como el PATCH reemplaza todo, **no hay forma de persistir un par "inactivo" desde este formulario**: `activo` no es editable acá, coherente con que hoy todo par nuevo se crea activo.

`pares` se manda siempre al crear; al editar, **sólo si la sección se tocó**, para no pisar el set existente con un array vacío o desactualizado.
