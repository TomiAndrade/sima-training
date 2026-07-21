-- =========================================================
-- AUDITORÍA: rol de usuario vs tipo de organización
-- =========================================================
-- QUÉ HACE: lista los usuarios cuyo rol no es válido para el
-- tipo de organización a la que pertenecen, según la matriz
-- del modelo de Vinculación (INTERNA -> cualquier rol,
-- CLIENTE -> solo Auditor [rol aún inexistente en el enum],
-- SUBCONTRATISTA -> solo ALUMNO). También marca los usuarios
-- sin organización asignada.
--
-- CUÁNDO CORRERLA: antes del backfill al modelo de Vinculación,
-- para dimensionar cuántos datos actuales violan la matriz nueva.
-- Requiere usuarios cargados en la base (si está vacía, da 0 filas).
--
-- Es de SOLO LECTURA: no modifica ningún dato.
-- =========================================================
WITH usuarios_evaluados AS (
    SELECT
        u.id,
        u.nombre,
        u.apellido,
        u.dni,
        u.rol,
        o.nombre AS organizacion_nombre,
        o.tipo   AS organizacion_tipo,
        CASE
            WHEN u.organizacion_id IS NULL THEN 'SIN_ORGANIZACION'
            WHEN o.tipo = 'INTERNA' THEN NULL
            WHEN o.tipo = 'CLIENTE' THEN 'ROL_INVALIDO_PARA_TIPO'
            WHEN o.tipo = 'SUBCONTRATISTA' AND u.rol <> 'ALUMNO'
                THEN 'ROL_INVALIDO_PARA_TIPO'
            ELSE NULL
        END AS motivo
    FROM usuarios u
    LEFT JOIN organizaciones o
        ON u.organizacion_id = o.id
    WHERE u.deleted_at IS NULL
)
SELECT
    id,
    nombre,
    apellido,
    dni,
    rol AS rol_usuario,
    organizacion_nombre,
    organizacion_tipo,
    motivo
FROM usuarios_evaluados
WHERE motivo IS NOT NULL
ORDER BY motivo, organizacion_tipo;

-- =========================================================
-- RESUMEN: conteo de usuarios por motivo
-- =========================================================
WITH usuarios_evaluados AS (
    SELECT
        u.id,
        CASE
            WHEN u.organizacion_id IS NULL THEN 'SIN_ORGANIZACION'
            WHEN o.tipo = 'INTERNA' THEN NULL
            WHEN o.tipo = 'CLIENTE' THEN 'ROL_INVALIDO_PARA_TIPO'
            WHEN o.tipo = 'SUBCONTRATISTA' AND u.rol <> 'ALUMNO'
                THEN 'ROL_INVALIDO_PARA_TIPO'
            ELSE NULL
        END AS motivo
    FROM usuarios u
    LEFT JOIN organizaciones o
        ON u.organizacion_id = o.id
    WHERE u.deleted_at IS NULL
)
SELECT
    motivo,
    COUNT(*) AS cantidad_usuarios
FROM usuarios_evaluados
WHERE motivo IS NOT NULL
GROUP BY motivo
ORDER BY motivo;
