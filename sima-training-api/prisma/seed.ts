// Type-only: se borra al compilar, no arrastra Nest al runtime del seed base.
import type { INestApplicationContext } from '@nestjs/common';
import {
  OrigenPregunta,
  PrismaClient,
  TipoOrganizacion,
  TipoPregunta,
} from '@prisma/client';
// Los dos son datos GENERADOS desde los Excel de docs/ (ver la cabecera de cada
// archivo). Son data pura, sin dependencias de src/: importarlos estáticamente
// no arrastra Nest al seed base, a diferencia de los services, que siguen
// entrando por import dinámico dentro de sembrarSimaCheck().
import { CENTROS_COSTO, PUESTOS } from './seed-data/catalogos-nomina';
import { PREGUNTAS } from './seed-data/preguntas-sima-check';

const prisma = new PrismaClient();

// --- Datos base: solo estructura real, sin usuarios/organizaciones de prueba ---
// (los fixtures de usuarios/clientes copiados del prototipo se retiraron: Story 1
// "Limpiar usuarios mockeados" — quedaban persistidos en la base y ensuciaban las
// pruebas de las siguientes stories de usuarios).
//
// El contenido de SIMA CHECK (catálogos de nómina, bases con su escala, las
// 202 preguntas con sus imágenes, los cinco módulos publicados y las reglas de
// asignación) NO va acá: vive detrás de SEED_SIMA_CHECK=true. Ver
// sembrarSimaCheck() al final del archivo.

// El seed base NO siembra módulos. Sembraba cuatro (`SIMA Básico`/`Intermedio`/
// `Avanzado`/`Reglas de Oro`) con uuid fijo, que eran la contraparte real del
// mock `sima-check/data/training-modules.js` cuando el backoffice lo
// referenciaba por `backendId`. Ese campo ya no existe (la pantalla Módulos es
// 100% backend), así que los cuatro quedaron como filas vacías que aparecen al
// lado de cualquier módulo que se cree de verdad. El módulo es contenido, no
// estructura: lo crea quien lo necesita — `sembrarSimaCheck` los cinco reales,
// y el admin los suyos desde el backoffice.

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
//                        desbloquea el pregunta.deleteMany() de limpiarSimaCheck().
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
  // funcionaría — pero en cuanto haya una organización con padre (cliente →
  // subcontratista, que es el caso normal en producción) no vale la pena
  // depender de cómo Postgres resuelve la acción RI sobre una fila que el mismo
  // statement está borrando.
  await prisma.organizacion.deleteMany({
    where: { organizacionPadreId: { not: null } },
  });
  await prisma.organizacion.deleteMany();

  // modulo_version_preguntas + modulo_version_criterios → modulo_versiones →
  // modulos. Los criterios son la tercera rama que cuelga de ModuloVersion y
  // TAMBIÉN son RESTRICT: sin este deleteMany, la segunda corrida del seed
  // con contenido (que siembra un criterio por módulo) moría con
  // modulo_version_criterios_modulo_version_id_fkey. De paso desbloquea el
  // baseConocimiento.deleteMany() de limpiarSimaCheck(), que corre después y
  // tiene el mismo problema por la FK criterio → base.
  await prisma.moduloVersionPregunta.deleteMany();
  await prisma.moduloVersionCriterio.deleteMany();
  await prisma.moduloVersion.deleteMany();
  await prisma.modulo.deleteMany();
}

async function main() {
  await limpiar();

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

  // El clean del contenido corre DENTRO de sembrarSimaCheck(), con la app de
  // Nest ya levantada: hay imágenes que borrar del storage y eso necesita el
  // StorageService. limpiar() (arriba) ya vació modulo_version_preguntas, que
  // es lo que bloquea el borrado de las preguntas.
  if (simaCheckActivado()) {
    await sembrarSimaCheck();
  }
}

