# Mejoras — auditoría de TRAINING

> Análisis del **2026-08-04** sobre `develop` (`2cdae7a`), con la evidencia de cada punto.
>
> **Sesión 1 aplicada** (2026-08-04): se resolvieron los ítems 1.1, 1.2, 1.3 y 1.5 — las tres afirmaciones falsas del README del backend, las secciones de decisiones de los Sprints 6 y 7 con su tabla de endpoints, los árboles de archivos desactualizados y el rename de `modelo-vinculacion-propuesto.md`.
>
> **Sesión 2 aplicada** (2026-08-04): se resolvió toda la sección 2 (código muerto) — archivos sin consumidor, símbolos exportados sin caller, devDependencies sin uso, scripts npm rotos, la sección vacía del sidebar y los artefactos huérfanos de `samples/`/`scripts/`. Cada ítem se re-verificó con grep propio antes de tocarlo (algunos archivos se habían movido desde el análisis original).
>
> **Sesión 3 aplicada** (2026-08-04): tooling y CI (4.1, 4.2, 4.5). El lint del backend dejó de correr con `--fix` (sacaba 0 siempre, no podía fallar el CI) — se formateó primero el árbol completo en un commit `style:` aparte y recién después se sacó el flag; se agregó `lint:fix` y `format:check` como pares explícitos. Se sumó el job de CI para `sima-check-app`, que no se linteaba ni buildeaba nunca. Se resolvió el único warning de lint de los dos frontends (`BancoPreguntas.jsx`). Y, a pedido del usuario, los dos frontends pasaron a lintear con `--max-warnings 0` para que un warning nuevo no vuelva a colarse en silencio. Lo que sigue abierto es todo lo de acá abajo.
>
> Distinto de [`pendientes.md`](pendientes.md): ese registra **features que faltan**; esto registra **lo que ya está y sobra, está mal documentado o se puede simplificar**. Cuando un ítem se resuelve, se borra de acá (queda en el historial de git).

## Veredicto general

El proyecto está **sano**. Los 199 tests pasan, el lint de los dos frontends está limpio (0 warnings), no hay `console.log` olvidados, hay **un solo `TODO`** en todo el código y está registrado en `pendientes.md`. El schema de Prisma y los services están comentados a un nivel poco común — las decisiones no triviales (índices parciales, FK compuestas, MATCH SIMPLE, staging vs. guardado directo) están explicadas donde viven.

Lo que encontré se agrupó en tres frentes, en orden de impacto:

1. ~~**Documentación desactualizada**~~ — **resuelto en la sesión 1.** Era el problema más caro (el README del backend afirmaba cosas que el código contradecía). Lo único que queda del frente es el tamaño de `CLAUDE.md`, que es una decisión y no una tarea.
2. ~~**Código muerto**~~ — **resuelto en la sesión 2.**
3. **Estructura** — tres archivos de más de 850 líneas y dos pares de archivos casi idénticos.

---

## 1. Documentación

### 1.4 `CLAUDE.md` — exacto en el contenido, pero se pasó de tamaño

Verifiqué unos veinte enunciados no obvios contra el código (índices parciales, staging de `TrainingModules.jsx`, `versionParaEditar` vs. `ultimaOActivaVersion`, el UPSERT de criterios, la matriz rol↔organización, el orden de borrado del seed) y **todos son correctos**. Ese es el activo principal del proyecto y hay que cuidarlo.

El problema real es el **tamaño**: 129 KB que se cargan en cada sesión.

| Sección | Bytes | % |
|---|---:|---:|
| `## Decisiones de arquitectura` (Sprints 1-7) | 59.383 | 46 % |
| `## Backend — sima-training-api` | 26.823 | 21 % |
| `## Backoffice — pantallas y navegación` | 23.151 | 18 % |
| Todo lo demás (11 secciones) | ~19.000 | 15 % |

Las dos primeras son, en buena medida, **el mismo material que las "Decisiones de diseño" del README del backend**, contado más largo. Y la tercera tiene celdas de tabla de 3.000+ caracteres (la fila "Módulos" del tab bar es un párrafo corrido) que no se pueden escanear.

**Propuesta:** mover el historial por sprint a `docs/decisiones/sprint-N.md` (uno por sprint) y dejar en `CLAUDE.md` un índice de una o dos líneas por sprint que enlace. Eso lo baja a ~40 KB manteniendo el mismo contenido.

