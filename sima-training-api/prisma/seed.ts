import {
  OrigenPregunta,
  PrismaClient,
  RolUsuario,
  TipoOrganizacion,
  TipoPregunta,
} from '@prisma/client';
// `import type` se borra al compilar: el tipo del DTO no arrastra a src/ al
// runtime del seed base (ver el import dinámico de sembrarDemo).
import type { CreatePreguntaDto } from '../src/preguntas/dto/create-pregunta.dto';

const prisma = new PrismaClient();

// --- Datos base: solo estructura real, sin usuarios/organizaciones de prueba ---
// (los fixtures de usuarios/clientes copiados del prototipo se retiraron: Story 1
// "Limpiar usuarios mockeados" — quedaban persistidos en la base y ensuciaban las
// pruebas de las siguientes stories de usuarios).
//
// El escenario de demo navegable (organizaciones, alumnos, banco clasificado,
// módulo publicado y asignaciones) NO va acá: vive detrás de SEED_DEMO=true.
// Ver sembrarDemo() al final del archivo.

// El seed base NO siembra módulos. Sembraba cuatro (`SIMA Básico`/`Intermedio`/
// `Avanzado`/`Reglas de Oro`) con uuid fijo, que eran la contraparte real del
// mock `sima-check/data/training-modules.js` cuando el backoffice lo
// referenciaba por `backendId`. Ese campo ya no existe (la pantalla Módulos es
// 100% backend), así que los cuatro quedaron como filas vacías que aparecen al
// lado de cualquier módulo que se cree de verdad. El módulo es contenido, no
// estructura: lo crea quien lo necesita — el escenario de demo el suyo
// (`sembrarDemo`), y el admin los de producción desde el backoffice.

// Limpieza en orden de dependencia. TODAS las FK del schema son ON DELETE
// RESTRICT salvo dos (ver abajo), así que hay que ir siempre de las hijas a las
// padres. Antes de agregar una tabla nueva a este orden, grepear el schema
// entero por FKs hacia el target en vez de asumir que esta cadena está
// completa: ya falló TRES veces por ese motivo, y el síntoma aparece recién en
// la SEGUNDA corrida (sobre una base vacía no hay filas hijas que bloqueen nada).
//
//   - Asignacion         tiene FK DIRECTA a Usuario (no pasa por Vinculacion),
//                        así que es su propia rama.
//   - ReglaAsignacion    tiene FK a Modulo, Puesto y CentroCosto. Faltaba en
//                        este orden: con reglas cargadas, el modulo.deleteMany()
//                        de más abajo falla con reglas_asignacion_modulo_id_fkey.
//   - Sesion/Respuesta   son las MÁS hijas de todas y por eso van primeras.
//                        Sesion cuelga de Usuario, ModuloVersion Y Asignacion —
//                        o sea que bloquea las tres ramas de acá abajo, incluida
//                        la de asignaciones, que hasta ahora arrancaba el orden.
//                        Respuesta cuelga de Sesion y de Pregunta, así que además
//                        desbloquea el pregunta.deleteMany() de limpiarDemo().
//
// Las dos FK que NO son RESTRICT: Asignacion.moduloVersionId (SET NULL) y la
// self-FK Organizacion.organizacionPadreId (SET NULL, verificado en el SQL de
// 20260624033224_init/migration.sql:45 — el .prisma no lo dice).
async function limpiar() {
  // AuditLog no tiene ninguna FK saliente (es la tabla polimórfica, ver
  // schema.prisma) — no cuelga de nada de lo de abajo, así que no le importa
  // el orden. Va primera igual, para que el seed sea reproducible.
  await prisma.auditLog.deleteMany();

  await prisma.respuesta.deleteMany();
  await prisma.sesion.deleteMany();
  await prisma.asignacion.deleteMany();
  await prisma.reglaAsignacion.deleteMany();
  await prisma.vinculacionPuestoCentro.deleteMany();
  await prisma.vinculacion.deleteMany();
  await prisma.usuario.deleteMany();

  // Dos pasos: primero las hijas de la jerarquía, después el resto. La self-FK
  // es ON DELETE SET NULL, así que un deleteMany() único probablemente
  // funcionaría — pero el demo introduce el primer par padre/hija que este seed
  // haya tenido, y no vale la pena depender de cómo Postgres resuelve la acción
  // RI sobre una fila que el mismo statement está borrando.
  await prisma.organizacion.deleteMany({
    where: { organizacionPadreId: { not: null } },
  });
  await prisma.organizacion.deleteMany();

  // modulo_version_preguntas + modulo_version_criterios → modulo_versiones →
  // modulos. Los criterios son la tercera rama que cuelga de ModuloVersion y
  // TAMBIÉN son RESTRICT: sin este deleteMany, la segunda corrida del seed
  // demo (que ahora siembra un criterio) moría con
  // modulo_version_criterios_modulo_version_id_fkey. De paso desbloquea el
  // baseConocimiento.deleteMany() de limpiarDemo(), que corre después y tiene
  // el mismo problema por la FK criterio → base.
  await prisma.moduloVersionPregunta.deleteMany();
  await prisma.moduloVersionCriterio.deleteMany();
  await prisma.moduloVersion.deleteMany();
  await prisma.modulo.deleteMany();
}

