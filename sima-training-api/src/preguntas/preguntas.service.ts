import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuloVersion, Prisma, TipoPregunta } from '@prisma/client';
import { ModulosService } from '../modulos/modulos.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  detectarFormatoImagen,
  FORMATOS_IMAGEN_LEGIBLE,
  MAX_IMAGEN_SIZE,
} from '../storage/formato-imagen';
import { StorageService } from '../storage/storage.service';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { FindAllPreguntasDto } from './dto/find-all-preguntas.dto';

// Carpeta bajo la que se guardan las imágenes de preguntas en el storage: tanto
// la del enunciado como las de las opciones de OPCIONES_IMAGEN.
const CARPETA_IMAGENES = 'preguntas';

// Tipos cuyo contenido son opciones a elegir.
const TIPOS_CON_OPCIONES: TipoPregunta[] = [
  TipoPregunta.OPCION_MULTIPLE,
  TipoPregunta.OPCIONES_IMAGEN,
];

const MIN_OPCIONES = 2;

// Forma exacta de una clave generada por el storage. Se valida antes de borrar
// para que el endpoint no sea un borrado arbitrario de archivos.
const CLAVE_IMAGEN_RE =
  /^preguntas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

// La clasificación viaja igual en todas las respuestas (listado, detalle,
// alta, papelera), para que el backoffice pueda pintar el badge base·nivel sin
// tener que resolver ids contra el catálogo.
const PREGUNTA_CLASIFICACION = {
  base: { select: { id: true, nombre: true, codigo: true, color: true } },
  nivel: { select: { id: true, nombre: true, orden: true } },
} satisfies Prisma.PreguntaInclude;

