-- Parámetros de examen POR VERSIÓN de módulo: cuántas preguntas toma la tablet,
-- con qué porcentaje se aprueba, cuántos reintentos se permiten y cuánto hay que
-- esperar entre uno y otro. Hasta acá los dos primeros eran constantes del backend
-- (PREGUNTAS_POR_EXAMEN = 3 en tablet.service.ts, UMBRAL_APROBACION_DEFAULT = 70 en
-- sesiones/corregir.ts) y los otros dos no existían — ver docs/pendientes.md.
--
-- Van en `modulo_versiones` y no en `modulos` (donde vive vigencia_meses) porque se
-- congelan con la versión: sólo se editan mientras está en BORRADOR y crearVersion()
-- los copia del ACTIVO. Es la misma regla que ya gobierna los pivots y los criterios.
--
-- Cambio ADITIVO, sin backfill y NULLABLE a propósito: `null` significa "usar el
-- default global", NO cero. Escribirle 3 y 70 a las versiones existentes las haría
-- DECLARAR unos valores que en su momento eran globales — y entonces un cambio futuro
-- del default no las alcanzaría, que es exactamente lo contrario de lo que se quiere
-- para las versiones viejas.
--
-- Sin CHECK constraints: los rangos (todos >= 1, umbral <= 100) los valida
-- ParametrosExamenDto en la capa HTTP. No hay ninguna invariante que cruce columnas
-- y que la base tenga que garantizar — en particular NO se exige
-- umbral_aprobacion contra preguntas_por_examen: el umbral es un porcentaje, se
-- compara contra el score redondeado y es válido con cualquier cantidad de preguntas.

-- AlterTable
ALTER TABLE "modulo_versiones" ADD COLUMN     "espera_entre_intentos_minutos" INTEGER,
ADD COLUMN     "max_intentos" INTEGER,
ADD COLUMN     "preguntas_por_examen" INTEGER,
ADD COLUMN     "umbral_aprobacion" INTEGER;