async function main() {
  await limpiar();

  // El clean del demo va DESPUÉS de limpiar(), que es quien vacía
  // modulo_version_preguntas (Pregunta no se puede borrar antes que sus pivots).
  if (demoActivado()) {
    await limpiarDemo();
  }

  // 1) Organización interna de Ingeniería SIMA — estructura mínima real para
  // poder dar de alta administradores desde el backoffice (no es un fixture).
  await prisma.organizacion.create({
    data: {
      nombre: 'Ingeniería SIMA',
      tipo: TipoOrganizacion.INTERNA,
      activa: true,
      createdBy: 'seed',
    },
  });

  const orgs = await prisma.organizacion.count();
  const usuarios = await prisma.usuario.count();

  console.log(`Seed completo: ${orgs} organizaciones, ${usuarios} usuarios.`);

  if (demoActivado()) {
    await sembrarDemo();
  }
}

// ---------------------------------------------------------------------------
// Escenario de demo (SEED_DEMO=true)
// ---------------------------------------------------------------------------
// Base navegable de punta a punta: jerarquía cliente → subcontratista, alumnos
// con pares (puesto, centro), banco clasificado, un módulo publicado con número
// real y asignaciones AUTOMATICA derivadas de reglas.
//
// Apagado por defecto a propósito: el seed base es la estructura mínima que
// necesita cualquier entorno, y esto son datos de demostración.
//
//   PowerShell:  $env:SEED_DEMO='true'; npx prisma db seed
//   bash:        SEED_DEMO=true npx prisma db seed

function demoActivado() {
  return process.env.SEED_DEMO === 'true';
}

// Borrado extra del demo. Puestos y CentroCosto NO se borran nunca: son
// catálogo de nómina y el demo los reusa por nombre (ver resolverCatalogo).
async function limpiarDemo() {
  // Pregunta antes que la escala: tiene FK a bases_conocimiento y DOS a
  // niveles_base (la simple por nivel_id y la compuesta (nivel_id,
  // base_conocimiento_id) que garantiza la coherencia base↔nivel).
  await prisma.pregunta.deleteMany();
  await prisma.nivelBase.deleteMany();
  await prisma.baseConocimiento.deleteMany();
}

