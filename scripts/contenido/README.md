# `scripts/contenido/` — de los Excel de SIMA CHECK al seed

Extraen el contenido real de evaluación desde los Excel que están en `docs/` y
escriben lo que consume `prisma/seed.ts`:

| Salida | Qué es |
|---|---|
| `sima-training-api/prisma/seed-data/preguntas-sima-check.ts` | las 202 preguntas de los cinco Excel |
| `sima-training-api/prisma/seed-assets/preguntas/*.png\|.jpg` | las 73 imágenes que usan |
| `sima-training-api/prisma/seed-data/catalogos-nomina.ts` | los 88 puestos y los 16 centros de costo |

**La salida está versionada; los Excel no** (`docs/*.xlsx` está en el
`.gitignore` porque el de nómina lleva PII). O sea: esto **no corre en un clone
limpio**, y no hace falta que corra — se corre sólo cuando llega una revisión
nueva de los Excel. El porqué de cada convención de lectura, y los tres casos
que el Excel deja ambiguos, están en
[`docs/decisiones/preguntas.md`](../../docs/decisiones/preguntas.md#el-contenido-real-los-cinco-excel-de-sima-check).

## Correrlos

```bash
pip install openpyxl pillow
python scripts/contenido/generar.py     # preguntas + imágenes
python scripts/contenido/catalogos.py   # puestos + centros de costo
```

Los dos son idempotentes y pisan la salida anterior. `generar.py` imprime un
resumen por módulo y avisa (`!!`) de cualquier pregunta que quede sin respuesta
correcta o con más de una imagen de enunciado.

Están en **Python y no en TypeScript** —lo raro del repo— porque hay que leer el
relleno de las celdas, la capa de drawing (los cuadros de texto y las imágenes) y
los recortes `srcRect`. `exceljs`, que es lo que ya usa el import de Excel del
backend, no expone la capa de drawing: sin ella las 45 preguntas de opciones con
imagen son inaccesibles.

## Los archivos

| Archivo | Qué hace |
|---|---|
| `parse.py` | lee un Excel y devuelve preguntas crudas: enunciado, opciones (con cuál está en verde), imágenes y celdas vacías verdes |
| `clasificar.py` | convierte eso en `VERDADERO_FALSO` / `OPCION_MULTIPLE` / `OPCIONES_IMAGEN` y resuelve la correcta |
| `geometria.py` | los recortes `srcRect` que Excel le aplica a cada imagen |
| `generar.py` | orquesta, recorta y deduplica las imágenes, aplica las correcciones a mano y emite el `.ts` |
| `catalogos.py` | el otro Excel: puestos y "Dependencia" (= centro de costo) de la nómina, **sin** las personas |

## No confundir con `sima-training-api/scripts/demo/`

Aquello es otra cosa: un banco **inventado** y unos Excel generados para mostrar
en vivo el flujo de import con sus badges de similitud. Esto es el contenido
**real** de las evaluaciones.
