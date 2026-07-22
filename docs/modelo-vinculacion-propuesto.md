# Modelo de Vinculación — diseño final

> **Estado: IMPLEMENTADO.** La migración `20260720152141_modelo_vinculacion` está
> aplicada y el backend ya trabaja con este modelo: `UsuariosService` crea/edita
> la vinculación y sus pares anidados en `/usuarios`, la matriz
> tipo-de-organización ↔ rol vive en `src/usuarios/matriz-rol-organizacion.ts` y
> la comparten el alta manual y el import de Excel, y `GET /usuarios` devuelve el
> rol anidado en `vinculacion` + el par principal (filtros `?organizacionId=`,
> `?rol=`, `?puestoId=`, `?centroCostoId=`). Este documento queda como el
> **porqué** de las decisiones; el estado operativo del código está en
> `sima-training-api/README.md` (Sprint 5) y en `CLAUDE.md`.
>
> Lo único pendiente son los **frontends**, que todavía consumen la forma vieja
> (rol plano en `Usuario`, clasificación), y el ABM de pares en el form de Usuario.
>
> **Revisión de Informática — un cambio sobre el diseño original:** una persona
> puede estar en **más de un centro de costo**. El centro de costo salió de
> `Vinculacion`, sí, pero **apareado con el puesto** en una sola tabla hija
> (`VinculacionPuestoCentro`), no como eje independiente: la capacitación
> obligatoria depende del **par** (ver §1.1). El resto del diseño se aprobó tal
> cual.

## 1. De dónde partimos

Hoy (`prisma/schema.prisma`, Sprint 1–4) toda la información de pertenencia
vive plana en `Usuario`:

```prisma
model Usuario {
  rol            RolUsuario           @default(COORDINADOR)  // ADMINISTRADOR | COORDINADOR | ALUMNO
  clasificacion  ClasificacionAlumno?                        // SIMA | CLIENTE | SUBCONTRATISTA | INVITADO, solo si rol = ALUMNO
  organizacionId Int?
}
```

No existe el concepto de **puesto** ni de **centro de costo** vinculados al
usuario — los catálogos (`Puesto`, `CentroCosto`) ya se implementaron en una
sesión previa (ver §2.2), pero todavía no tienen ninguna FK desde `Usuario`
ni desde ninguna otra tabla.

### Reglas de negocio a modelar (dadas, no se discuten)

1. Un usuario está vinculado a **una sola** organización.
2. Un usuario puede tener **varios puestos** y estar en **varios centros de
   costo**.
3. **Puesto** y **centro de costo** viven en la vinculación, no en `Usuario`, y
   van **siempre juntos, como par**: una persona puede tener varios pares
   (puesto, centro), y uno de ellos es el **principal** (ver §1.1).
4. El **rol** se mueve de `Usuario` a la vinculación.
5. La **clasificación** (SIMA/CLIENTE/SUBCONTRATISTA/INVITADO) se **elimina
   como concepto**. La pertenencia de una persona — si es interna, de un
   cliente, de un subcontratista, y para quién trabaja en ese último caso —
   se **deriva** de su organización (`Organizacion.tipo` + la cadena de
   `organizacionPadreId`), no se persiste ni en `Usuario` ni en `Vinculacion`.
6. Matriz **tipo-de-organización ↔ rol** permitida (se valida contra
   `Organizacion.tipo` de la organización de la vinculación, no contra una
   columna propia):

   | Tipo de organización | Roles permitidos |
   |---|---|
   | `INTERNA` | `ALUMNO`, `COORDINADOR`, `AUDITOR`, `ADMINISTRADOR` |
   | `CLIENTE` | `AUDITOR` |
   | `SUBCONTRATISTA` | `ALUMNO` |

   `INVITADO` ya no es una fila de esta matriz — queda fuera de esta
   propuesta (ver §5).

> **Jerarquía de organizaciones.** SIMA tiene clientes; tanto SIMA como sus
> clientes pueden contratar subcontratistas. Un subcontratista es **siempre**
> una `Organizacion` con nombre propio, `tipo = SUBCONTRATISTA`, cuyo
> `organizacionPadreId` apunta a quien lo contrató. "Para quién trabaja" un
> subcontratista se resuelve recorriendo esa cadena de padres — no lo
> resuelve la matriz de arriba, que solo mira `tipo`.

### 1.1 Decisión: puesto y centro de costo van apareados