Ojo que la sesión 1 **agrandó** la duplicación en vez de reducirla: para que el README del backend dejara de mentir hubo que escribirle las decisiones de los Sprints 6 y 7, que ya estaban en `CLAUDE.md`. Fue lo correcto —un README que miente es peor que uno redundante— pero deja dos copias más para mantener sincronizadas, y es exactamente el mecanismo que produjo el problema que acabamos de arreglar. Si se hace el split, la regla que lo previene es que las decisiones vivan **en un solo lugar** (`docs/decisiones/`) y que `CLAUDE.md` y los READMEs enlacen en vez de copiar.

**No hacer** el split sin decidir antes qué queda en `CLAUDE.md`: lo que se lee en cada sesión (modelo de entidades, endpoints, convenciones, gotchas) tiene que quedar, y lo que es arqueología ("esto se revirtió en el Sprint 5") se puede mover.

---

## 3. Estructura

### 3.1 Lo que está bien y no hay que tocar

- La separación `core/` ↔ `sima-check/` con la regla de dependencia unidireccional está **respetada** en todo el código (`ReglasAsignacion.jsx` era la única excepción y ya se movió).
- El monolito modular por dominio del backend es consistente: cada entidad es un módulo Nest con su controller/service/dto, sin lógica transversal.
- La capa `core/api/` como único punto de contacto HTTP está bien aislada. Ningún componente hace `fetch` por su cuenta.
- Los ejes de baja lógica (`activo` vs. `deletedAt` vs. `revocadaAt` vs. papelera) están bien diferenciados y bien explicados.
- El `StorageService` abstracto es la decisión correcta y está bien acotada.

### 3.2 Tres archivos que superaron su tamaño útil

| Archivo | Líneas | El problema |
|---|---:|---|
| `sima-check/pages/TrainingModules.jsx` | 1.098 | **Tres vistas en un componente**: tabla de módulos, historial de versiones y editor de contenido, conmutadas por estado. Más el staging (`localAsignadas`/`flushCambios`), más 6 modales. Los comentarios `// --- Vista: … ---` (líneas 504, 809, 854) ya marcan los cortes naturales |
| `sima-check/components/BancoPreguntas.jsx` | 1.036 | 6 componentes exportados + 6 internos. **`NuevaPreguntaModal` sola son 462 líneas** (483-945): formulario, subida de imagen del enunciado, 4 slots uploader para `OPCIONES_IMAGEN`, selects encadenados de base/nivel y multi-select de módulos |
| `sima-check/pages/ReglasAsignacion.jsx` | 890 | **Un solo componente** con 12 `useState` y 8 `useMemo`, que hace el acordeón de dos niveles, el modal de alta/edición con diff, el modal de eliminar y el banner de recálculo |

Ninguno está *mal escrito* — la lógica es correcta y está comentada. El costo es de navegación: cualquier cambio obliga a cargar el archivo entero.

**Propuesta mínima, en este orden:**

1. `BancoPreguntas.jsx` → partir en `BancoPreguntas/` con un archivo por modal (`NuevaPreguntaModal.jsx`, `AsignarPreguntaModal.jsx`, `EditarModulosModal.jsx`) + `PreguntasAsignadasPanel.jsx` + `index.js` que re-exporte. **Es el corte más barato**: los seis son ya componentes independientes con props explícitas, no comparten estado. Cero riesgo.
2. `TrainingModules.jsx` → extraer la vista de historial (`809-853`, es la más chica y autocontenida) y la vista de contenido (`504-808`) a `sima-check/components/`. El staging se queda en la página, que es donde tiene que estar.
3. `ReglasAsignacion.jsx` → extraer el acordeón (`AcordeonCentros`) y el modal de alta/edición. Es el más entreverado de los tres; dejarlo para el final.

### 3.3 Dos pares de archivos casi idénticos

**`Puestos.jsx` y `CentrosCosto.jsx`** (171 líneas cada uno) son el mismo componente con los nombres cambiados. Lo verifiqué normalizando los identificadores:

```bash
diff <(sed 's/[Pp]uesto/XX/g' src/core/pages/Puestos.jsx) \
     <(sed 's/[Cc]entroCosto/XX/g;s/[Cc]entrosCosto/XX/g' src/core/pages/CentrosCosto.jsx)
```

→ las **únicas** diferencias son el nombre del api client y tres literales de texto ("Puestos" / "Centros de Costo", el plural del contador). Un `CatalogoSimplePage.jsx` parametrizado por `{ api, titulo, singular, plural }` deja las dos páginas en ~10 líneas cada una: **~150 líneas menos**, y arreglar un bug en el ABM pasa a ser un solo lugar.

**En el backend pasa lo mismo** con `puestos.service.ts`/`centros-costo.service.ts` y sus controllers (mismo diff, mismas diferencias triviales), pero ahí **recomiendo no tocarlo**: son ~110 líneas totales, una clase base genérica en Nest cuesta más en legibilidad de lo que ahorra, y la convención "un módulo explícito por entidad" es lo que hace predecible el resto del backend. La duplicación del frontend sí vale la pena porque son 342 líneas de JSX.