// ---------------------------------------------------------------------------
// Contenido de SIMA CHECK (SEED_SIMA_CHECK=true)
// ---------------------------------------------------------------------------
// Carga el contenido REAL de evaluación de Ingeniería SIMA: los catálogos de
// nómina, las tres bases de conocimiento con su escala, las 202 preguntas de
// los cinco Excel (con sus imágenes) y los cinco módulos publicados, más las
// reglas de asignación que dicen qué módulo rinde cada centro/puesto.
//
// Lo que NO carga: personas. Los alumnos entran por el import de Excel del
// backoffice contra la organización `Ingeniería SIMA` que crea el seed base —
// la nómina es PII y no vive en ningún archivo versionado. Mientras no haya
// usuarios, las reglas de acá no derivan ninguna Asignacion: recién al importar
// la nómina el motor de recálculo las materializa.
//
// Apagado por defecto a propósito: el seed base es la estructura mínima que
// necesita cualquier entorno, y esto es contenido.
//
//   PowerShell:  $env:SEED_SIMA_CHECK='true'; npx prisma db seed
//   bash:        SEED_SIMA_CHECK=true npx prisma db seed

function simaCheckActivado() {
  return process.env.SEED_SIMA_CHECK === 'true';
}

// Las tres bases y su escala de niveles. La base es el PROGRAMA de evaluación
// (no se versiona: es taxonomía) y el nivel es la dificultad dentro de él.
//
// Por qué los tres Excel de SIMA caen en UNA sola base con tres niveles y no en
// tres bases: Básico, Intermedio y Avanzado son la misma materia —la inducción
// SSMAC de Ingeniería SIMA— tomada con distinta profundidad, que es exactamente
// lo que `NivelBase` modela (una escala ORDINAL). Reglas de Oro y Phoenix sí son
// bases aparte: son programas de terceros (la SRT y la operadora) con temario
// propio, y separarlos es lo que permite medir "cómo le va a la gente en las
// Reglas que Salvan Vidas" sin que se mezcle con la inducción propia.
const BASES = [
  {
    slug: 'induccion',
    nombre: 'Inducción SSMAC Ingeniería Sima',
    codigo: 'IND',
    descripcion:
      'Inducción de Seguridad, Salud, Medio Ambiente y Calidad de Ingeniería SIMA: Reglas de Oro propias, gestión de residuos, EPP, ergonomía, seguridad vial, política del Sistema Integrado de Gestión y normas ISO. No incluye los programas de las operadoras.',
    fuente: 'Evaluaciones SIMA CHECK — Ingeniería Sima (2026)',
    color: '#2563eb',
    niveles: ['Básico', 'Intermedio', 'Avanzado'],
  },
  {
    slug: 'reglas-oro',
    nombre: 'Reglas de Oro Industria Petrolera',
    codigo: 'ORO',
    descripcion:
      'Las Reglas de Oro de la industria petrolera enmarcadas en la Resolución SRT N° 770/13: espacio confinado, aislamiento de energías, línea de fuego, permiso de trabajo, operaciones de izado, seguridad vial, trabajo en altura, excavaciones y manejo del cambio.',
    fuente: 'Reglas de Oro de la Industria Petrolera — Resolución SRT N° 770/13',
    color: '#ca8a04',
    niveles: ['General'],
  },
  {
    slug: 'phoenix',
    nombre: 'Reglas que Salvan Vidas — Phoenix',
    codigo: 'RSV',
    descripcion:
      'Reglas que Salvan Vidas (RSV) de Phoenix Global Resources: las nueve reglas del programa, barreras de control de riesgo, ATS y clasificación de residuos según el código de colores de la operadora. Aplica sólo al personal afectado a operaciones de PGR.',
    fuente: 'Reglas que Salvan Vidas — Phoenix Global Resources (PGR)',
    color: '#dc2626',
    niveles: ['General'],
  },
] as const;