> **Corrección sobre la versión anterior de este documento**, que modelaba puesto
> y centro de costo como **ejes independientes** — dos pivotes en paralelo
> (`VinculacionPuesto` + `VinculacionCentroCosto`), cada uno con su lista, sin
> guardar el pareo. Eso está mal para el dominio y **se revierte**: los dos
> pivotes se eliminan y los reemplaza una única tabla de pares,
> `VinculacionPuestoCentro`.
>
> **Por qué.** La capacitación obligatoria depende del **par**, no de cada eje por
> separado: *"Soldador en YPF"* y *"Soldador en PAE"* son casos distintos, con
> requisitos distintos. Con dos listas sueltas el modelo no puede distinguirlos —
> alguien con puestos {Soldador, Amolador} y centros {YPF, PAE} se leía como
> habilitado para cualquier combinación, y la regla de asignación lo incluía
> aunque en la realidad soldara solo en uno de los dos. Esa sobre-inclusión estaba
> asumida y documentada como limitación aceptada; con la regla de asignación
> colgando del par, deja de ser aceptable.

Sigue siendo cierto que una persona puede estar en más de un centro de costo y
tener más de un puesto — lo que cambia es **cómo se guarda**:

- `Vinculacion` queda con lo que sí es único por persona: **organización y rol**.
  No tiene ni `puestoId` ni `centroCostoId`.
- `VinculacionPuestoCentro` guarda **un par completo por fila**: los tres campos
  de su PK (`vinculacionId`, `puestoId`, `centroCostoId`) son `NOT NULL`. Nunca
  hay un puesto sin centro ni un centro sin puesto.
- **El mismo puesto en distintos centros SÍ es una fila propia por centro** —
  ésta es la corrección concreta respecto del modelo de ejes independientes, donde
  ese caso no generaba ninguna fila extra. Soldador en YPF y Soldador en PAE son
  dos filas.
- El flag **`principal` es de un par**, no de un puesto: marca qué combinación
  (puesto, centro) se muestra en listados. Exactamente **uno por vinculación**,
  garantizado en la base con un índice único **parcial** (ver §3.1).
