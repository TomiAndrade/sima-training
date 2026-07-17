import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuloVersion, Prisma } from '@prisma/client';
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

// Carpeta bajo la que se guardan las imágenes de enunciado en el storage.
const CARPETA_IMAGENES = 'preguntas';

// Forma exacta de una clave generada por el storage. Se valida antes de borrar
// para que el endpoint no sea un borrado arbitrario de archivos.
const CLAVE_IMAGEN_RE =
  /^preguntas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

@Injectable()
export class PreguntasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modulos: ModulosService,
    private readonly storage: StorageService,
  ) {}

  // TODO(sprint futuro): detección de preguntas duplicadas/similares
  // (pg_trgm o embeddings) antes de crear. Fuera de alcance de este sprint.
  async create(dto: CreatePreguntaDto) {
    const { etiquetaIds, opciones, ...rest } = dto;
    return this.prisma.pregunta.create({
      data: {
        ...rest,
        ...(opciones ? { opciones: opciones as Prisma.InputJsonValue } : {}),
        ...(etiquetaIds?.length
          ? {
              etiquetas: {
                create: etiquetaIds.map((etiquetaId) => ({ etiquetaId })),
              },
            }
          : {}),
      },
      include: { etiquetas: { include: { etiqueta: true } } },
    });
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

    const enUso = await this.prisma.pregunta.count({
      where: { imagen: clave },
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
    // de los filtros (texto, activa, etiqueta).
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
      ...(query.etiqueta || query.categoria
        ? {
            etiquetas: {
              some: {
                ...(query.etiqueta ? { etiquetaId: query.etiqueta } : {}),
                ...(query.categoria
                  ? { etiqueta: { categoria: query.categoria } }
                  : {}),
              },
            },
          }
        : {}),
      ...(filtrosModulo.length === 1
        ? filtrosModulo[0]
        : filtrosModulo.length > 1
          ? { OR: filtrosModulo }
          : {}),
    };

    const preguntas = await this.prisma.pregunta.findMany({
      where,
      include: { etiquetas: { include: { etiqueta: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return this.enriquecerConModulos(preguntas, todasLasVersionesVigentes);
  }

  async findOne(id: string) {
    const pregunta = await this.prisma.pregunta.findUnique({
      where: { id },
      include: { etiquetas: { include: { etiqueta: true } } },
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
          include: { etiquetas: { include: { etiqueta: true } } },
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
      include: { etiquetas: { include: { etiqueta: true } } },
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
