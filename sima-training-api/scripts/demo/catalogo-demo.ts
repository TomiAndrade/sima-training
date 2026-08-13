// Catálogo semilla de la demo: los puestos y centros que ya están cargados
// cuando arranca la presentación.
//
// No es un recorte arbitrario del Excel: cada nombre está elegido para que las
// dos tandas de import disparen los tres badges de similitud. Los nombres salen
// de la hoja "Listado de Puestos" (el catálogo oficial que mandó el cliente),
// salvo tres que se toman como los escribe la nómina porque la variante oficial
// no la usa nadie: `Supervisor de Servicio`, `Electricista` y `Operador de
// Planta`.
//
// ⚠️ Esto es un catálogo DE DEMOSTRACIÓN, no la carga productiva de la nómina.
// Cuál es el catálogo oficial de puestos sigue siendo una pregunta abierta para
// Eduardo (ver docs/pendientes.md) y hay que responderla antes de cargar las 264
// personas de verdad: corregirlo después no es renombrar, es reapuntar pares.

// Los 16 puestos que quedan cargados antes de la demo. El comentario de cada uno
// es lo que provoca en la tanda B, medido contra los datos reales del Excel.
export const PUESTOS_SEMILLA = [
  // Con variante en la nómina → generan los badges "Parecida" de la tanda B.
  'Operador de Planta', //      ← "Ayte. Operador Planta" (0.70). Además absorbe
  //                              "Operador de planta" y "Operador de  Planta",
  //                              que normalizan igual (1.00 = Duplicada).
  'Chofer flota pesada', //     ← "Chofer flota pesada C/ Hidro" (0.83) y
  //                              "Chofer Flota Semi pesada" (0.84). LOS DOS SON
  //                              FALSOS POSITIVOS: son puestos distintos, y ese
  //                              es el momento más importante de la demo.
  'Tareas Generales', //        ← "Ayte. Tareas Generales" (0.82), otro falso
  //                              positivo: un ayudante no es el puesto pleno.
  'Supervisor de Servicio', //  ← "Supervisor Servicio" y "Supervisor  Servicio" (0.87)
  'Supervisor de Obras', //     ← "Supervisor de Obra" (0.92)
  'Control Documental QA/QC', //← "Control Documental QaQc" (0.90) y
  //                              "Control Documentario QA" (0.78)
  'Coord. de Servicio', //      ← "Coordinador de Servicio" (0.76)
  'Electricista', //            ← "Electricista Automotor" (0.72)
  'Sistemas Informáticos', //   ← "Auxiliar de Sistemas Informáticos" (0.75)
  'Tesorero/a', //              ← "Tesorera" (0.70)
  'Mecánico de Campo', //       ← "Mecánico de campo" (1.00, normaliza igual)

  // Sin variante: son los que dan los "Duplicada" limpios de las dos tandas.
  'Recorredor',
  'Administrativo/a',
  'Soldador',
  'Amolador',
  'Instrumentista',
];

// LOS 16 CENTROS COMPLETOS, a propósito.
//
// Son códigos internos de la empresa (la columna "Dependencia" del Excel), así
// que acá **no hay typos que detectar**: cada uno coincide exacto o no existe.
// Sembrar sólo algunos no agregaba ni un caso interesante — agregaba 8 paradas
// muertas en el modal (6 en la tanda B y 2 en la A) para tipear códigos, que es
// justo donde se pierde a la audiencia.
//
// Con los 16 cargados, TODA fila de las dos tandas resuelve su centro sola y las
// únicas decisiones del modal son de puesto, que es donde está el mensaje.
// Es además lo realista: la lista de centros de costo de una empresa es un dato
// que ya existe, no algo que se descubre importando la nómina.
// Dos van con el nombre LIMPIO y no como los escribe el Excel: `Administración`
// (el Excel dice "1_ Administración") y `Taller` ("2_ Taller"). Es a propósito —
// esos prefijos numéricos son un orden de planilla, no parte del nombre del
// centro. El efecto secundario es bueno para la demo: son las dos únicas filas
// donde el detector de similitud actúa sobre un CENTRO y no sobre un puesto
// (0.88 y 0.75), y muestra que la misma detección corre en los dos catálogos.
export const CENTROS_SEMILLA = [
  'S31', //                    48 personas
  'S49', //                    32
  'Administración', //         31   ← el Excel dice "1_ Administración" (0.88)
  'S32', //                    29
  'S48', //                    27
  'OB_ Estructura Obras', //   24
  'LOG_Logística', //          19
  'OB308', //                  19
  'Taller', //                 10   ← el Excel dice "2_ Taller" (0.75)
  'S51', //                    10
  'SSMAC', //                   6
  'S71', //                     3
  'Mant. Edilicio H. Land', //  3
  'Estructura Servicios', //    1
  'S47', //                     1
  'Asistente Dirección', //     1
];