- La regla de asignación ("asignar el módulo X a todos los del centro de costo Y
  con puesto Z") pasa a ser un join de **dos** tablas —
  `VinculacionPuestoCentro` filtrando por el par exacto → `Vinculacion` — y es
  **exacta**: ya no hay sobre-inclusión que aclarar.

---

## 2. Cambios comunes

### 2.1 Enums y `Usuario` como identidad pura

```prisma
enum RolUsuario {
  ADMINISTRADOR
  COORDINADOR
  AUDITOR        // ← nuevo
  ALUMNO
}
```

No hay enum `Clasificacion`: la pertenencia se lee de `Organizacion.tipo`
(ya existente), no se agrega ningún enum nuevo para reemplazarlo.

En `Usuario` se **elimina** `rol` (se va a `Vinculacion`).
Lo que queda en `Usuario` es identidad pura: `nombre`, `apellido`, `dni`,
`email`, `datos`, trazabilidad y `deletedAt`. `organizacionId` también se
elimina de `Usuario` — se mueve a `Vinculacion` (ver §3.1), porque ahí es
donde vive el resto de la pertenencia y no tiene sentido partir el vínculo
entre dos tablas.

### 2.2 Catálogos de Puesto y CentroCosto — ya implementados

La discusión "string libre vs. catálogo" está resuelta: se eligió **catálogo**
y ya se implementó en una sesión anterior a este documento (`src/puestos/`,
`src/centros-costo/`, migración `20260720123709_add_puesto_centro_costo`).
Schema actual, sin cambios pendientes:

```prisma
model Puesto {
  id     String  @id @default(uuid())
  nombre String  @unique
  activo Boolean @default(true)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")
  createdBy String?  @map("created_by")

  @@map("puestos")
}

model CentroCosto {
  id     String  @id @default(uuid())
  nombre String  @unique
  activo Boolean @default(true)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")
  createdBy String?  @map("created_by")

  @@map("centros_costo")
}
```

> ⚠️ Los dos `id` son `String` **sin `@db.Uuid`** (versiones anteriores de este
> documento lo mostraban con `@db.Uuid`, y era un error). En la base son
> columnas **`TEXT`**, no `uuid` — ver
> `migrations/20260720123709_add_puesto_centro_costo/migration.sql`. Por eso las
> FK que apuntan a estos catálogos (`VinculacionPuestoCentro.puestoId` y
> `VinculacionPuestoCentro.centroCostoId`) también son `String` plano: con
> `@db.Uuid` no matchearían el tipo de la columna referenciada.

Ninguno de los dos tiene todavía una FK entrante — eso es exactamente lo que
agregan `Vinculacion` / `VinculacionPuestoCentro` en §3.

---

## 3. Modelo elegido: `Vinculacion` + `VinculacionPuestoCentro`

`Vinculacion` es el vínculo persona ↔ organización: **una por usuario**, y ahí
viven organización y rol. Los pares (puesto, centro de costo) son filas hijas de
**una sola** tabla — no dos tablas independientes, ver §1.1.

### 3.1 Schema

```prisma
model Vinculacion {
  id Int @id @default(autoincrement())

  // 1 a 1 con Usuario: el unique es la regla "una sola organización" en el schema.
  usuarioId Int     @unique @map("usuario_id")
  usuario   Usuario @relation(fields: [usuarioId], references: [id])

  organizacionId Int          @map("organizacion_id")
  organizacion   Organizacion @relation(fields: [organizacionId], references: [id])

  rol RolUsuario

  // Un solo eje repetido: el par (puesto, centro), nunca uno sin el otro (§1.1).
  puestosCentros VinculacionPuestoCentro[]

  activa Boolean @default(true)

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt      @map("updated_at")
  createdBy String?   @map("created_by")
  updatedBy String?   @map("updated_by")
  deletedAt DateTime? @map("deleted_at")

  @@map("vinculaciones")
}

// Un par (puesto, centro de costo) que la persona ejerce dentro de su vinculación.
// Reemplaza a VinculacionPuesto + VinculacionCentroCosto (§1.1).
model VinculacionPuestoCentro {
  vinculacionId Int    @map("vinculacion_id")
  puestoId      String @map("puesto_id")
  centroCostoId String @map("centro_costo_id")

  vinculacion Vinculacion @relation(fields: [vinculacionId], references: [id])
  puesto      Puesto      @relation(fields: [puestoId],      references: [id])
  centroCosto CentroCosto @relation(fields: [centroCostoId], references: [id])

  // Cuál par se muestra como "el" puesto/centro del usuario en listados/tablas.
  principal Boolean @default(false)
  activo    Boolean @default(true)

  createdAt DateTime @default(now()) @map("created_at")
  createdBy String?  @map("created_by")

  @@id([vinculacionId, puestoId, centroCostoId])
  // Los dos sentidos de la regla de asignación (map explícito: ver nota abajo).
  @@index([puestoId, centroCostoId, vinculacionId], map: "vinculacion_puesto_centro_puesto_centro_idx")
  @@index([centroCostoId, puestoId, vinculacionId], map: "vinculacion_puesto_centro_centro_puesto_idx")
  @@map("vinculacion_puesto_centro")
}
```

Notas sobre el PK y los índices, para que quien implemente no tenga que
redescubrirlos:

- `@@id([vinculacionId, puestoId, centroCostoId])`, los tres `NOT NULL` — el par
  es la unidad. Esto responde la vieja pregunta de "¿puede el mismo puesto
  repetirse en dos centros de costo?": **sí, y ahora es una fila propia por
  centro** (Soldador+YPF y Soldador+PAE son dos filas). Es exactamente lo que el
  modelo de ejes independientes no podía expresar.
- La regla de asignación ("módulo X a todos los del centro de costo Y con
  puesto Z") es un join de **dos** tablas: `VinculacionPuestoCentro` filtrado por
  el par `(puestoId, centroCostoId)` → `Vinculacion` (lookup por PK). Y es
  **exacta**: devuelve gente que ejerce Z **dentro de** Y, no gente que tiene Z y
  además está en Y por otro lado. La sobre-inclusión que documentaba la versión
  anterior de este documento desaparece con el par.
- **Dos índices invertidos** porque la regla se consulta desde los dos ejes
  (`[puestoId, centroCostoId, …]` y `[centroCostoId, puestoId, …]`): cualquiera de
  los dos extremos entra por índice, sin table scan. El `map:` explícito **no es
  opcional**: el nombre autogenerado por Prisma
  (`vinculacion_puesto_centro_puesto_id_centro_costo_id_vinculacion_id_idx`) tiene
  70 caracteres y pasa el límite de 63 de Postgres, que lo truncaría en silencio.
- **`principal` es de un par, y se garantiza en la base con un índice único
  PARCIAL**, que vive solo en la migración:

  ```sql
  CREATE UNIQUE INDEX "vinculacion_puesto_centro_principal_unico"
    ON "vinculacion_puesto_centro"("vinculacion_id") WHERE "principal" AND "activo";
  ```

  No alcanza un unique común: sobre `(vinculacion_id)` prohibiría tener más de un
  par, y sobre `(vinculacion_id, principal)` dejaría pasar N filas con
  `principal = false`.

  El `WHERE` filtra **por `principal` y por `activo`**: sin la segunda condición,
  un par con `principal = true` y `activo = false` — un *principal fantasma*, un
  estado que no debería poder existir — seguía ocupando el único lugar disponible y
  **bloqueaba promover otro par a principal**. Con el índice así, desactivar el par
  principal libera el lugar y otro par activo puede tomarlo.

  Prisma **no soporta `WHERE` en `@@unique`**, así que este índice no se refleja en
  `schema.prisma`. Tampoco lo introspecta: le es **completamente invisible**, en los
  dos sentidos. Por eso `migrate diff` dice *in sync* — no reporta drift — y el
  índice convive sin ruido. **OJO**: por lo mismo, no se recrea solo. Un `db push`
  sobre una base limpia, o cualquier regeneración de la tabla que no pase por las
  migraciones, la deja sin el índice: vive únicamente en el archivo de migración
  `20260720152141_modelo_vinculacion`.

### 3.2 Por qué este modelo y no uno con una fila por puesto

De las reglas dadas, dos son invariantes **por usuario** (una organización, un
rol) y una se **repite**: el par (puesto, centro de costo). Este modelo tiene
exactamente esa forma: una fila para lo que es único, una tabla hija para lo que
se repite.

- **Los invariantes son estructurales.** `usuarioId @unique` en `Vinculacion`
  *es* la regla "una sola organización (y un solo rol) por usuario", verificada
  por Postgres — no por disciplina en el service. Puesto y centro de costo **no
  están en este grupo**: dejaron de ser invariantes cuando se aprobó que una
  persona puede tener varios de cada uno (§1.1), y por eso se fueron juntos a la
  tabla hija.
- **La matriz tipo-de-organización ↔ rol se valida una vez, en un solo
  lugar**: `MATRIZ[organizacion.tipo].includes(rol)` en el `create`/`update`
  de `VinculacionesService` (requiere traer el `tipo` de la organización
  relacionada, no está en la misma fila). A diferencia de una matriz sobre
  una columna propia, acá **no hay check constraint posible** sin un trigger
  — la validación cruza tablas y queda solo a nivel service.
- **ABM directo**: el form de Usuario mantiene organización + rol como campos
  únicos, y suma **una** sub-tabla repetidora de pares: cada fila es un puesto +
  un centro elegidos juntos, con un radio para marcar cuál es el principal. Es una
  grilla, no dos multi-selects sueltos — la diferencia con el modelo de ejes
  independientes también se nota acá.
- **Listados**: Rol / Organización salen de un join simple 1-a-1 (la pertenencia
  SIMA/CLIENTE/SUBCONTRATISTA se lee de `organizacion.tipo`, ya incluido en ese
  mismo join). Puesto y Centro de costo se colapsan al **par principal** — una
  sola fila a mostrar, sin tener que elegir entre listas de distinto largo (o "N
  pares" / un badge extra si hay más de uno y hace falta indicarlo).
- **Limitación conocida y aceptada**: un solo rol por usuario. Si mañana
  alguien necesita rol distinto por puesto, ver más abajo el camino de
  migración — es mecánico (mover `rol` de `Vinculacion` a
  `VinculacionPuestoCentro`, cada par arranca con el rol que el usuario ya
  tenía), no bloqueante para este diseño.

---

## 4. Migración de datos

### 4.1 Limpieza previa — correr antes de migrar, no durante

**Violaciones preexistentes de la matriz.** Correr esta query y resolver cada
fila a mano (cambiar de organización o cambiar de rol) antes de tocar el schema:

```sql
SELECT u.id, u.dni, u.rol, o.tipo
FROM usuarios u JOIN organizaciones o ON o.id = u.organizacion_id
WHERE u.deleted_at IS NULL
  AND NOT (o.tipo = 'INTERNA')                                   -- SIMA: todo permitido
  AND NOT (o.tipo = 'SUBCONTRATISTA' AND u.rol::text = 'ALUMNO')
  AND NOT (o.tipo = 'CLIENTE'        AND u.rol::text = 'AUDITOR');
```

> El `::text` no es cosmético: esta query se corre **antes** de migrar, y
> `'AUDITOR'` todavía no es un valor del enum `RolUsuario` — lo agrega esta misma
> migración. Sin el cast, Postgres intenta resolver el literal contra el enum viejo
> y falla con `invalid input value for enum RolUsuario: "AUDITOR"`.

Todo `COORDINADOR` que hoy exista en una organización `CLIENTE` cae acá: la
matriz nueva no lo admite (`CLIENTE` sólo puede ser `AUDITOR`). Son casos a
resolver a mano — mover la organización a una `INTERNA` o convertir el rol a
`AUDITOR` —, no algo que la migración pueda decidir sola.

**Usuarios sin `organizacionId`** — hoy es nullable. Si hay alguno, decidir
antes de migrar: asignarlos a *Ingeniería SIMA* o dejarlos sin vinculación
(usuario huérfano, no puede operar). La migración de abajo asume que ya no
quedan (el `JOIN` con `organizaciones` los descarta silenciosamente si no se
resuelve primero).

### 4.2 SQL

```sql
-- 1. Una vinculación por usuario vivo. Copia 1-a-1 de la tabla usuarios. El JOIN
--    con organizaciones no aporta columnas acá (ya no hay clasificacion que
--    derivar de o.tipo): se mantiene solo para descartar usuarios huérfanos
--    sin organizacion_id, como ya advertía §4.1.
INSERT INTO vinculaciones (usuario_id, organizacion_id, rol, activa, created_by)
SELECT u.id,
       u.organizacion_id,
       u.rol,
       true, 'migracion-vinculacion'
FROM usuarios u
JOIN organizaciones o ON o.id = u.organizacion_id
WHERE u.deleted_at IS NULL;

-- 2. vinculacion_puesto_centro arranca VACÍA, a propósito. Sin placeholder
--    'Sin asignar' — ver la nota de abajo.

-- 3. Recién después: DROP de usuarios.rol / usuarios.organizacion_id.
```

El paso 1 es una copia 1-a-1 de la tabla `usuarios`: no hay que decidir nada
fila por fila, y si algo sale mal el rollback es truncar las tablas nuevas y
volver a poner las dos columnas en `Usuario`.

**Por qué no hay placeholder `'Sin asignar'`.** Las versiones anteriores de este
documento insertaban un puesto placeholder y una fila por vinculación, para no
dejar ninguna sin puesto. Con el par eso ya no se sostiene:

- El modelo viejo **nunca tuvo** puesto ni centro de costo en `usuarios` (los
  catálogos se crearon sin ninguna FK entrante, §2.2). No hay ningún par real que
  backfillear: el "puesto principal" de antes era el propio placeholder, no un
  dato de nómina.
- Un par siempre viene completo, así que mantener el placeholder exigiría inventar
  **dos** filas de catálogo (un puesto y un centro `'Sin asignar'`) y marcar ese
  par fabricado como `principal = true` — que es justo el par contra el que
  matchea la regla de asignación. Con ejes independientes un puesto suelto era
  ruido inofensivo; con el par es un **match espurio**.
- Cero pares es una cardinalidad válida del pivote (el mismo razonamiento con el
  que ya se dejaba vacía `vinculacion_centros_costo`), y la base de dev no tiene
  usuarios vivos, así que el backfill no produciría ninguna fila igual.

Los pares se cargan de verdad cuando exista el ABM, sin dejar placeholders que
limpiar después.

---

## 5. Preguntas abiertas que quedan

1. ~~**¿Qué se hace con los usuarios que hoy violan la matriz?**~~ (§4.1) —
   **resuelto**: al migrar no había ningún usuario vivo en la base, así que no
   hubo nada que limpiar. De acá en adelante la matriz se valida en el alta y en
   el import, así que no pueden aparecer violaciones nuevas por esas vías.
2. **`INVITADO` con acceso de única vez** — queda **completamente fuera** de
   esta propuesta: no es un `Organizacion.tipo` ni tiene fila en la matriz
   tipo-de-organización ↔ rol (§1). Se modela más adelante como un estado de
   acceso de única vez sobre la persona o la vinculación — ¿un campo en
   `Vinculacion`, o una entidad aparte tipo `AccesoTemporal` con vencimiento?
   — a definir cuando se implemente. No bloquea la migración de vinculación
   en sí.
