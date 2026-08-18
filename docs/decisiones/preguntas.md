# Decisiones — Banco de preguntas y clasificación

Cubre `Pregunta` (el banco único), sus dos bajas lógicas, las imágenes del enunciado y de las opciones, la detección de duplicados, el import desde Excel, y la clasificación del banco en `BaseConocimiento` / `NivelBase`.

**No cubre**: cómo se arma una evaluación con esas preguntas ([modulos.md](./modulos.md)) — el pivot `ModuloVersionPregunta`, el versionado y los criterios viven allá. Tampoco el `StorageService` que guarda el binario de una imagen ([infraestructura.md](./infraestructura.md)); acá va sólo qué significa esa imagen para una pregunta.

---

## El banco

### Banco único y reutilizable entre módulos

`Pregunta` **nunca se duplica**: se comparte entre módulos vía el pivot `ModuloVersionPregunta` (N a N). Una pregunta corregida o dada de baja lo está en todos lados a la vez, y las estadísticas por pregunta tienen una sola fila que mirar.

### Tipos de pregunta

`VERDADERO_FALSO` / `OPCION_MULTIPLE` / `OPCIONES_IMAGEN` mapean 1:1 a `truefalse` / `multiple` / `image-options`, los tipos que ya usaba el frontend. `TEXTO_LIBRE` está en el enum para uso futuro, **sin implementación**: no lo usa ningún módulo, y una pregunta sin `respuestaCorrecta` no se puede corregir sola ([sesiones.md](./sesiones.md#una-pregunta-sin-respuestacorrecta-se-rechaza-con-400)).

### Las preguntas no se editan: se activan y se desactivan

Regla de negocio deliberada, no una limitación pendiente. No hay endpoint de edición de contenido: para corregir un texto o una imagen se manda la pregunta a papelera y se crea una nueva.

El motivo de fondo es la inmutabilidad del historial: todas las versiones de un módulo comparten el mismo `preguntaId`, así que editar el contenido cambiaría **retroactivamente** lo que dicen versiones ya archivadas — justo lo que el versionado existe para evitar.

### Dos bajas lógicas distintas, y son ortogonales

| Flag | Alcance | Para qué |
|---|---|---|
| `ModuloVersionPregunta.activa` | **Por módulo** | El admin la maneja mientras arma un módulo puntual: sacarla de *este* módulo sin tocar los demás ni el banco |
| `Pregunta.activa` | **Global (papelera)** | "Esta pregunta ya no sirve en ningún lado" |

Se agregó el flag al pivot en vez de reusar el global justamente para que desactivar afecte sólo al módulo donde se hace.

Enviar a papelera **cascadea `activa=false`** a los pivots de esa pregunta en versiones BORRADOR y ACTIVO — **nunca ARCHIVADO**: esas versiones son inmutables y no deben mutarse aunque sea para dar de baja una pregunta (el cascade original pegaba sobre todos los pivots sin filtrar por versión; fue un bug).

**Recuperar de la papelera NO restaura los pivots**, y la asimetría es intencional: el sistema no puede adivinar en qué módulos el admin la quiere de vuelta.

Para que los dos ejes no queden inconsistentes, `ModulosService.setPreguntaActiva(id, true)` **rechaza con 409 si la pregunta sigue en papelera global**: si no, un admin podía "reactivar" el pivot de un módulo mientras el banco la seguía mostrando dada de baja. El backoffice lo refleja con un badge **"En papelera"** —distinto de "Inactiva"— y sin botón de Activar en las vistas por módulo.

### Detección de duplicados y similares: en memoria, no con `pg_trgm`

`src/import/similitud.ts` normaliza el texto en español (sin acentos ni puntuación) y compara por **coeficiente de Dice sobre trigramas de caracteres**, contra el banco completo y contra las filas del mismo archivo.

Se eligió sobre la extensión `pg_trgm` de Postgres —que era el TODO original— porque el proyecto es local-first sin deploy cloud activo, y atar la portabilidad a que el Postgres administrado permita `CREATE EXTENSION` no se justificaba a la escala del banco. Queda encapsulado en funciones puras, reemplazable por un índice en base el día que haga falta más escala.

Sólo corre en el **preview del import**: el alta directa (`POST /preguntas`) no la ejecuta.

### El import de preguntas tiene preview seleccionable fila por fila

A diferencia del import de nómina, que es todo-o-nada por fila: acá el preview clasifica cada fila (nueva / duplicada / parecida / error) y **el usuario elige con checkboxes cuáles confirmar**.

Es necesario porque *"parecida"* es una señal de alerta, no un error a descartar automáticamente: puede ser un duplicado real o dos preguntas legítimamente similares.

El confirm recibe esa selección como **JSON** (no vuelve a leer el Excel), con un `moduloId` de destino opcional.

---

## Imágenes de una pregunta

### La imagen de una pregunta ya creada no se reemplaza ni se borra

Es la misma regla que "las preguntas no se editan", con el mismo motivo de fondo: mutar `imagen` cambiaría retroactivamente versiones `ARCHIVADO` que deben seguir mostrando lo que se rindió. Para cambiarla: papelera + pregunta nueva.

El backend lo hace cumplir, no es sólo una convención: `DELETE /preguntas/imagen/:clave` responde **409** si alguna pregunta referencia la clave, y valida la forma exacta de la clave con una regex para no ser un borrado arbitrario de archivos.

Mandar una pregunta a papelera **no borra el archivo**: `setActiva(false)` es reversible.

### La subida va separada del alta (dos pasos)

`POST /preguntas/imagen` devuelve la clave, y `POST /preguntas` sigue siendo el mismo JSON de siempre con esa clave en `imagen`. Así el `CreatePreguntaDto` no cambió y el modal puede mostrar el preview antes de confirmar.

En el frontend el archivo **se queda en el browser hasta confirmar**: por eso quitar o cambiar la imagen antes de crear es estado local, y abrir y cerrar el modal no genera huérfanos. La única fuente de huérfanos es que el alta falle después de subir, y para eso el modal llama al `DELETE` en su catch —ignorando el error de limpieza para no tapar el del alta—.

### Las opciones de `OPCIONES_IMAGEN` también se suben

Antes eran rutas tipeadas a mano en el formulario: había que dejar el archivo en `public/` por fuera del sistema y escribir la ruta exacta. Ahora reusan el mismo endpoint y la misma carpeta `preguntas/` que el enunciado — son todas imágenes de preguntas, no hacía falta separarlas.

**La opción correcta se trackea guardando el `File`, no un índice ni un texto.** Cuando se elige cuál es la correcta las claves **todavía no existen**: se generan al subir, y la subida pasa recién al confirmar. Guardar la referencia al `File` evita además que la marca se desincronice al quitar o reemplazar un slot. Al guardar se traduce a clave tomando la que quedó en su misma posición del **array compactado**, así un hueco en el medio (`[A, vacío, C, D]`) no desalinea la respuesta correcta.

El `<select>` de respuesta correcta **no aplica a este tipo**: no hay texto que mostrar y con claves opacas el label sería `preguntas/<uuid>.png`, así que se elige tocando la miniatura, como en la app del alumno. Para `VERDADERO_FALSO` y `OPCION_MULTIPLE` el select queda igual.

### `validarOpciones` vive en el service, no en el DTO

Los tipos con opciones requieren ≥2, y `respuestaCorrecta` (opcional) tiene que ser **una de ellas**. Va en el service porque son reglas cruzadas entre campos, que class-validator no expresa.

Se agregó junto con las opciones-como-archivo por un motivo concreto: con textos legibles un desalineamiento se veía a simple vista, y con **claves opacas es invisible** — rompería la corrección de la evaluación sin que nadie lo note.

El import entra por el mismo `create()`, así que su preview adelanta la misma comprobación de membresía (junto al `opciones.length < 2` que ya tenía) para que la fila se marque como `error` y se pueda destildar, en vez de que el confirm falle a mitad de la importación.

### `imagenUrl()` centraliza la traducción clave → URL en el backoffice

Conviven **dos formatos**: la clave opaca de storage (se prefija con `${BASE_URL}/uploads/`) y las rutas relativas a `public/` que escribe el import de Excel (`/images/cartel.png`), que se usan tal cual. Por eso `BASE_URL` se exporta desde `client.js`.

El equivalente del lado de la tablet está en [tablet.md](./tablet.md#imágenes-como--clave-url--con-url-relativa).

---

## Clasificación: bases de conocimiento y niveles

Salió del pedido de clasificar las preguntas por tema y dificultad (*"Gestión de residuos - Básico"*). El diagnóstico que ordenó todo el diseño: los módulos reales (`SIMA Básico` / `Intermedio` / `Avanzado`) **ya eran el eje dificultad**, con el tema disuelto adentro — no era agregar metadata, era **separar dos ejes que estaban colapsados en uno**.

### `Etiqueta` se eliminó, no se extendió

Cumplía una función parecida pero como N a N de tags libres y opcionales, y estaba **muerta**: el seed no creaba ninguna, el import no asignaba y ningún frontend mandaba `etiquetaIds` — verificado con grep sobre los tres subproyectos y con `SELECT count(*)` sobre las dos tablas antes de dropearlas (0 filas).

Lo único que se perdió es el eje **nominal** (agrupar por subtema además de por nivel). Si reaparece, va una entidad nueva y deliberada, no revivir esa.

### La base NO se versiona: es taxonomía, no contenido

"Gestión de residuos" como materia es la misma en 2020 y en 2026; lo que cambia es **qué se considera correcto adentro**. Cuando sale un manual nuevo: papelera a las preguntas obsoletas, alta de las nuevas en la **misma** base, y versión nueva de los módulos que la evalúan — los dos mecanismos de versionado que ya existen alcanzan.

Se descartaron explícitamente dos alternativas:

- **Una base por manual** ("Gestión de Residuos 2026"): parte las estadísticas justo en el eje que se quiere medir.
- **Versionar la base**: obligaría a que los criterios de módulo apunten a una *versión* de base, con un pivot paralelo y tres entidades versionadas cruzándose.

El año o la revisión sale de `fuente`, **nunca del nombre**.

### El nivel es ordinal, y la escala es POR BASE

Por eso `NivelBase` es tabla y no enum: una base puede necesitar 3 niveles y otra 5. Un enum global impondría la misma escala a todas.

### La coherencia base↔nivel la garantiza la base de datos, no el service

`Pregunta` tiene **dos** FK: la simple a `BaseConocimiento`, y una **compuesta** `(nivelId, baseConocimientoId)` → `NivelBase(id, baseConocimientoId)`. Para eso existe el `@@unique([id, baseConocimientoId])` de `NivelBase`, que no es una unicidad de negocio sino el requisito de Postgres para poder referenciar esas columnas.

Se eligió sobre un `findFirst` previo en el service porque **un chequeo en memoria no sobrevive a dos altas concurrentes**. Prisma acepta que `baseConocimientoId` participe en las dos relaciones — se verificó con `prisma validate` y, sobre todo, en el SQL generado, que emite las dos FK sin descartar ninguna.

**Un CHECK escrito a mano tapa el agujero de MATCH SIMPLE.** Las FK compuestas de Postgres no se evalúan si *alguna* columna es NULL. Eso es deseado para `(base cargada, nivel NULL)` —"tema definido, dificultad pendiente" es un estado válido— pero dejaría pasar el inverso. De ahí `preguntas_nivel_requiere_base`: `CHECK (nivel_id IS NULL OR base_conocimiento_id IS NOT NULL)`, que **vive sólo en el SQL de la migración**; Prisma no lo conoce ni lo introspecta.

`ModuloVersionCriterio` tiene la misma FK compuesta pero **no** necesita este CHECK: ahí `baseConocimientoId` es NOT NULL, así que el caso "nivel sin base" no se puede dar.

Las tres constraints se verificaron con `INSERT` directo **antes de escribir el service**: nivel de otra base → rechazado por la FK compuesta; nivel sin base → rechazado por el CHECK; base sin nivel → aceptado.

**El rechazo se traduce a 400, no se deja salir como 500.** La FK llega como `PrismaClientKnownRequestError` con código `P2003`; el CHECK, en cambio, llega como `PrismaClientUnknownRequestError` **sin código de Prisma** (es un `23514` crudo de Postgres), así que se identifica por el nombre de la constraint. Se detectó porque la primera corrida de la verificación end-to-end devolvía 500 en los dos casos.

### `baseConocimientoId` es nullable en la base pero obligatorio en el formulario

El banco ya tenía preguntas cargadas y no hay forma de derivar la base del texto, así que un `NOT NULL` habría exigido inventar una base "sin clasificar" para todas.

El filtro `?sinBase=true` es lo que permite ir limpiando ese backlog.

### `Pregunta.fuente` se congela al crear

Se copia de la `fuente` de la base si el alta no trae una propia (`resolverFuente`). Sin esto, actualizar la fuente de la base al salir un manual nuevo haría que las preguntas viejas —las que ese manual dejó obsoletas— **pasen a citar el manual nuevo**.

Verificado end-to-end: cambiar la base a `Rev. 4` deja las preguntas previas en `Rev. 3` y sólo las nuevas toman la `Rev. 4`.

### Reordenar la escala reindexa TODO, en dos pasadas

El índice `(base_conocimiento_id, orden)` **no es diferible**, así que mover niveles de a uno lo viola a mitad de camino aunque estén en la misma transacción — mismo problema que el `principal` de [usuarios.md](./usuarios.md#principal-es-sólo-display-con-el-manejo-mínimo).

`PUT /:id/niveles/orden` recibe la escala completa y, en una transacción: (1) toda la escala a negativos, (2) cada nivel a su posición final. Los rangos de valores nunca se solapan, así que no hay colisión. Se eligió sobre el intercambio a tres UPDATEs porque ese sólo cubre *swaps* y se rompe al mover un nivel a una posición arbitraria. Confirmado contra Postgres que el enfoque ingenuo **sí** falla (`duplicate key value violates unique constraint`).

- ⚠️ **La pasada 1 va en `tx.$executeRaw`**: `orden = -orden - 1` referencia la propia columna, y el `data` de Prisma sólo acepta literales o sus operaciones atómicas (`increment`/`decrement`/`multiply`/`set`) — ninguna combinación lo expresa. La pasada 2 sí es Prisma normal.
- Por eso `PATCH /:id/niveles/:nivelId` **sólo renombra**: no hay una segunda vía para tocar `orden`.
- **`orden` es ordinal, NO contiguo, y eliminar un nivel deja un hueco a propósito.** Borrar el nivel del medio de `0,1,2` deja `0,2`: la unicidad se mantiene y el orden relativo no cambia, que es lo único que `orden` significa. `eliminarNivel` **no reindexa** porque renumerar en cada borrado costaría una transacción con SQL crudo para un beneficio cosmético; `reordenarNiveles` es lo único que renumera, y de paso normaliza los huecos. Consecuencia: `siguienteOrden` usa `max(orden) + 1`, así que borrar y agregar repetido hace subir los números sin que vuelvan a bajar. **Hay un spec que fija esta decisión para que no se "arregle" sola.**

### El import de Excel no necesitó cambios para la clasificación

`ConfirmarImportPreguntasDto.preguntas` es `CreatePreguntaDto[]` y el confirm pasa cada fila entera a `PreguntasService.create`, así que la clasificación **viaja dentro de cada pregunta** en vez de ser un campo suelto del body. El modal estampa la base y el nivel elegidos en cada fila, y el backend autocompleta la `fuente`.

---

## Frontend

### La pantalla de Preguntas alterna entre vista global y vista por módulo

Con **exactamente un módulo real** seleccionado, sin papelera ni búsqueda, se muestra la vista por módulo (sus pivots, con Activar/Desactivar por fila). En cualquier otro caso —0 o 2+ módulos, papelera, o con texto buscado— se muestra la vista global contra `GET /preguntas`, con una columna de a qué módulos está asignada cada una.

El buscador de texto es **universal**: cuando hay texto escrito siempre gana la vista global, para no tener que replicar la búsqueda en el camino por módulo. Elegir una base **fuerza la vista global** por el mismo criterio, y además porque la vista por módulo lista pivots y no sabe filtrar por clasificación.

El filtro de módulo es un multi-select con búsqueda (`MultiSelectFilter`) y no un `<select>` único, con una opción sintética "Sin asignar" que no es un id real sino que se traduce a `?sinAsignar=true`.

### La columna "Módulos" muestra uno solo, y el orden lo decide el CLIENTE

Pintaba un badge por cada módulo al que la pregunta está asignada. Como una pregunta del banco se comparte entre módulos —que es el punto de que el banco sea único—, la celda se desbordaba apenas una pregunta entraba en tres o cuatro. Ahora muestra **el primero más un chip `+N`** que despliega el resto dentro de la fila: el mismo patrón (y el mismo chip `+N`/`−`) que los pares adicionales de la tabla de Usuarios, para no inventar un segundo lenguaje para el mismo problema.

**El orden hay que fijarlo en el cliente, y no es un capricho.** El `findMany` de los pivots en `PreguntasService` **no lleva `orderBy`**, así que el array `modulos` sale en el orden que devuelva Postgres y puede cambiar entre dos requests. Con todos los badges a la vista eso era invisible; mostrando **uno solo**, haría que cambie *cuál* es el módulo visible entre dos cargas de la misma pantalla. `ordenarModulos()` ordena **activas primero y después por nombre**.

El criterio "activas primero" es lo que evita la lectura al revés: un módulo donde la pregunta está desactivada se pinta **tachado**, y si quedara como la única cara visible con el `+N` escondiendo los activos, la fila diría casi lo contrario de la verdad.

Lo que la columna **no** hace es mostrar "el módulo al que se asignó primero": `ModuloVersionPregunta` no tiene ningún timestamp — son `orden` (la posición de la pregunta *dentro* del módulo, que no sirve acá), `obligatoria`, `activa` y `origen`. Ese dato no existe, y fabricarlo era una migración con backfill inventado para todos los pivots ya cargados.

La tabla pasa a llevar `alignTop`, por el mismo motivo que la de Usuarios: la celda de Módulos crece al desplegar y sin eso el resto de la fila se centra contra la celda alta.

### Los filtros de base y nivel son `<select>` encadenados, no multi-select

A diferencia del de módulos, y por dos motivos: `?baseId=` es único, y sobre todo **un nivel sólo existe dentro de una base** — con varias bases tildadas, el filtro de nivel no significaría nada. Incluye la opción sintética "— Sin clasificar —" (`?sinBase=true`), que es cómo se encuentra el backlog previo a las bases.

Mismo patrón en el formulario de alta (la base es obligatoria, el nivel opcional y dependiente, y se limpia al cambiar de base) y en el panel de criterios de un módulo.

### Enviar a papelera pide confirmación; recuperar no

El modal lista los módulos donde la pregunta está activa, con badge de estado de cada uno, y avisa en rojo si es **la última pregunta activa** de alguno (`totalActivasEnModulo === 1`, calculado en el backend). Si no está asignada activamente a ningún módulo, se manda a papelera directo sin modal.

Recuperar sigue siendo instantáneo: es la operación reversible y de bajo riesgo.

### La pantalla de Bases es un acordeón, no una tabla

Cada base es una fila colapsable con su escala editable adentro (agregar, renombrar inline, subir/bajar con ▲▼, eliminar). El layout anidado no encaja en columnas — mismo motivo que la pantalla de Reglas.

Reordenar **manda siempre la escala completa**, nunca un movimiento puntual, porque es lo que el endpoint exige. Eliminar un nivel con preguntas se bloquea en el cliente con un aviso y en el backend con 409. Al crear una base se despliega sola: sin niveles todavía no sirve para clasificar.