// Los cinco módulos, uno por Excel. `preguntas` es la clave dentro de PREGUNTAS
// y `base`/`nivel` dicen con qué CRITERIO se llena el módulo: no se le asignan
// preguntas por id, se declara "todo lo clasificado como (base, nivel)" y
// resolverCriterios() lo materializa. Es lo que hace que agregar una pregunta
// nueva al banco entre sola al módulo en la próxima versión.
//
// preguntasPorExamen es MUY menor que el pool a propósito: el Excel en papel se
// toma entero, pero acá cada intento sortea del pool, así que dos personas del
// mismo puesto no rinden el mismo examen. `maxIntentos` va sin declarar (sin
// tope) — es una decisión de negocio que el admin fija por módulo desde el
// backoffice, y un tope puesto por el seed sería una regla inventada.
const MODULOS = [
  {
    slug: 'basico',
    nombre: 'SIMA Básico',
    descripcion:
      'Inducción básica de SSMAC: Reglas de Oro de Ingeniería SIMA, señalización, gestión de residuos, EPP, levantamiento manual de cargas y seguridad vial.',
    base: 'induccion',
    nivel: 'Básico',
    preguntasPorExamen: 15,
    umbralAprobacion: 70,
    vigenciaMeses: 12,
    // Uno de los dos módulos del MODO INVITADO (el otro es Reglas de Oro). Los
    // eligió el usuario, y el criterio es qué contenido se le puede mostrar a
    // alguien de afuera de la empresa: éste es la inducción general de SIMA y
    // Reglas de Oro es normativa pública (Res. SRT N° 770/13). Los otros tres
    // quedan fuera a propósito — Phoenix es el programa de una operadora
    // concreta, y los dos niveles superiores son material interno.
    demoPublico: true,
  },
  {
    slug: 'intermedio',
    nombre: 'SIMA Intermedio',
    descripcion:
      'Segundo nivel de la inducción: trabajo en sistemas eléctricos sin tensión, espacios confinados, aislamiento de energías, productos químicos según SGA, ralentí y primeros auxilios.',
    base: 'induccion',
    nivel: 'Intermedio',
    preguntasPorExamen: 12,
    umbralAprobacion: 70,
    vigenciaMeses: 12,
  },
  {
    slug: 'avanzado',
    nombre: 'SIMA Avanzado',
    descripcion:
      'Nivel de conducción: política del Sistema Integrado de Gestión, misión y visión, alcance certificado, normas ISO 9001/14001/45001, peligro y riesgo, e IPER.',
    base: 'induccion',
    nivel: 'Avanzado',
    preguntasPorExamen: 12,
    umbralAprobacion: 70,
    vigenciaMeses: 12,
  },
  {
    slug: 'reglas-oro',
    nombre: 'Reglas de Oro Industria Petrolera',
    descripcion:
      'Las Reglas de Oro de la industria petrolera (Resolución SRT N° 770/13) y la autoridad para detener una tarea.',
    base: 'reglas-oro',
    nivel: 'General',
    preguntasPorExamen: 12,
    umbralAprobacion: 70,
    vigenciaMeses: 12,
    // El segundo módulo del modo invitado — ver el comentario en SIMA Básico.
    demoPublico: true,
  },
  {
    slug: 'phoenix',
    nombre: 'Reglas que Salvan Vidas — Phoenix',
    descripcion:
      'Programa Reglas que Salvan Vidas de Phoenix Global Resources, para el personal afectado a operaciones de la operadora.',
    base: 'phoenix',
    nivel: 'General',
    preguntasPorExamen: 15,
    umbralAprobacion: 70,
    vigenciaMeses: 12,
  },
] as const;

// Centros donde se trabaja en campo/taller, o sea todos menos los dos de
// oficina. Es el recorte que usan las reglas de Reglas de Oro más abajo.
const CENTROS_OPERATIVOS = CENTROS_COSTO.filter(
  (centro) => centro !== '1_ Administración' && centro !== 'Asistente Dirección',
);

// Qué módulo rinde quién. Dos alcances, los dos que soporta ReglaAsignacion:
//
//   - sin `puestos` = regla de CENTRO: le cae a TODOS los puestos de ese centro.
//   - con `puestos` = regla de PAR: sólo a esos puestos DENTRO de esos centros
//     (se genera una regla por cada combinación).
//
// El escalonamiento es por jerarquía: el Básico lo rinde todo el mundo, las
// Reglas de Oro sólo quien pisa campo o taller, Phoenix sólo los servicios que
// operan para esa operadora, y el Avanzado la línea de conducción.
//
// Esto es una PROPUESTA razonable, no un dato del Excel: los Excel no dicen qué
// puesto rinde qué módulo. Se edita desde el backoffice sin tocar el seed.
const REGLAS: {
  modulo: string;
  centros: readonly string[];
  puestos?: readonly string[];
}[] = [
  // Todos, sin excepción.
  { modulo: 'basico', centros: CENTROS_COSTO },
  // Obra, taller y logística: el nivel intermedio profundiza justo lo que se
  // toca ahí (eléctrico sin tensión, espacios confinados, químicos, ralentí).
  {
    modulo: 'intermedio',
    centros: ['2_ Taller', 'LOG_Logística', 'OB308', 'OB_ Estructura Obras'],
  },
  // Todo el personal de campo y taller.
  { modulo: 'reglas-oro', centros: CENTROS_OPERATIVOS },
  // Servicios que operan para Phoenix Global Resources.
  { modulo: 'phoenix', centros: ['S31', 'S49'] },
  // Línea de conducción, en las dos estructuras que la concentran.
  {
    modulo: 'avanzado',
    centros: ['OB_ Estructura Obras', 'Estructura Servicios'],
    puestos: [
      'Jefe de Obra',
      'Jefe de Taller',
      'Supervisor de Obras',
      'Supervisor General',
      'Supervisor Servicio',
      'Coord. de Servicio',
      'Coord. SSMAC',
      'Representante Técnico',
      'Project Manager',
    ],
  },
];