### 3.4 Los cuatro READMEs se pisan

`README.md` (raíz), `sima-training-api/README.md`, `sima-training-backoffice/README.md` y `sima-check-app/README.md` repiten entre sí: el bloque "Cómo correr", el árbol de archivos, la paleta de colores, el flujo de la app tablet y la tabla de qué está mockeado. `CLAUDE.md` repite las cinco cosas otra vez.

Eso es exactamente por qué el de la raíz quedó con `etiquetas/` (ver 1.3): hay cinco lugares donde actualizar la misma cosa y sólo se actualizan los que se están mirando.

**Propuesta:** dejar el README de la raíz como **portada + índice** (qué es, los tres proyectos, cómo levantar todo, y enlaces), y que el detalle de cada subproyecto viva **sólo** en su propio README. Concretamente sacar de la raíz el árbol de archivos completo, la paleta y el flujo de la tablet, que ya están en los READMEs de cada uno.

### 3.5 Convención de nombres de archivo inconsistente

En `sima-check/components/` y `core/components/` conviven `BancoPreguntas.jsx` / `CriteriosPanel.jsx` / `ImportUsuariosModal.jsx` (PascalCase, exportan componentes) con `bancoModulo.jsx` / `estadoSimilitudBadge.jsx` (camelCase, mezclan helpers y componentes). El criterio implícito parece ser "PascalCase = default export de un componente", y es razonable — pero `estadoSimilitudBadge.jsx` **sí** exporta un componente por default (`EstadoSimilitudBadge`), así que rompe su propia regla. Renombrarlo a `EstadoSimilitudBadge.jsx` alcanza; `bancoModulo.jsx` está bien como está (es mayormente helpers, y el comentario del archivo explica que existe por `react-refresh/only-export-components`).

---

## 4. Optimización

Poco que rascar: no hay N+1 real, las queries usan `include`/`select` acotados y los `useMemo` están donde corresponde. Lo que encontré:

### 4.3 `GET /usuarios?limit=500` sin paginación en UI

`core/api/usuarios.js:6` pide 500 usuarios de una y descarta el resto de la respuesta paginada. Está comentado a propósito ("la pantalla todavía no tiene paginación en UI"), y con la nómina actual no molesta. Vale tenerlo anotado para cuando entre un Excel real de nómina: a partir de 500 la pantalla empieza a **mentir en silencio** (no muestra a nadie más y no avisa). Mitigación barata mientras tanto: si `total > data.length`, mostrar un aviso.

### 4.4 `resolverCriterios` hace una query por criterio

`modulos.service.ts:569-588` recorre los criterios y lanza un `pregunta.findMany` por cada uno. Se podría hacer con un solo `findMany` con `OR`, pero **como está es mejor**: necesita el conteo *por criterio* para devolver `porCriterio`, y con un `OR` habría que reagrupar en memoria. Los criterios por versión son unidades, no miles. **No tocar** — lo anoto para que no se "optimice" sin ver el trade-off.

---

## 5. Por dónde empezar

Las **sesiones 1** (documentación factual: 1.1, 1.2, 1.3, 1.5), **2** (código muerto: 2.1-2.6) y **3** (tooling y CI: 4.1, 4.2, 4.5, más el warning de `npm run format`) ya están aplicadas. Lo que queda, ordenado por relación impacto/costo:

| Sesión | # | Qué | Por qué | Tamaño |
|---|---|---|---|---|
| **4** | 1 | Unificar `Puestos.jsx`/`CentrosCosto.jsx` (3.3) | −150 líneas, un solo lugar donde arreglar bugs | 1 h |
| **4** | 2 | Partir `BancoPreguntas.jsx` (3.2, paso 1) | El corte más barato de los tres archivos grandes | 1-2 h |
| — | 3 | Decidir qué hacer con `CLAUDE.md` (1.4) y la duplicación entre READMEs (3.4) | Es una decisión, no una tarea — conviene charlarla antes de mover 59 KB, y la sesión 1 la volvió más urgente (ver 1.4) | — |
| — | 4 | Partir `TrainingModules.jsx` y `ReglasAsignacion.jsx` (3.2, pasos 2-3) | Vale la pena, pero recién cuando haya que tocarlos por otra cosa | 3-4 h |

En la sesión 4 conviene ir de a un commit por ítem, con el lint y el build corriendo entre medio, y la verificación visual de las pantallas tocadas queda del lado del usuario (convención del proyecto).
