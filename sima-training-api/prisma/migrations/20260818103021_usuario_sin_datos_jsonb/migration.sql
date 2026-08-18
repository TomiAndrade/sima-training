-- `Usuario.datos` era un jsonb de nómina flexible. Su último y único
-- escritor era el import de Excel, que guardaba ahí el `legajo`; ningún
-- frontend lo leía (ver el spike de la Story 1 del sprint 13-08). Se
-- dropea la columna en vez de dejarla vacía: un jsonb que nadie escribe
-- ni lee termina llenándose de cualquier cosa.
-- Los legajos ya importados se pierden con la columna, a propósito.
ALTER TABLE "usuarios" DROP COLUMN "datos";