// Borrado extra del contenido. Puestos y CentroCosto NO se borran nunca: son
// catálogo de nómina y el seed los reusa por nombre (ver resolverCatalogo).
async function limpiarSimaCheck(app: INestApplicationContext) {
  // Las imágenes van ANTES de borrar las preguntas: la clave de storage sólo
  // se conoce leyéndolas, y sin esto cada corrida del seed dejaría 73 archivos
  // huérfanos más en el bucket (o en ./uploads con el driver local).
  await borrarImagenesDePreguntas(app);

  // Pregunta antes que la escala: tiene FK a bases_conocimiento y DOS a
  // niveles_base (la simple por nivel_id y la compuesta (nivel_id,
  // base_conocimiento_id) que garantiza la coherencia base↔nivel).
  await prisma.pregunta.deleteMany();
  await prisma.nivelBase.deleteMany();
  await prisma.baseConocimiento.deleteMany();
}

// Una imagen puede estar referenciada desde el enunciado (columna `imagen`) o
// desde una opción de OPCIONES_IMAGEN (dentro del jsonb `opciones`): hay que
// mirar los dos lugares. Las rutas legacy del import de Excel (empiezan con
// '/') no son claves de storage y se saltean.
async function borrarImagenesDePreguntas(app: INestApplicationContext) {
  const { StorageService } = await import('../src/storage/storage.service');
  const storage = app.get(StorageService);

  const preguntas = await prisma.pregunta.findMany({
    select: { imagen: true, opciones: true },
  });
  const claves = new Set<string>();
  for (const pregunta of preguntas) {
    const candidatos = [
      pregunta.imagen,
      ...(Array.isArray(pregunta.opciones) ? pregunta.opciones : []),
    ];
    for (const candidato of candidatos) {
      if (typeof candidato === 'string' && candidato.startsWith('preguntas/')) {
        claves.add(candidato);
      }
    }
  }
  // borrar() es idempotente (que el archivo ya no exista es el resultado
  // esperado), así que no hace falta chequear antes.
  for (const clave of claves) await storage.borrar(clave);
  if (claves.size) console.log(`Imágenes borradas del storage: ${claves.size}.`);
}