async function sembrarDemo() {
  // Import dinámico: sin SEED_DEMO el seed nunca carga Nest ni el módulo raíz
  // de la app. Se reusan los services (en vez de escribir inserts crudos) para
  // no saltearse las reglas que viven en ellos: la matriz rol↔organización, el
  // appendeo de `orden` al asignar preguntas, el cálculo del número
  // AÑO.MAYOR.MENOR al activar, resolverFuente y el motor de recálculo.
  //
  // Lo que NO corre por esta vía: la ValidationPipe global, que vive en main.ts
  // y sólo se aplica a la capa HTTP. Acá el input es código propio, no de un
  // cliente, así que se acepta.
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { AsignacionesService } =
    await import('../src/asignaciones/asignaciones.service');
  const { ReglasAsignacionService } =
    await import('../src/asignaciones/reglas-asignacion.service');
  const { BasesConocimientoService } =
    await import('../src/bases-conocimiento/bases-conocimiento.service');
  const { CentrosCostoService } =
    await import('../src/centros-costo/centros-costo.service');
  const { ModulosService } = await import('../src/modulos/modulos.service');
  const { OrganizacionesService } =
    await import('../src/organizaciones/organizaciones.service');
  const { PreguntasService } =
    await import('../src/preguntas/preguntas.service');
  const { PuestosService } = await import('../src/puestos/puestos.service');
  const { UsuariosService } = await import('../src/usuarios/usuarios.service');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const organizaciones = app.get(OrganizacionesService);
    const puestos = app.get(PuestosService);
    const centrosCosto = app.get(CentrosCostoService);
    const bases = app.get(BasesConocimientoService);
    const preguntas = app.get(PreguntasService);
    const modulos = app.get(ModulosService);
    const usuarios = app.get(UsuariosService);
    const reglas = app.get(ReglasAsignacionService);
    const asignaciones = app.get(AsignacionesService);

    // 1) Organizaciones: la cadena "para quién trabaja" un subcontratista.
    const cliente = await organizaciones.create({
      nombre: 'Pan American Energy',
      tipo: TipoOrganizacion.CLIENTE,
    });
    const subcontratista = await organizaciones.create({
      nombre: 'Montajes del Sur S.R.L.',
      tipo: TipoOrganizacion.SUBCONTRATISTA,
      organizacionPadreId: cliente.id,
    });

    // 2) Catálogos: se reusan los que ya estén cargados y se crean sólo los que
    // falten (el nombre es @unique, así que create tiraría 409).
    const puestoPorNombre = await resolverCatalogo(puestos, [
      'Soldador',
      'Amolador',
      'Electricista',
    ]);
    const centroPorNombre = await resolverCatalogo(centrosCosto, [
      'Taller',
      'Depósito',
    ]);

    // 3) Base de conocimiento con su fuente y su escala ordinal de 3 niveles.
    // Los niveles se crean SIN `orden` explícito para ejercitar el appendeo
    // (siguienteOrden = max + 1) → quedan 0, 1, 2.
    const base = await bases.create({
      nombre: 'Seguridad Operativa',
      codigo: 'SEG',
      descripcion:
        'EPP, herramientas manuales y eléctricas, trabajo en altura, trabajo en caliente y aislamiento de energía. No incluye gestión de residuos ni manejo defensivo.',
      fuente: 'Manual HSE Ingeniería SIMA — Rev. 3 (2026)',
    });
    const nivelBasico = await bases.crearNivel(base.id, { nombre: 'Básico' });
    const nivelIntermedio = await bases.crearNivel(base.id, {
      nombre: 'Intermedio',
    });
    const nivelAvanzado = await bases.crearNivel(base.id, {
      nombre: 'Avanzado',
    });

    // 4) Banco de preguntas. La `fuente` NO se manda a propósito: resolverFuente
    // la copia de la base y la congela en cada pregunta.
    const clasificacion = (nivelId: string) => ({
      baseConocimientoId: base.id,
      nivelId,
    });

    // Las básicas no se guardan en una variable: al módulo NO entran por id
    // sino por el criterio del paso 5, que las materializa por clasificación.
    await crearPreguntas(preguntas, [
      {
        texto: 'Es obligatorio usar casco en todas las áreas de trabajo.',
        tipo: TipoPregunta.VERDADERO_FALSO,
        respuestaCorrecta: 'Verdadero',
        ...clasificacion(nivelBasico.id),
      },
      {
        texto: '¿Cuál es el EPP mínimo obligatorio para ingresar a planta?',
        tipo: TipoPregunta.OPCION_MULTIPLE,
        opciones: [
          'Casco, guantes y botines de seguridad',
          'Solo casco',
          'Ropa de calle',
          'Ninguno, es opcional',
        ],
        respuestaCorrecta: 'Casco, guantes y botines de seguridad',
        ...clasificacion(nivelBasico.id),
      },
      {
        texto:
          'Está permitido remover la protección del disco de la amoladora para trabajar más rápido.',
        tipo: TipoPregunta.VERDADERO_FALSO,
        respuestaCorrecta: 'Falso',
        ...clasificacion(nivelBasico.id),
      },
      {
        texto:
          '¿Qué elemento de protección es obligatorio al operar una amoladora?',
        tipo: TipoPregunta.OPCION_MULTIPLE,
        opciones: [
          'Antiparras y protector facial',
          'Solo guantes',
          'Ninguno',
          'Auriculares únicamente',
        ],
        respuestaCorrecta: 'Antiparras y protector facial',
        ...clasificacion(nivelBasico.id),
      },
      {
        texto:
          'Un EPP dañado o vencido puede seguir usándose hasta terminar la jornada.',
        tipo: TipoPregunta.VERDADERO_FALSO,
        respuestaCorrecta: 'Falso',
        ...clasificacion(nivelBasico.id),
      },
    ]);

    const intermedias = await crearPreguntas(preguntas, [
      {
        texto: 'Antes de un trabajo en altura, ¿qué se debe verificar primero?',
        tipo: TipoPregunta.OPCION_MULTIPLE,
        opciones: [
          'El anclaje y el arnés de seguridad',
          'Solo el clima',
          'Nada, es opcional',
          'El horario de almuerzo',
        ],
        respuestaCorrecta: 'El anclaje y el arnés de seguridad',
        ...clasificacion(nivelIntermedio.id),
      },
      {
        texto:
          'Un trabajo en caliente (soldadura, esmerilado) en zona con gases inflamables requiere permiso de trabajo previo.',
        tipo: TipoPregunta.VERDADERO_FALSO,
        respuestaCorrecta: 'Verdadero',
        ...clasificacion(nivelIntermedio.id),
      },
      {
        texto:
          '¿A partir de qué altura se considera trabajo en altura y exige protección contra caídas?',
        tipo: TipoPregunta.OPCION_MULTIPLE,
        opciones: [
          '1,80 metros',
          '5 metros',
          '10 metros',
          'No hay una altura definida',
        ],
        respuestaCorrecta: '1,80 metros',
        ...clasificacion(nivelIntermedio.id),
      },
    ]);

    await crearPreguntas(preguntas, [
      {
        texto:
          '¿Cuál de las siguientes NO es una Regla de Oro típica de la industria petrolera?',
        tipo: TipoPregunta.OPCION_MULTIPLE,
        opciones: [
          'Aislamiento de energía (LOTO)',
          'Trabajo en altura con protección',
          'Espacios confinados con permiso',
          'Estacionar en cualquier lugar',
        ],
        respuestaCorrecta: 'Estacionar en cualquier lugar',
        ...clasificacion(nivelAvanzado.id),
      },
      {
        texto:
          'El aislamiento de energía (Lock Out Tag Out) es obligatorio antes de intervenir un equipo.',
        tipo: TipoPregunta.VERDADERO_FALSO,
        respuestaCorrecta: 'Verdadero',
        ...clasificacion(nivelAvanzado.id),
      },
    ]);

    // Dos preguntas SIN clasificar a propósito: son el backlog previo a las
    // bases, y lo que ejercita el filtro "— Sin clasificar —" (?sinBase=true)
    // y su badge ámbar en la tabla de Preguntas.
    await crearPreguntas(preguntas, [
      {
        texto:
          'Los residuos peligrosos se descartan en el mismo contenedor que los residuos comunes.',
        tipo: TipoPregunta.VERDADERO_FALSO,
        respuestaCorrecta: 'Falso',
      },
      {
        texto: '¿Cuál es la velocidad máxima permitida dentro del yacimiento?',
        tipo: TipoPregunta.OPCION_MULTIPLE,
        opciones: ['40 km/h', '80 km/h', '100 km/h', 'No hay límite'],
        respuestaCorrecta: '40 km/h',
      },
    ]);

    // 5) Módulo publicado. El demo crea sus propios módulos con
    // `modulos.create()` (que ya deja la ModuloVersion v1 en BORRADOR) en vez
    // de poblar uno que sembrara el seed base: así esta rama es autocontenida y
    // no depende de ningún uuid fijo compartido entre las dos.
    //
    // "Reglas de Oro" se crea y NO se publica a propósito: es el módulo al que
    // apunta la regla de centro del paso 7, y es lo que ejercita el sufijo
    // "(sin versión publicada)" del backoffice.
    const moduloBasico = await modulos.create({ nombre: 'SIMA Básico' });
    const moduloReglasDeOro = await modulos.create({
      nombre: 'Reglas de Oro Industria Petrolera',
    });

    // El contenido se arma por los DOS caminos que conviven (Sprint 7), para que
    // el módulo publicado ejercite los dos `origen` de pivot en vez de quedar
    // 100% MANUAL como estaba antes:
    //
    //   a) un CRITERIO (Seguridad Operativa / Básico) que materializa su pool →
    //      las 5 preguntas del nivel Básico entran con origen CRITERIO, por
    //      clasificación y no por id;
    //   b) dos preguntas agregadas a mano encima → quedan origen MANUAL (es el
    //      default del pivot; asignarPreguntas no manda `origen`).
    //
    // Las manuales son del nivel INTERMEDIO a propósito: si matchearan el
    // criterio, resolverCriterios las saltearía (una MANUAL nunca se reetiqueta
    // CRITERIO) y el escenario mostraría un pool corto sin que se note. Con
    // niveles distintos los dos conjuntos son disjuntos y las dos secciones del
    // editor quedan llenas.
    //
    // ⚠️ ORDEN: setCriterios y asignarPreguntas exigen los dos que la versión esté
    // en BORRADOR, así que van antes de activar(). Sobre un ACTIVO, setCriterios
    // tira ConflictException (resolver criterios borra pivots y rompería la
    // inmutabilidad del historial).
    await modulos.setCriterios(moduloBasico.id, {
      criterios: [{ baseConocimientoId: base.id, nivelId: nivelBasico.id }],
    });
    const manuales = intermedias.slice(0, 2);
    await modulos.asignarPreguntas(
      moduloBasico.id,
      // Sin `orden`: se appendean después de las que trajo el criterio
      // (siguienteOrden = max + 1).
      manuales.map((pregunta) => ({ preguntaId: pregunta.id })),
    );
    // Sin `esNuevaLinea`: es la primera publicación del módulo, no hay un ACTIVO
    // del cual derivar el número, así que calcularNumero cae en siguienteMayor
    // y queda AÑO.01.00. Publica el snapshot tal cual: activar() NO vuelve a
    // resolver los criterios.
    const versionPublicada = await modulos.activar(moduloBasico.id);

    // 6) Alumnos del subcontratista. UsuariosService.create valida la matriz
    // (SUBCONTRATISTA sólo admite ALUMNO) y recalcula en la misma transacción.
    // El primer par del array queda `principal` (lo deriva paresACrear de la
    // posición 0).
    const par = (puesto: string, centro: string) => ({
      puestoId: puestoPorNombre[puesto],
      centroCostoId: centroPorNombre[centro],
    });

    const carlos = await usuarios.create(
      {
        nombre: 'Carlos',
        apellido: 'Ferreyra',
        dni: '28444111',
        vinculacion: {
          organizacionId: subcontratista.id,
          rol: RolUsuario.ALUMNO,
          pares: [par('Soldador', 'Taller')],
        },
      },
      'seed',
    );

    // Dos pares: es el caso que ejercita "el alumno rinde los módulos de TODOS
    // sus pares". Cada par lo alcanza una regla distinta (ver más abajo).
    const andrea = await usuarios.create(
      {
        nombre: 'Andrea',
        apellido: 'Quiroga',
        dni: '31555222',
        vinculacion: {
          organizacionId: subcontratista.id,
          rol: RolUsuario.ALUMNO,
          pares: [par('Soldador', 'Taller'), par('Electricista', 'Depósito')],
        },
      },
      'seed',
    );

    const hernan = await usuarios.create(
      {
        nombre: 'Hernán',
        apellido: 'Palacios',
        dni: '33666333',
        vinculacion: {
          organizacionId: subcontratista.id,
          rol: RolUsuario.ALUMNO,
          pares: [par('Electricista', 'Depósito')],
        },
      },
      'seed',
    );

    // 7) Reglas, una de cada alcance. Cada create abre su propia transacción y
    // recalcula todo el centro, así que las Asignacion AUTOMATICA ya quedan
    // creadas acá.
    await reglas.create(
      {
        puestoId: puestoPorNombre['Soldador'],
        centroCostoId: centroPorNombre['Taller'],
        moduloId: moduloBasico.id,
      },
      'seed',
    );
    // Sin puestoId = regla de CENTRO: aplica a todos los puestos de Depósito.
    // Apunta a un módulo sin versión publicada a propósito, para ejercitar el
    // sufijo "(sin versión publicada)" del backoffice.
    await reglas.create(
      {
        centroCostoId: centroPorNombre['Depósito'],
        moduloId: moduloReglasDeOro.id,
      },
      'seed',
    );

    // 8) Recálculo explícito por persona. Es idempotente y las reglas de arriba
    // ya derivaron todo: corre igual como reconciliación y para poder reportar.
    for (const usuario of [carlos, andrea, hernan]) {
      await asignaciones.recalcular(usuario.id, 'seed');
    }

    await imprimirResumenDemo({
      cliente,
      subcontratista,
      base,
      niveles: [nivelBasico, nivelIntermedio, nivelAvanzado],
      moduloBasico,
      criterio: { base: base.nombre, nivel: nivelBasico.nombre },
      versionPublicada,
      usuariosDemo: [carlos, andrea, hernan],
    });
  } finally {
    await app.close();
  }
}

