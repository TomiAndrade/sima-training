import { RolUsuario } from '@prisma/client';

/**
 * La matriz de autorización del proyecto, como DATO y en un solo archivo —
 * mismo criterio que `usuarios/matriz-rol-organizacion.ts`, que ya resolvía
 * la otra matriz del dominio (tipo de organización ↔ rol) de esta forma.
 *
 * Los controllers no enumeran roles sueltos: referencian uno de estos tres
 * conjuntos con `@Roles(...CONJUNTO)`. El motivo es que "quién puede tocar
 * el catálogo de puestos" es una decisión de negocio, y repartida en 13
 * controllers no se puede ni leer ni cambiar de una: habría que abrir cada
 * archivo para responder "¿qué puede hacer un COORDINADOR?".
 *
 * ALUMNO no aparece en ninguno a propósito. No es un olvido: el
 * `JwtAuthGuard` ya rechaza a los alumnos antes de llegar acá ("Los alumnos
 * ingresan por la app SIMA CHECK, no por el backoffice"), y su vía es
 * `/tablet/*` con su propio token y su propio guard.
 */

/**
 * Las 22 lecturas del backoffice. Es exactamente el acceso que los tres
 * roles ya tenían antes del `RolesGuard`, así que decorar con esto no
 * amplía nada — preserva el statu quo.
 *
 * Incluye al AUDITOR sobre la nómina completa (`/usuarios`,
 * `/usuarios/:id/informe`, `/estadisticas/*`). Es una decisión tomada, no
 * un descuido: acotar a un auditor a "algunos subcontratistas" necesita un
 * vínculo que hoy no existe en ninguna tabla (ver `docs/pendientes.md`), y
 * mientras no exista, restringirlo acá sería inventar una regla a medias.
 */
export const LECTURA_BACKOFFICE: readonly RolUsuario[] = [
  RolUsuario.ADMINISTRADOR,
  RolUsuario.COORDINADOR,
  RolUsuario.AUDITOR,
];

/**
 * Gestión de la nómina y de a quién le toca qué capacitación: usuarios
 * (editar y dar de baja), el catálogo de puestos y centros de costo, el
 * import de usuarios desde Excel, las asignaciones y sus reglas.
 *
 * El COORDINADOR entra acá porque es el rol que administra a la gente de su
 * empresa — es su trabajo diario. Lo que NO puede es crear usuarios
 * (`POST /usuarios` es ADMINISTRADOR-only) ni cambiarle el rol a nadie: eso
 * último no lo cubre el decorador y va aparte, ver `UsuariosService.update`.
 *
 * Dar el import de usuarios a COORDINADOR es seguro y está verificado: la
 * ruta de confirmación hardcodea `rol: ALUMNO` y el DTO de cada fila no
 * tiene campo `rol` (con `forbidNonWhitelisted` global, mandarlo es un 400).
 * O sea que no hay forma de escalar privilegios subiendo un Excel.
 */
export const GESTION_NOMINA: readonly RolUsuario[] = [
  RolUsuario.ADMINISTRADOR,
  RolUsuario.COORDINADOR,
];

/**
 * Todo lo que define el CONTENIDO de la plataforma y su estructura: crear
 * usuarios, organizaciones, el banco de preguntas, las bases de
 * conocimiento y los módulos con sus versiones.
 *
 * La línea divisoria con `GESTION_NOMINA` es esa: el coordinador administra
 * PERSONAS, el administrador define QUÉ se evalúa. Publicar una versión de
 * un módulo le cambia el examen a toda la nómina, así que no es una
 * operación del día a día de nadie más.
 */
export const SOLO_ADMINISTRADOR: readonly RolUsuario[] = [
  RolUsuario.ADMINISTRADOR,
];