@Injectable()
export class PreguntasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modulos: ModulosService,
    private readonly storage: StorageService,
  ) {}

  // Reglas cruzadas entre campos, que el DTO no puede expresar (class-validator
  // valida campo a campo). Importa sobre todo desde que las opciones de
  // OPCIONES_IMAGEN son claves de storage: con textos legibles un
  // desalineamiento entre respuestaCorrecta y opciones se veía a simple vista;
  // con claves opacas es invisible y rompe la corrección de la evaluación.
  private validarOpciones(dto: CreatePreguntaDto) {
    if (!TIPOS_CON_OPCIONES.includes(dto.tipo)) return;

    const opciones = dto.opciones ?? [];
    if (opciones.length < MIN_OPCIONES) {
      throw new BadRequestException(
        `Una pregunta de tipo ${dto.tipo} requiere al menos ${MIN_OPCIONES} opciones`,
      );
    }
    // respuestaCorrecta sigue siendo opcional (TEXTO_LIBRE puede no tener una
    // fija); lo que no se admite es que apunte a algo que no está.
    if (dto.respuestaCorrecta && !opciones.includes(dto.respuestaCorrecta)) {
      throw new BadRequestException(
        'La respuesta correcta debe ser una de las opciones',
      );
    }
  }

  // TODO(sprint futuro): detección de preguntas duplicadas/similares
  // (pg_trgm o embeddings) antes de crear. Fuera de alcance de este sprint.
  async create(dto: CreatePreguntaDto) {
    this.validarOpciones(dto);
    const { opciones, ...rest } = dto;
    const fuente = await this.resolverFuente(dto);
    try {
      return await this.prisma.pregunta.create({
        data: {
          ...rest,
          ...(fuente !== undefined ? { fuente } : {}),
          ...(opciones ? { opciones: opciones as Prisma.InputJsonValue } : {}),
        },
        include: PREGUNTA_CLASIFICACION,
      });
    } catch (err) {
      throw this.traducirErrorDeClasificacion(err);
    }
  }

  // La coherencia base↔nivel la garantiza la base de datos (FK compuesta +
  // CHECK), no una consulta previa acá: un chequeo en memoria no sobrevive a
  // dos altas concurrentes. Lo que sí corresponde es que esos rechazos salgan
  // como 400 y no como 500 — son input inválido del cliente, no una falla del
  // servidor.
  private traducirErrorDeClasificacion(err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      return new BadRequestException(
        'La base de conocimiento o el nivel no existen, o el nivel no pertenece a esa base',
      );
    }
    // El CHECK no tiene código de Prisma (llega como error crudo de Postgres,
    // 23514), así que se lo identifica por el nombre de la constraint.
    if (
      err instanceof Prisma.PrismaClientUnknownRequestError &&
      String(err.message).includes('preguntas_nivel_requiere_base')
    ) {
      return new BadRequestException(
        'No se puede indicar un nivel sin indicar la base de conocimiento a la que pertenece',
      );
    }
    return err;
  }

  // La `fuente` de una pregunta se congela al crearla: se copia de la base si
  // el alta no trae una propia. La base dice de qué manual sale el temario HOY
  // y esa columna se edita cuando sale una revisión nueva; sin esta copia, una
  // pregunta vieja ya mandada a papelera terminaría mostrando el manual que
  // justamente la dejó obsoleta.
  private async resolverFuente(dto: CreatePreguntaDto) {
    if (dto.fuente !== undefined) return dto.fuente;
    if (!dto.baseConocimientoId) return undefined;
    const base = await this.prisma.baseConocimiento.findUnique({
      where: { id: dto.baseConocimientoId },
      select: { fuente: true },
    });
    return base?.fuente ?? undefined;
  }

  // Sube la imagen de un enunciado y devuelve su clave, para mandarla después
  // en el `imagen` del POST /preguntas. Va separado del alta (y no como un
  // multipart único) para que crear la pregunta siga siendo el mismo JSON de
  // siempre, y para poder mostrar el preview antes de confirmar.
  async subirImagen(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    // Redundante con el límite de multer (que aborta antes), pero deja el
    // mensaje en castellano si esa red se corre o falla.
    if (file.size > MAX_IMAGEN_SIZE) {
      throw new BadRequestException(
        `La imagen supera el máximo de ${MAX_IMAGEN_SIZE / 1024 / 1024} MB`,
      );
    }

    const formato = detectarFormatoImagen(file.buffer);
    if (!formato) {
      throw new BadRequestException(
        `El archivo no es una imagen válida. Formatos aceptados: ${FORMATOS_IMAGEN_LEGIBLE}`,
      );
    }

    const imagen = await this.storage.guardar(
      file.buffer,
      CARPETA_IMAGENES,
      formato,
    );
    return { imagen };
  }

  // Limpieza de huérfanas: la imagen se sube antes de crear la pregunta, así
  // que si el alta falla queda un archivo sin dueño. Solo borra eso — una
  // imagen ya referenciada por una pregunta es inmutable (las versiones
  // ARCHIVADO comparten el mismo preguntaId y no deben cambiar).
  async borrarImagen(clave: string) {
    if (!CLAVE_IMAGEN_RE.test(clave)) {
      throw new BadRequestException(`Clave de imagen inválida: ${clave}`);
    }

    // Una clave puede estar referenciada desde dos lugares: el enunciado
    // (columna `imagen`) o una opción de OPCIONES_IMAGEN (dentro del jsonb
    // `opciones`). Mirar solo la columna dejaría borrar una imagen de opción
    // en uso, rompiendo la pregunta en silencio.
    const enUso = await this.prisma.pregunta.count({
      where: {
        OR: [{ imagen: clave }, { opciones: { array_contains: clave } }],
      },
    });
    if (enUso > 0) {
      throw new ConflictException(
        'La imagen está en uso por una pregunta y no se puede borrar. Para cambiarla, mandá la pregunta a papelera y creá una nueva.',
      );
    }

    await this.storage.borrar(clave);
    return { borrada: true };
  }

  async findAll(query: FindAllPreguntasDto) {
    // Vigentes de TODOS los módulos: hace falta siempre para enriquecer la
    // respuesta, y también para resolver moduloId/sinAsignar — se calcula acá
    // una sola vez y se reutiliza, en vez de que cada filtro dispare su
    // propia consulta.
    const todosLosModulos = await this.modulos.findAll();
    const todasLasVersionesVigentes = await this.modulos.versionesVigentesDe(
      todosLosModulos.map((m) => m.id),
    );

    // moduloId y sinAsignar se combinan con OR entre sí (preguntas de tal
    // módulo O sin asignar), y ese resultado se combina con AND con el resto
    // de los filtros (texto, activa).
    const filtrosModulo: Prisma.PreguntaWhereInput[] = [];
    if (query.moduloId?.length) {
      const idsSeleccionados = todasLasVersionesVigentes
        .filter((v) => query.moduloId!.includes(v.moduloId))
        .map((v) => v.id);
      filtrosModulo.push({
        versiones: { some: { moduloVersionId: { in: idsSeleccionados } } },
      });
    }
    if (query.sinAsignar) {
      filtrosModulo.push({
        versiones: {
          none: {
            moduloVersionId: {
              in: todasLasVersionesVigentes.map((v) => v.id),
            },
          },
        },
      });
    }

    const where: Prisma.PreguntaWhereInput = {
      ...(query.q ? { texto: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.activa !== undefined ? { activa: query.activa } : {}),
      // Clasificación: se combinan con AND entre sí y con el resto (a
      // diferencia de moduloId/sinAsignar, que van con OR). `sinBase` es lo que
      // permite encontrar el backlog de preguntas cargadas antes de que las
      // bases existieran.
      ...(query.baseId ? { baseConocimientoId: query.baseId } : {}),
      ...(query.nivelId ? { nivelId: query.nivelId } : {}),
      ...(query.sinBase ? { baseConocimientoId: null } : {}),
      ...(filtrosModulo.length === 1
        ? filtrosModulo[0]
        : filtrosModulo.length > 1
          ? { OR: filtrosModulo }
          : {}),
    };

    const preguntas = await this.prisma.pregunta.findMany({
      where,
      include: PREGUNTA_CLASIFICACION,
      orderBy: { createdAt: 'desc' },
    });

    return this.enriquecerConModulos(preguntas, todasLasVersionesVigentes);
  }

  async findOne(id: string) {
    const pregunta = await this.prisma.pregunta.findUnique({
      where: { id },
      include: PREGUNTA_CLASIFICACION,
    });
    if (!pregunta) {
      throw new NotFoundException(`Pregunta ${id} no encontrada`);
    }
    return pregunta;
  }

  // Papelera global. activa=false: cascada a los pivots de la pregunta en
  // versiones BORRADOR/ACTIVO (todas sus asignaciones vigentes, cualquier
  // módulo) — nunca ARCHIVADO, esas versiones son inmutables y no deben
  // mutarse aunque sea para dar de baja una pregunta. activa=true: NO
  // restaura los pivots (asimetría intencional; el admin reactiva módulo por
  // módulo).
  async setActiva(id: string, activa: boolean) {
    await this.findOne(id);

    if (!activa) {
      return this.prisma.$transaction(async (tx) => {
        const pregunta = await tx.pregunta.update({
          where: { id },
          data: { activa: false },
          include: PREGUNTA_CLASIFICACION,
        });
        await tx.moduloVersionPregunta.updateMany({
          where: {
            preguntaId: id,
            moduloVersion: { estado: { not: 'ARCHIVADO' } },
          },
          data: { activa: false },
        });
        return pregunta;
      });
    }

    return this.prisma.pregunta.update({
      where: { id },
      data: { activa: true },
      include: PREGUNTA_CLASIFICACION,
    });
  }

  // Enriquece cada pregunta con los módulos a los que está asignada
  // actualmente (versión vigente de cada módulo), para la columna "Módulos"
  // del backoffice. Recibe las versiones vigentes ya resueltas por el
  // llamador (findAll ya las necesita para sus propios filtros) y hace una
  // única query de pivots, para evitar N+1.
  private async enriquecerConModulos<T extends { id: string }>(
    preguntas: T[],
    versiones: ModuloVersion[],
  ): Promise<
    (T & {
      modulos: {
        moduloId: string;
        moduloNombre: string;
        activaEnModulo: boolean;
        estadoModulo: string;
        totalActivasEnModulo: number;
      }[];
    })[]
  > {
    if (preguntas.length === 0) return [];
    if (versiones.length === 0) {
      return preguntas.map((p) => ({ ...p, modulos: [] }));
    }

    const pivots = await this.prisma.moduloVersionPregunta.findMany({
      where: {
        preguntaId: { in: preguntas.map((p) => p.id) },
        moduloVersionId: { in: versiones.map((v) => v.id) },
      },
      include: { moduloVersion: { include: { modulo: true } } },
    });

    // Cuántas preguntas activas quedan en cada versión de módulo — para que
    // el backoffice pueda avisar si mandar una a papelera deja el módulo en 0.
    const conteos = await this.prisma.moduloVersionPregunta.groupBy({
      by: ['moduloVersionId'],
      where: {
        moduloVersionId: {
          in: [...new Set(pivots.map((p) => p.moduloVersionId))],
        },
        activa: true,
      },
      _count: { _all: true },
    });
    const activasPorVersion = new Map(
      conteos.map((c) => [c.moduloVersionId, c._count._all]),
    );

    const mapa = new Map<
      string,
      {
        moduloId: string;
        moduloNombre: string;
        activaEnModulo: boolean;
        estadoModulo: string;
        totalActivasEnModulo: number;
      }[]
    >();
    for (const pivot of pivots) {
      const lista = mapa.get(pivot.preguntaId) ?? [];
      lista.push({
        moduloId: pivot.moduloVersion.modulo.id,
        moduloNombre: pivot.moduloVersion.modulo.nombre,
        activaEnModulo: pivot.activa,
        estadoModulo: pivot.moduloVersion.estado,
        totalActivasEnModulo: activasPorVersion.get(pivot.moduloVersionId) ?? 0,
      });
      mapa.set(pivot.preguntaId, lista);
    }

    return preguntas.map((p) => ({ ...p, modulos: mapa.get(p.id) ?? [] }));
  }
}
