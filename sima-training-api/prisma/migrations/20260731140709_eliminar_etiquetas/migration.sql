-- Etiqueta se elimina: la reemplaza BaseConocimiento + NivelBase, que cumple la
-- misma función (clasificar preguntas) pero mejorada — una sola base obligatoria
-- por pregunta, con una escala de niveles ordinal propia de cada base, en vez de
-- un N a N de tags libres.
--
-- Sin pérdida de datos: la feature nunca se usó. El seed no creaba etiquetas, el
-- import de Excel no las asignaba y ningún frontend mandaba `etiquetaIds` — su
-- único consumidor eran dos <select> que siempre se veían vacíos. Verificado
-- contra la base antes de dropear: 0 filas en `etiquetas` y 0 en
-- `pregunta_etiquetas`.
--
-- Lo que se pierde a futuro es el eje NOMINAL (agrupar preguntas por subtema
-- además de por nivel). Si reaparece como requerimiento va una entidad nueva y
-- deliberada, no revivir esta.

/*
  Warnings:

  - You are about to drop the `etiquetas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pregunta_etiquetas` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "pregunta_etiquetas" DROP CONSTRAINT "pregunta_etiquetas_etiqueta_id_fkey";

-- DropForeignKey
ALTER TABLE "pregunta_etiquetas" DROP CONSTRAINT "pregunta_etiquetas_pregunta_id_fkey";

-- DropTable
DROP TABLE "etiquetas";

-- DropTable
DROP TABLE "pregunta_etiquetas";

-- DropEnum
DROP TYPE "CategoriaEtiqueta";