async function sembrarSimaCheck() {
  // Import dinámico: sin SEED_SIMA_CHECK el seed nunca carga Nest ni el módulo
  // raíz de la app. Se reusan los services (en vez de escribir inserts crudos)
  // para no saltearse las reglas que viven en ellos: el appendeo de `orden` de
  // los niveles, la validación de opciones de las preguntas, resolverFuente, la
  // resolución de criterios y el cálculo del número AÑO.MAYOR.MENOR al activar.
  //
  // Lo que NO corre por esta vía: la ValidationPipe global, que vive en main.ts
  // y sólo se aplica a la capa HTTP. Acá el input es código propio, no de un
  // cliente, así que se acepta.
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { ReglasAsignacionService } = await import(
    '../src/asignaciones/reglas-asignacion.service'
  );
  const { BasesConocimientoService } = await import(
    '../src/bases-conocimiento/bases-conocimiento.service'
  );
  const { CentrosCostoService } = await import(
    '../src/centros-costo/centros-costo.service'
  );
  const { ModulosService } = await import('../src/modulos/modulos.service');
  const { PreguntasService } = await import(
    '../src/preguntas/preguntas.service'
  );
  const { PuestosService } = await import('../src/puestos/puestos.service');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    // El clean va con la app levantada: borrar las imágenes del storage exige
    // el StorageService, y con el driver `r2` no hay forma de hacerlo a mano.
    await limpiarSimaCheck(app);

    const bases = app.get(BasesConocimientoService);
    const preguntas = app.get(PreguntasService);
    const modulos = app.get(ModulosService);
    const puestos = app.get(PuestosService);
    const centrosCosto = app.get(CentrosCostoService);
    const reglas = app.get(ReglasAsignacionService);

    // 1) Catálogos de nómina. Se reusan los que ya estén cargados y se crean
    // sólo los que falten (el nombre es @unique, así que create tiraría 409).
    const puestoPorNombre = await resolverCatalogo(puestos, PUESTOS);
    const centroPorNombre = await resolverCatalogo(centrosCosto, CENTROS_COSTO);

    // 2) Bases de conocimiento con su escala. Los niveles se crean SIN `orden`
    // explícito: siguienteOrden() los appendea en el orden del array.
    const nivelPorClave = new Map<string, string>();
    const basePorSlug = new Map<string, { id: string; nombre: string }>();
    for (const { slug, niveles, ...datos } of BASES) {
      const base = await bases.create({ ...datos });
      basePorSlug.set(slug, base);
      for (const nombre of niveles) {
        const nivel = await bases.crearNivel(base.id, { nombre });
        nivelPorClave.set(`${slug}/${nombre}`, nivel.id);
      }
    }

    // 3) Banco de preguntas. La `fuente` NO se manda a propósito:
    // resolverFuente la copia de la base y la congela en cada pregunta.
    const subir = await crearSubidorDeImagenes(app);
    let creadas = 0;
    for (const modulo of MODULOS) {
      const base = basePorSlug.get(modulo.base)!;
      const nivelId = nivelPorClave.get(`${modulo.base}/${modulo.nivel}`)!;
      for (const pregunta of PREGUNTAS[modulo.slug]) {
        const esImagen = pregunta.tipo === TipoPregunta.OPCIONES_IMAGEN;
        await preguntas.create({
          texto: pregunta.texto,
          tipo: pregunta.tipo,
          // En OPCIONES_IMAGEN tanto las opciones como la respuesta correcta
          // son CLAVES de storage, no textos: el backend corrige comparando la
          // clave cruda (ver corregir.ts). Por eso las dos pasan por `subir`,
          // que devuelve la misma clave para el mismo archivo.
          ...(pregunta.opciones
            ? {
                opciones: esImagen
                  ? await Promise.all(pregunta.opciones.map(subir))
                  : [...pregunta.opciones],
              }
            : {}),
          respuestaCorrecta: esImagen
            ? await subir(pregunta.respuestaCorrecta)
            : pregunta.respuestaCorrecta,
          ...(pregunta.imagen ? { imagen: await subir(pregunta.imagen) } : {}),
          baseConocimientoId: base.id,
          nivelId,
        });
        creadas += 1;
      }
    }

    // 4) Los cinco módulos, cada uno lleno por su criterio y publicado.
    //
    // ⚠️ ORDEN: setCriterios exige que la versión esté en BORRADOR, así que va
    // antes de activar(). Sobre un ACTIVO tira ConflictException (resolver
    // criterios borra pivots y rompería la inmutabilidad del historial).
    const moduloPorSlug = new Map<string, { id: string; nombre: string }>();
    const versiones: {
      nombre: string;
      anio: number | null;
      mayor: number | null;
      menor: number | null;
      id: string;
    }[] = [];
    for (const { slug, base, nivel, ...datos } of MODULOS) {
      const modulo = await modulos.create({ ...datos });
      moduloPorSlug.set(slug, modulo);
      await modulos.setCriterios(modulo.id, {
        criterios: [
          {
            baseConocimientoId: basePorSlug.get(base)!.id,
            nivelId: nivelPorClave.get(`${base}/${nivel}`)!,
          },
        ],
      });
      // Sin `esNuevaLinea`: es la primera publicación, no hay un ACTIVO del cual
      // derivar el número, así que calcularNumero cae en siguienteMayor y queda
      // AÑO.01.00. Publica el snapshot tal cual: activar() NO vuelve a resolver
      // los criterios.
      const version = await modulos.activar(modulo.id);
      versiones.push({ nombre: modulo.nombre, ...version });
    }

    // 5) Reglas de asignación. Cada create abre su propia transacción y
    // recalcula el centro entero; como todavía no hay usuarios cargados, no
    // deriva ninguna Asignacion — eso pasa recién al importar la nómina.
    let reglasCreadas = 0;
    for (const regla of REGLAS) {
      const moduloId = moduloPorSlug.get(regla.modulo)!.id;
      for (const centro of regla.centros) {
        for (const puesto of regla.puestos ?? [undefined]) {
          await reglas.create(
            {
              moduloId,
              centroCostoId: centroPorNombre[centro],
              ...(puesto ? { puestoId: puestoPorNombre[puesto] } : {}),
            },
            'seed',
          );
          reglasCreadas += 1;
        }
      }
    }

    await imprimirResumenSimaCheck({
      bases: BASES.map((b) => ({
        nombre: b.nombre,
        codigo: b.codigo,
        id: basePorSlug.get(b.slug)!.id,
        niveles: b.niveles,
      })),
      versiones,
      creadas,
      reglasCreadas,
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
  nombres: readonly string[],
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

// Sube un archivo de `seed-assets/preguntas/` al storage y devuelve su clave,
// memorizando el resultado: la misma imagen se usa como opción de varias
// preguntas (los tres tachos aparecen en seis) y subirla una vez por uso
// dejaría seis copias distintas de un mismo pictograma.
//
// Va por StorageService y no escribiendo en ./uploads para que el seed funcione
// igual con el driver `local` y con `r2` — el deploy usa r2 y ahí no hay disco.
// El formato sale de los magic bytes, igual que en el upload real del
// backoffice: la extensión del archivo es un nombre, no una garantía.
async function crearSubidorDeImagenes(
  app: INestApplicationContext,
): Promise<(archivo: string) => Promise<string>> {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const { StorageService } = await import('../src/storage/storage.service');
  const { detectarFormatoImagen } = await import(
    '../src/storage/formato-imagen'
  );

  const storage = app.get(StorageService);
  const carpeta = resolve(__dirname, 'seed-assets', 'preguntas');
  const cache = new Map<string, string>();

  return async (archivo: string) => {
    const yaSubida = cache.get(archivo);
    if (yaSubida) return yaSubida;

    const buffer = await readFile(resolve(carpeta, archivo));
    const formato = detectarFormatoImagen(buffer);
    if (!formato) {
      throw new Error(
        `seed-assets/preguntas/${archivo} no es PNG, JPG ni WEBP (o está corrupto)`,
      );
    }
    const clave = await storage.guardar(buffer, 'preguntas', formato);
    cache.set(archivo, clave);
    return clave;
  };
}

// Resumen con los IDs de todo lo sembrado, para poder armar las llamadas de
// verificación (Invoke-RestMethod) sin ir a buscarlos a Prisma Studio.
async function imprimirResumenSimaCheck(datos: {
  bases: { nombre: string; codigo: string; id: string; niveles: readonly string[] }[];
  versiones: {
    nombre: string;
    id: string;
    anio: number | null;
    mayor: number | null;
    menor: number | null;
  }[];
  creadas: number;
  reglasCreadas: number;
}) {
  const { bases, versiones, creadas, reglasCreadas } = datos;
  const pad2 = (n: number | null) => String(n ?? 0).padStart(2, '0');

  // Se cuentan los pivots REALES de cada versión publicada, no lo que el seed
  // creyó sembrar: es la evidencia de que el criterio resolvió el pool entero.
  const contenido: string[] = [];
  for (const version of versiones) {
    const preguntas = await prisma.moduloVersionPregunta.count({
      where: { moduloVersionId: version.id, origen: OrigenPregunta.CRITERIO },
    });
    const numero = `${version.anio}.${pad2(version.mayor)}.${pad2(version.menor)}`;
    contenido.push(
      `  ${version.nombre.padEnd(34)} ${numero}  ${String(preguntas).padStart(3)} preguntas  ${version.id}`,
    );
  }

  const lineas = [
    '',
    '--- Contenido de SIMA CHECK sembrado (SEED_SIMA_CHECK=true) ---',
    '',
    'Bases de conocimiento:',
    ...bases.map(
      (b) =>
        `  [${b.codigo}] ${b.nombre.padEnd(34)} ${b.id}\n      niveles: ${b.niveles.join(' · ')}`,
    ),
    '',
    'Módulos publicados:',
    ...contenido,
    '',
    `Banco: ${creadas} preguntas, todas clasificadas.`,
    `Catálogos: ${PUESTOS.length} puestos, ${CENTROS_COSTO.length} centros de costo.`,
    `Reglas de asignación: ${reglasCreadas}.`,
    '',
    'Falta cargar las personas: importá la nómina desde el backoffice contra la',
    'organización "Ingeniería SIMA". Al crearlas, las reglas de arriba derivan',
    'solas las asignaciones de cada una.',
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
