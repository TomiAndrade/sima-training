import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuloVersion, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AsignarPreguntaItemDto } from './dto/asignar-preguntas.dto';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';

@Injectable()
export class ModulosService {
  constructor(private readonly prisma: PrismaService) {}

  // Crea el módulo y su ModuloVersion v1 en BORRADOR (una sola operación atómica).
  create(dto: CreateModuloDto) {
    return this.prisma.modulo.create({
      data: {
        ...dto,
        versiones: { create: { numeroVersion: 1 } },
      },
      include: { versiones: true },
    });
  }

  // Lista todos los módulos con su versión vigente (estado + número) y el id del
  // borrador en curso, si hay uno. Los campos extra son aditivos (PreguntasService
  // y el multi-select del backoffice sólo leen id/nombre).
  async findAll() {
    const modulos = await this.prisma.modulo.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activo: true,
        vigenciaMeses: true,
      },
    });
    if (modulos.length === 0) return [];

    const versiones = await this.prisma.moduloVersion.findMany({
      where: { moduloId: { in: modulos.map((m) => m.id) } },
    });
    const porModulo = new Map<string, ModuloVersion[]>();
    for (const v of versiones) {
      const arr = porModulo.get(v.moduloId) ?? [];
      arr.push(v);
      porModulo.set(v.moduloId, arr);
    }

    return modulos.map((m) => {
      const vs = porModulo.get(m.id) ?? [];
      const activo = vs.find((v) => v.estado === 'ACTIVO');
      const ultima = vs.reduce<ModuloVersion | null>(
        (acc, v) => (!acc || v.numeroVersion > acc.numeroVersion ? v : acc),
        null,
      );
      const vigente = activo ?? ultima;
      const borrador = vs.find((v) => v.estado === 'BORRADOR');
      return {
        ...m,
        vigente: vigente
          ? {
              id: vigente.id,
              estado: vigente.estado,
              anio: vigente.anio,
              mayor: vigente.mayor,
              menor: vigente.menor,
            }
          : null,
        borradorId: borrador?.id ?? null,
      };
    });
  }

  // Batch de ultimaOActivaVersion: resuelve la versión vigente de cada módulo
  // pedido en 2 queries fijas (no N+1). La usa PreguntasService para filtrar
  // y enriquecer preguntas por pertenencia a módulos.
  async versionesVigentesDe(moduloIds: string[]): Promise<ModuloVersion[]> {
    if (moduloIds.length === 0) return [];

    const activas = await this.prisma.moduloVersion.findMany({
      where: { moduloId: { in: moduloIds }, estado: 'ACTIVO' },
    });
    const resueltos = new Set(activas.map((v) => v.moduloId));
    const faltantes = moduloIds.filter((id) => !resueltos.has(id));
    if (faltantes.length === 0) return activas;

    const candidatas = await this.prisma.moduloVersion.findMany({
      where: { moduloId: { in: faltantes } },
      orderBy: { numeroVersion: 'desc' },
    });
    const porModulo = new Map<string, ModuloVersion>();
    for (const v of candidatas) {
      if (!porModulo.has(v.moduloId)) porModulo.set(v.moduloId, v);
    }
    return [...activas, ...porModulo.values()];
  }

  async findOne(id: string) {
    const modulo = await this.prisma.modulo.findUnique({ where: { id } });
    if (!modulo) {
      throw new NotFoundException(`Módulo ${id} no encontrado`);
    }

    const version = await this.versionParaEditar(id);
    const preguntas = version
      ? await this.prisma.moduloVersionPregunta.findMany({
          where: { moduloVersionId: version.id },
          include: { pregunta: true },
          orderBy: { orden: 'asc' },
        })
      : [];

    return { ...modulo, version, preguntas };
  }

  // Historial de versiones del módulo, con la cantidad de preguntas de cada una
  // (para la columna "Preguntas" del historial en el backoffice).
  async findVersiones(id: string) {
    const versiones = await this.prisma.moduloVersion.findMany({
      where: { moduloId: id },
      orderBy: { numeroVersion: 'asc' },
      include: { _count: { select: { preguntas: true } } },
    });
    return versiones.map(({ _count, ...version }) => ({
      ...version,
      preguntasCount: _count.preguntas,
    }));
  }

  // Detalle de una versión puntual + sus preguntas (para el historial).
  async findVersionOne(moduloId: string, versionId: string) {
    const version = await this.prisma.moduloVersion.findFirst({
      where: { id: versionId, moduloId },
    });
    if (!version) {
      throw new NotFoundException(
        `Versión ${versionId} no encontrada en el módulo ${moduloId}`,
      );
    }
    const preguntas = await this.prisma.moduloVersionPregunta.findMany({
      where: { moduloVersionId: version.id },
      include: { pregunta: true },
      orderBy: { orden: 'asc' },
    });
    return { ...version, preguntas };
  }

  // Edición de metadata del módulo (nombre/descripcion).
  async update(moduloId: string, dto: UpdateModuloDto) {
    try {
      return await this.prisma.modulo.update({
        where: { id: moduloId },
        data: dto,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(`Módulo ${moduloId} no encontrado`);
      }
      throw err;
    }
  }

  // Crea un BORRADOR nuevo copiando las preguntas del ACTIVO. `esNuevaLinea` se
  // guarda para saber cómo numerar al Activar (true = sube MAYOR, false = sube MENOR).
  async crearVersion(moduloId: string, esNuevaLinea: boolean) {
    const modulo = await this.prisma.modulo.findUnique({
      where: { id: moduloId },
    });
    if (!modulo) {
      throw new NotFoundException(`Módulo ${moduloId} no encontrado`);
    }

    const borrador = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'BORRADOR' },
    });
    if (borrador) {
      throw new ConflictException(
        'El módulo ya tiene un borrador en curso; activalo o descartalo antes de crear otra versión',
      );
    }

    const base = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'ACTIVO' },
    });
    if (!base) {
      throw new ConflictException(
        'El módulo no tiene una versión activa desde la cual crear un borrador',
      );
    }

    const agg = await this.prisma.moduloVersion.aggregate({
      where: { moduloId },
      _max: { numeroVersion: true },
    });
    const numeroVersion = (agg._max.numeroVersion ?? 0) + 1;

    const pivots = await this.prisma.moduloVersionPregunta.findMany({
      where: { moduloVersionId: base.id },
    });

    return this.prisma.moduloVersion.create({
      data: {
        moduloId,
        numeroVersion,
        estado: 'BORRADOR',
        esNuevaLinea,
        createdBy: 'backoffice',
        preguntas: {
          create: pivots.map((p) => ({
            preguntaId: p.preguntaId,
            orden: p.orden,
            obligatoria: p.obligatoria,
            activa: p.activa,
          })),
        },
      },
      include: {
        preguntas: { include: { pregunta: true }, orderBy: { orden: 'asc' } },
      },
    });
  }

  // Publica el BORRADOR: pasa a ACTIVO con su número AÑO.MAYOR.MENOR y archiva el
  // ACTIVO anterior. Transacción para no dejar dos ACTIVO simultáneos.
  async activar(moduloId: string) {
    const borrador = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'BORRADOR' },
    });
    if (!borrador) {
      throw new NotFoundException(
        `El módulo ${moduloId} no tiene un borrador para activar`,
      );
    }

    const activo = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'ACTIVO' },
    });

    const numero = await this.calcularNumero(moduloId, borrador, activo);

    return this.prisma.$transaction(async (tx) => {
      if (activo) {
        await tx.moduloVersion.update({
          where: { id: activo.id },
          data: { estado: 'ARCHIVADO' },
        });
      }
      return tx.moduloVersion.update({
        where: { id: borrador.id },
        data: {
          estado: 'ACTIVO',
          anio: numero.anio,
          mayor: numero.mayor,
          menor: numero.menor,
          activadaEn: new Date(),
        },
      });
    });
  }

  async asignarPreguntas(moduloId: string, items: AsignarPreguntaItemDto[]) {
    const borrador = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'BORRADOR' },
    });
    if (!borrador) {
      throw new NotFoundException(
        `El módulo ${moduloId} no tiene una versión en BORRADOR`,
      );
    }

    await this.assertPreguntasExisten(items.map((i) => i.preguntaId));

    // Los items sin `orden` se appendean al final de la versión: se resuelve el
    // orden máximo actual y se incrementa por cada item sin orden explícito.
    const agregado = await this.prisma.moduloVersionPregunta.aggregate({
      where: { moduloVersionId: borrador.id },
      _max: { orden: true },
    });
    let siguienteOrden = agregado._max.orden ?? 0;

    try {
      await this.prisma.moduloVersionPregunta.createMany({
        data: items.map((item) => ({
          moduloVersionId: borrador.id,
          preguntaId: item.preguntaId,
          orden: item.orden ?? (siguienteOrden += 1),
          obligatoria: item.obligatoria ?? true,
        })),
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Una o más preguntas ya están asignadas a esta versión del módulo',
        );
      }
      throw err;
    }

    return this.prisma.moduloVersionPregunta.findMany({
      where: { moduloVersionId: borrador.id },
      include: { pregunta: true },
      orderBy: { orden: 'asc' },
    });
  }

  // Baja lógica por módulo: activa/desactiva la asignación de la pregunta en la
  // versión que se está editando (la misma que muestra findOne: el BORRADOR si
  // hay uno en curso, si no la vigente publicada). No crea una versión nueva.
  async setPreguntaActiva(
    moduloId: string,
    preguntaId: string,
    activa: boolean,
  ) {
    const version = await this.versionParaEditar(moduloId);
    if (!version) {
      throw new NotFoundException(`El módulo ${moduloId} no tiene versiones`);
    }

    try {
      return await this.prisma.moduloVersionPregunta.update({
        where: {
          moduloVersionId_preguntaId: {
            moduloVersionId: version.id,
            preguntaId,
          },
        },
        data: { activa },
        include: { pregunta: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(
          `La pregunta ${preguntaId} no está asignada a este módulo`,
        );
      }
      throw err;
    }
  }

  // Cambia la elección de numeración (actualización/versión nueva) de un
  // borrador ya creado, sin tocar sus preguntas. Pensado para cuando el
  // backoffice recomienda pasar de "actualización" a "versión nueva" porque
  // el borrador acumuló muchos cambios respecto a la base de la que partió.
  async actualizarEleccionBorrador(moduloId: string, esNuevaLinea: boolean) {
    const borrador = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'BORRADOR' },
    });
    if (!borrador) {
      throw new NotFoundException(
        `El módulo ${moduloId} no tiene un borrador en curso`,
      );
    }
    return this.prisma.moduloVersion.update({
      where: { id: borrador.id },
      data: { esNuevaLinea },
    });
  }

  // Calcula el número público al activar el borrador.
  private async calcularNumero(
    moduloId: string,
    borrador: ModuloVersion,
    activo: ModuloVersion | null,
  ) {
    const anioActual = new Date().getFullYear();

    // Primera publicación (sin ACTIVO base con número) → AÑO.<sig mayor>.00.
    if (
      !activo ||
      activo.anio == null ||
      activo.mayor == null ||
      activo.menor == null
    ) {
      const mayor = await this.siguienteMayor(moduloId, anioActual);
      return { anio: anioActual, mayor, menor: 0 };
    }

    // Actualización (misma versión) → sube MENOR en la línea del ACTIVO.
    if (borrador.esNuevaLinea === false) {
      return { anio: activo.anio, mayor: activo.mayor, menor: activo.menor + 1 };
    }

    // Versión nueva → sube MAYOR (secuencia por año), MENOR a 0.
    const mayor = await this.siguienteMayor(moduloId, anioActual);
    return { anio: anioActual, mayor, menor: 0 };
  }

  private async siguienteMayor(moduloId: string, anio: number) {
    const agg = await this.prisma.moduloVersion.aggregate({
      where: { moduloId, anio },
      _max: { mayor: true },
    });
    return (agg._max.mayor ?? 0) + 1;
  }

  // Versión que se está editando ahora mismo: el BORRADOR en curso si existe,
  // si no la vigente publicada. La usan findOne/setPreguntaActiva para que
  // cualquier edición (agregar, desactivar) caiga siempre sobre el borrador
  // cuando hay uno — antes de esto, con un ACTIVO y un BORRADOR coexistiendo,
  // togglear una pregunta desde la vista de Preguntas afectaba por error a la
  // versión publicada en vez de al borrador que se estaba armando.
  private async versionParaEditar(moduloId: string) {
    const borrador = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'BORRADOR' },
    });
    if (borrador) return borrador;

    return this.ultimaOActivaVersion(moduloId);
  }

  // Vigente "publicado": el ACTIVO si existe, si no la última versión creada
  // (incluye un BORRADOR si el módulo nunca se publicó). A diferencia de
  // versionParaEditar, ignora si hay un borrador en curso — la usan reportes
  // y enriquecimiento (versionesVigentesDe) donde interesa lo publicado, no
  // el trabajo en progreso.
  private async ultimaOActivaVersion(moduloId: string) {
    const activa = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'ACTIVO' },
    });
    if (activa) return activa;

    return this.prisma.moduloVersion.findFirst({
      where: { moduloId },
      orderBy: { numeroVersion: 'desc' },
    });
  }

  private async assertPreguntasExisten(preguntaIds: string[]) {
    const encontradas = await this.prisma.pregunta.count({
      where: { id: { in: preguntaIds } },
    });
    if (encontradas !== new Set(preguntaIds).size) {
      throw new NotFoundException(
        'Alguna de las preguntas indicadas no existe',
      );
    }
  }
}