// Devuelve un mapa nombre → id, creando sólo los que falten. Sirve igual para
// PuestosService y CentrosCostoService: los dos exponen findAll()/create().
async function resolverCatalogo(
  service: {
    findAll: () => Promise<{ id: string; nombre: string }[]>;
    create: (dto: {
      nombre: string;
    }) => Promise<{ id: string; nombre: string }>;
  },
  nombres: string[],
): Promise<Record<string, string>> {
  const existentes = await service.findAll();
  const porNombre: Record<string, string> = {};
  for (const item of existentes) porNombre[item.nombre] = item.id;

  for (const nombre of nombres) {
    if (porNombre[nombre]) continue;
    const creado = await service.create({ nombre });
    porNombre[nombre] = creado.id;
  }
  return porNombre;
}

// Crea preguntas en serie y devuelve las creadas. En serie y no en paralelo
// porque resolverFuente consulta la base por cada una.
async function crearPreguntas(
  service: { create: (dto: CreatePreguntaDto) => Promise<{ id: string }> },
  dtos: CreatePreguntaDto[],
): Promise<{ id: string }[]> {
  const creadas: { id: string }[] = [];
  for (const dto of dtos) {
    creadas.push(await service.create(dto));
  }
  return creadas;
}

// Resumen con los IDs de todo lo sembrado, para poder armar las llamadas de
// verificación (Invoke-RestMethod) sin ir a buscarlos a Prisma Studio.
async function imprimirResumenDemo(datos: {
  cliente: { id: number; nombre: string };
  subcontratista: { id: number; nombre: string };
  base: { id: string; nombre: string; codigo: string | null };
  niveles: { id: string; nombre: string; orden: number }[];
  moduloBasico: { id: string; nombre: string };
  criterio: { base: string; nivel: string };
  versionPublicada: {
    id: string;
    anio: number | null;
    mayor: number | null;
    menor: number | null;
  };
  usuariosDemo: { id: number; nombre: string; apellido: string; dni: string }[];
}) {
  const {
    cliente,
    subcontratista,
    base,
    niveles,
    moduloBasico,
    criterio,
    versionPublicada,
    usuariosDemo,
  } = datos;

  const pad2 = (n: number | null) => String(n ?? 0).padStart(2, '0');
  const numero = `${versionPublicada.anio}.${pad2(versionPublicada.mayor)}.${pad2(versionPublicada.menor)}`;

  const totalPreguntas = await prisma.pregunta.count();
  const sinClasificar = await prisma.pregunta.count({
    where: { baseConocimientoId: null },
  });
  const vigentes = await prisma.asignacion.count({
    where: { revocadaAt: null },
  });

  // Se cuentan los pivots REALES de la versión publicada, no lo que el seed
  // creyó sembrar: es la evidencia de que el snapshot quedó con los dos
  // orígenes conviviendo (y de que activar() lo publicó sin re-resolver).
  const contarPivots = (origen: OrigenPregunta) =>
    prisma.moduloVersionPregunta.count({
      where: { moduloVersionId: versionPublicada.id, origen },
    });
  const preguntasPorCriterio = await contarPivots(OrigenPregunta.CRITERIO);
  const preguntasManuales = await contarPivots(OrigenPregunta.MANUAL);

  const lineas = [
    '',
    '--- Escenario de demo sembrado (SEED_DEMO=true) ---',
    '',
    'Organizaciones:',
    `  ${cliente.id}  ${cliente.nombre} (CLIENTE)`,
    `  ${subcontratista.id}  ${subcontratista.nombre} (SUBCONTRATISTA → ${cliente.nombre})`,
    '',
    `Base de conocimiento [${base.codigo}] ${base.nombre}:`,
    `  ${base.id}`,
    ...niveles.map(
      (n) => `    nivel ${n.orden} ${n.nombre.padEnd(10)} ${n.id}`,
    ),
    '',
    `Módulo publicado — ${moduloBasico.nombre}:`,
    `  modulo   ${moduloBasico.id}`,
    `  version  ${versionPublicada.id}  (${numero})`,
    `  criterio ${criterio.base} / ${criterio.nivel}`,
    `  contenido: ${preguntasPorCriterio} por criterio + ${preguntasManuales} manuales`,
    '',
    'Usuarios:',
    ...usuariosDemo.map(
      (u) =>
        `  ${u.id}  ${`${u.nombre} ${u.apellido}`.padEnd(18)} DNI ${u.dni}`,
    ),
    '',
    `Banco: ${totalPreguntas} preguntas (${sinClasificar} sin clasificar).`,
    `Asignaciones vigentes: ${vigentes}.`,
    '',
  ];

  console.log(lineas.join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
