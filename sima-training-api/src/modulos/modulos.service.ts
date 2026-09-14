import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Modulo, ModuloVersion, Prisma } from '@prisma/client';
import { ActorIdentidad } from '../audit/actor-de-identidad';
import { AuditService } from '../audit/audit.service';
import { calcularDiff, Diff, hayCambios } from '../audit/calcular-diff';
import { CAMPOS_TRAZABILIDAD_IGNORADOS } from '../audit/campos-trazabilidad';
import { PrismaService } from '../prisma/prisma.service';
import { AsignarPreguntaItemDto } from './dto/asignar-preguntas.dto';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { ParametrosExamenDto } from './dto/parametros-examen.dto';
import { SetCriteriosDto } from './dto/set-criterios.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';

// La clasificación viaja resuelta en todo criterio que se devuelve, para que el
// backoffice pinte "Seguridad Operativa · Básico" sin ir a buscar los nombres al
// catálogo. Mismo criterio que PREGUNTA_CLASIFICACION en PreguntasService.
const CRITERIO_INCLUDE = {
  base: { select: { id: true, nombre: true, codigo: true, color: true } },
  nivel: { select: { id: true, nombre: true, orden: true } },
} satisfies Prisma.ModuloVersionCriterioInclude;

// Sentinel para detectar criterios repetidos DENTRO del payload. No se puede usar
// `nivelId` crudo en la clave porque undefined y null son el mismo criterio
// ("cualquier nivel") y tienen que colisionar entre sí.
const claveCriterio = (baseConocimientoId: string, nivelId?: string | null) =>
  `${baseConocimientoId}::${nivelId ?? '*'}`;

// Mismo criterio que organizacionEscalar/reglaEscalar: picking explícito, nunca
// un spread de la fila entera (acá además traería `versiones` si el caller pasó
// un Modulo con esa relación incluida).
function moduloEscalar(m: Modulo): Record<string, unknown> {
  return {
    id: m.id,
    nombre: m.nombre,
    descripcion: m.descripcion,
    activo: m.activo,
    vigenciaMeses: m.vigenciaMeses,
    demoPublico: m.demoPublico,
    createdAt: m.createdAt,
    createdBy: m.createdBy,
  };
}

// Columnas PROPIAS de ModuloVersion: ciclo de vida, numeración pública y "cómo
// se rinde". El CONTENIDO (preguntas/criterios) no son columnas de esta fila —
// sus cambios se auditan aparte, ver auditarContenidoModuloVersion.
function moduloVersionEscalar(v: ModuloVersion): Record<string, unknown> {
  return {
    id: v.id,
    moduloId: v.moduloId,
    numeroVersion: v.numeroVersion,
    estado: v.estado,
    anio: v.anio,
    mayor: v.mayor,
    menor: v.menor,
    activadaEn: v.activadaEn,
    esNuevaLinea: v.esNuevaLinea,
    preguntasPorExamen: v.preguntasPorExamen,
    umbralAprobacion: v.umbralAprobacion,
    maxIntentos: v.maxIntentos,
    esperaEntreIntentosMinutos: v.esperaEntreIntentosMinutos,
    createdAt: v.createdAt,
    createdBy: v.createdBy,
  };
}

@Injectable()
export class ModulosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Crea el módulo y su ModuloVersion v1 en BORRADOR (una sola operación atómica).
  //
  // Los parámetros de examen se destructuran aparte y NO entran en el spread: son
  // columnas de la versión, no del módulo. Un `...dto` a secas los mandaría a
  // modulo.create y Prisma rechazaría el campo desconocido.
  create(dto: CreateModuloDto, actorIdentidad?: ActorIdentidad) {
    const {
      preguntasPorExamen,
      umbralAprobacion,
      maxIntentos,
      esperaEntreIntentosMinutos,
      ...modulo
    } = dto;

    return this.prisma.$transaction(async (tx) => {
      const creado = await tx.modulo.create({
        data: {
          ...modulo,
          versiones: {
            create: {
              numeroVersion: 1,
              preguntasPorExamen,
              umbralAprobacion,
              maxIntentos,
              esperaEntreIntentosMinutos,
            },
          },
        },
        include: { versiones: true },
      });
      // Dos entidades cambian en un solo request — Modulo (el contenedor) y su
      // ModuloVersion v1 (el contenido) — así que son dos filas, cada una con
      // su propio entidadId. Mismo criterio que Usuario/Vinculacion en un alta.
      await this.auditarModulo(tx, 'CREATE', null, creado, actorIdentidad);
      await this.auditarModuloVersion(
        tx,
        'CREATE',
        null,
        creado.versiones[0],
        actorIdentidad,
      );
      return creado;
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
        // El select es explícito, así que un campo nuevo del modelo NO aparece
        // solo: sin esta línea la pantalla Módulos no podría mostrar ni editar
        // el tilde de demo. (create/update sí lo pasan por spread del DTO.)
        demoPublico: true,
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
              // Aditivo: es lo que le permite al modal "Ver detalles" resumir
              // cómo se rinde el módulo sin entrar a la vista de contenido.
              preguntasPorExamen: vigente.preguntasPorExamen,
              umbralAprobacion: vigente.umbralAprobacion,
              maxIntentos: vigente.maxIntentos,
              esperaEntreIntentosMinutos: vigente.esperaEntreIntentosMinutos,
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
    const criterios = version ? await this.criteriosDe(version.id) : [];

    return { ...modulo, version, preguntas, criterios };
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
    const criterios = await this.criteriosDe(version.id);
    return { ...version, preguntas, criterios };
  }

  // Edición de metadata del módulo (nombre/descripcion).
  async update(
    moduloId: string,
    dto: UpdateModuloDto,
    actorIdentidad?: ActorIdentidad,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // El "antes" DENTRO de la transacción reemplaza el catch(P2025) de
      // antes: mismo 404, pero ahora hay una lectura previa para el diff de
      // auditoría (mismo criterio que Organizacion/ReglaAsignacion).
      const antes = await tx.modulo.findUnique({ where: { id: moduloId } });
      if (!antes) {
        throw new NotFoundException(`Módulo ${moduloId} no encontrado`);
      }
      const actualizado = await tx.modulo.update({
        where: { id: moduloId },
        data: dto,
      });
      await this.auditarModulo(tx, 'UPDATE', antes, actualizado, actorIdentidad);
      return actualizado;
    });
  }

  // Crea un BORRADOR nuevo copiando las preguntas del ACTIVO. La elección de
  // cómo numerarlo (actualización/versión nueva) se pospone a `activar` — acá
  // no se pregunta nada, para no obligar a decidir antes de saber cuánto se
  // va a terminar cambiando.
  async crearVersion(moduloId: string, actorIdentidad?: ActorIdentidad) {
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
    const criterios = await this.prisma.moduloVersionCriterio.findMany({
      where: { moduloVersionId: base.id },
    });

    return this.prisma.$transaction(async (tx) => {
      const nueva = await tx.moduloVersion.create({
        data: {
          moduloId,
          numeroVersion,
          estado: 'BORRADOR',
          createdBy: 'backoffice',
          // Los parámetros de examen se HEREDAN del ACTIVO, igual que las
          // preguntas y los criterios: un borrador es la foto de lo
          // publicado. Sin esto, editar un módulo le resetearía el umbral (y
          // el tope de intentos) al default global en silencio, que es lo
          // último que uno quiere descubrir después de publicar.
          preguntasPorExamen: base.preguntasPorExamen,
          umbralAprobacion: base.umbralAprobacion,
          maxIntentos: base.maxIntentos,
          esperaEntreIntentosMinutos: base.esperaEntreIntentosMinutos,
          preguntas: {
            create: pivots.map((p) => ({
              preguntaId: p.preguntaId,
              orden: p.orden,
              obligatoria: p.obligatoria,
              activa: p.activa,
              origen: p.origen,
            })),
          },
          // Los criterios se copian JUNTO con los pivots ya materializados y
          // NO se vuelven a resolver: el borrador nace como la foto exacta
          // de lo publicado. Que las preguntas nuevas de una base no entren
          // solas es el costo aceptado del snapshot (ver
          // docs/pendientes.md) — entran recién cuando el admin vuelve a
          // guardar los criterios desde el borrador, que es un acto
          // explícito y previsualizado.
          criterios: {
            create: criterios.map((c) => ({
              baseConocimientoId: c.baseConocimientoId,
              nivelId: c.nivelId,
              createdBy: 'backoffice',
            })),
          },
        },
        include: {
          preguntas: { include: { pregunta: true }, orderBy: { orden: 'asc' } },
          criterios: { include: CRITERIO_INCLUDE },
        },
      });
      await this.auditarModuloVersion(tx, 'CREATE', null, nueva, actorIdentidad);
      return nueva;
    });
  }

  // Publica el BORRADOR: pasa a ACTIVO con su número AÑO.MAYOR.MENOR y archiva el
  // ACTIVO anterior. Transacción para no dejar dos ACTIVO simultáneos.
  // `esNuevaLinea` (actualización/versión nueva) se decide recién acá, no al
  // crear el borrador — es obligatorio solo cuando ya hay un ACTIVO publicado
  // del cual derivar el número; en la primera publicación no hay de qué elegir.
  async activar(
    moduloId: string,
    esNuevaLinea?: boolean,
    actorIdentidad?: ActorIdentidad,
  ) {
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

    if (activo && esNuevaLinea == null) {
      throw new ConflictException(
        'Elegí si esta versión es una actualización o una versión nueva antes de activarla',
      );
    }

    const numero = await this.calcularNumero(moduloId, esNuevaLinea, activo);

    return this.prisma.$transaction(async (tx) => {
      if (activo) {
        const archivada = await tx.moduloVersion.update({
          where: { id: activo.id },
          data: { estado: 'ARCHIVADO' },
        });
        await this.auditarModuloVersion(
          tx,
          'UPDATE',
          activo,
          archivada,
          actorIdentidad,
        );
      }
      const publicada = await tx.moduloVersion.update({
        where: { id: borrador.id },
        data: {
          estado: 'ACTIVO',
          esNuevaLinea: activo ? esNuevaLinea : null,
          anio: numero.anio,
          mayor: numero.mayor,
          menor: numero.menor,
          activadaEn: new Date(),
        },
      });
      // Dos filas posibles, cada una con su propio entidadId — no es "una
      // acción, un log" sino "dos entidades ModuloVersion cambiaron" (la que
      // se archiva y la que se publica), cuando hay una ACTIVO previa.
      await this.auditarModuloVersion(
        tx,
        'UPDATE',
        borrador,
        publicada,
        actorIdentidad,
      );
      return publicada;
    });
  }

  async asignarPreguntas(
    moduloId: string,
    items: AsignarPreguntaItemDto[],
    actorIdentidad?: ActorIdentidad,
  ) {
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

    return this.prisma.$transaction(async (tx) => {
      try {
        await tx.moduloVersionPregunta.createMany({
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

      // UNA fila para todo el llamado, no una por pregunta asignada — mismo
      // criterio que setCriterios: lo que cambió es el CONTENIDO de esta
      // versión, y eso es un solo hecho de auditoría aunque mueva varias
      // filas de ModuloVersionPregunta (que no es una entidad auditada).
      await this.auditarContenidoModuloVersion(
        tx,
        borrador.id,
        {
          preguntas: {
            antes: null,
            despues: { agregadas: items.map((i) => i.preguntaId) },
          },
        },
        actorIdentidad,
      );

      return tx.moduloVersionPregunta.findMany({
        where: { moduloVersionId: borrador.id },
        include: { pregunta: true },
        orderBy: { orden: 'asc' },
      });
    });
  }

  // Baja lógica por módulo: activa/desactiva la asignación de la pregunta en la
  // versión que se está editando (la misma que muestra findOne: el BORRADOR si
  // hay uno en curso, si no la vigente publicada). No crea una versión nueva.
  async setPreguntaActiva(
    moduloId: string,
    preguntaId: string,
    activa: boolean,
    actorIdentidad?: ActorIdentidad,
  ) {
    const version = await this.versionParaEditar(moduloId);
    if (!version) {
      throw new NotFoundException(`El módulo ${moduloId} no tiene versiones`);
    }

    // No se puede reactivar la asignación de una pregunta que sigue en la
    // papelera global: quedaría "activa" en este módulo mientras el banco la
    // sigue mostrando dada de baja. Hay que recuperarla desde Preguntas primero.
    if (activa) {
      const pregunta = await this.prisma.pregunta.findUnique({
        where: { id: preguntaId },
      });
      if (!pregunta) {
        throw new NotFoundException(`Pregunta ${preguntaId} no encontrada`);
      }
      if (!pregunta.activa) {
        throw new ConflictException(
          `La pregunta ${preguntaId} está en la papelera global. Recuperala desde Preguntas antes de reactivarla en un módulo.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let actualizado;
      try {
        actualizado = await tx.moduloVersionPregunta.update({
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

      await this.auditarContenidoModuloVersion(
        tx,
        version.id,
        {
          pregunta: {
            antes: { id: preguntaId, activa: !activa },
            despues: { id: preguntaId, activa },
          },
        },
        actorIdentidad,
      );

      return actualizado;
    });
  }

  // Unassign duro: saca la pregunta del borrador (borra el pivot, no lo
  // desactiva). Solo sobre BORRADOR — las versiones publicadas (ACTIVO/
  // ARCHIVADO) son inmutables, ahí la única baja posible es la lógica
  // (`setPreguntaActiva`). Complementa la baja lógica: mientras se arma un
  // borrador, "Desactivar" deja la fila (atenuada, se puede reactivar) y
  // "Quitar" la saca del todo — evita que el editor se llene de preguntas
  // descartadas que ya nadie va a reactivar.
  async unassignPregunta(
    moduloId: string,
    preguntaId: string,
    actorIdentidad?: ActorIdentidad,
  ) {
    const version = await this.versionParaEditar(moduloId);
    if (!version) {
      throw new NotFoundException(`El módulo ${moduloId} no tiene versiones`);
    }
    if (version.estado !== 'BORRADOR') {
      throw new ConflictException(
        'Solo se puede quitar una pregunta de un borrador; las versiones publicadas son inmutables (usá "Desactivar")',
      );
    }

    const pivot = await this.prisma.moduloVersionPregunta.findUnique({
      where: {
        moduloVersionId_preguntaId: {
          moduloVersionId: version.id,
          preguntaId,
        },
      },
    });
    if (!pivot) {
      throw new NotFoundException(
        `La pregunta ${preguntaId} no está asignada a este módulo`,
      );
    }

    // Una pregunta que trajo un criterio no se saca de a una: la próxima
    // resolución la vuelve a materializar y el borrado no habría servido de
    // nada. El mensaje dice explícitamente que la vía es "Desactivar" y —lo
    // que importa— que esa baja SOBREVIVE a las resoluciones siguientes
    // (resolverCriterios no toca los pivots que siguen matcheando). Sin esa
    // segunda mitad, alguien que quiere sacar UNA pregunta va a terminar
    // borrando el criterio entero, que se lleva puestas todas las demás.
    if (pivot.origen === 'CRITERIO') {
      throw new ConflictException(
        'Esta pregunta la trajo un criterio del módulo, así que quitarla no sirve: la próxima vez que se guarden los criterios vuelve. Usá "Desactivar" — la pregunta queda fuera de la evaluación y esa baja se mantiene aunque se vuelvan a guardar los criterios. Si lo que sobra es el tema entero, sacá el criterio.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.moduloVersionPregunta.delete({
        where: {
          moduloVersionId_preguntaId: {
            moduloVersionId: version.id,
            preguntaId,
          },
        },
      });
      await this.auditarContenidoModuloVersion(
        tx,
        version.id,
        { pregunta: { antes: { id: preguntaId }, despues: null } },
        actorIdentidad,
      );
    });
  }

  // Cómo se rinde la versión que se está editando: cuántas preguntas sortea el
  // examen, con qué porcentaje se aprueba, cuántos reintentos hay y cuánto se
  // espera entre uno y otro.
  //
  // Mismo guard que setCriterios/unassignPregunta y por el mismo motivo: son
  // parámetros CONGELADOS con la versión. Cambiarle el umbral a un ACTIVO haría
  // que dos personas que rindieron el mismo examen publicado se aprueben con
  // reglas distintas sin que nada lo registre. Se cambia creando una versión
  // nueva (POST /:id/versiones), que los hereda y deja editarlos en el borrador.
  //
  // Es un reemplazo COMPLETO, no un PATCH: lo que no viene se normaliza a null
  // (= volver al default global), igual que PUT /:id/criterios con un array
  // vacío. Sin el `?? null`, Prisma dropea los undefined y un campo borrado
  // desde el backoffice se quedaría con el valor viejo.
  async setParametrosExamen(
    moduloId: string,
    dto: ParametrosExamenDto,
    actorIdentidad?: ActorIdentidad,
  ) {
    const version = await this.versionParaEditar(moduloId);
    if (!version) {
      throw new NotFoundException(`El módulo ${moduloId} no tiene versiones`);
    }
    if (version.estado !== 'BORRADOR') {
      throw new ConflictException(
        'Solo se pueden editar los parámetros de examen de un borrador; las versiones publicadas son inmutables. Creá una versión nueva para cambiar cómo se rinde el módulo.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.moduloVersion.update({
        where: { id: version.id },
        data: {
          preguntasPorExamen: dto.preguntasPorExamen ?? null,
          umbralAprobacion: dto.umbralAprobacion ?? null,
          maxIntentos: dto.maxIntentos ?? null,
          esperaEntreIntentosMinutos: dto.esperaEntreIntentosMinutos ?? null,
        },
      });
      // `version` (ya fetched arriba por versionParaEditar) alcanza como
      // "antes" — no hace falta una lectura extra dentro de la transacción.
      await this.auditarModuloVersion(
        tx,
        'UPDATE',
        version,
        actualizada,
        actorIdentidad,
      );
      return actualizada;
    });
  }

  // Reemplaza el set COMPLETO de criterios de la versión que se está editando y
  // materializa el pool resultante en el acto (ver resolverCriterios).
  //
  // Mismo guard que unassignPregunta, y por el mismo motivo: resolver criterios
  // crea y BORRA pivots, así que sobre un ACTIVO/ARCHIVADO rompería la
  // inmutabilidad del historial. Un módulo publicado se cambia creando un
  // borrador (POST /:id/versiones) y editando ahí.
  async setCriterios(
    moduloId: string,
    dto: SetCriteriosDto,
    actorIdentidad?: ActorIdentidad,
  ) {
    const version = await this.versionParaEditar(moduloId);
    if (!version) {
      throw new NotFoundException(`El módulo ${moduloId} no tiene versiones`);
    }
    if (version.estado !== 'BORRADOR') {
      throw new ConflictException(
        'Solo se pueden editar los criterios de un borrador; las versiones publicadas son inmutables. Creá una versión nueva para cambiar qué evalúa el módulo.',
      );
    }

    // Los índices de la tabla ya lo prohíben, pero el P2002 no distingue "lo
    // mandaste dos veces" de "chocó con otra cosa". Se chequea antes para
    // devolver un 400 que se entienda.
    const vistos = new Set<string>();
    for (const c of dto.criterios) {
      const clave = claveCriterio(c.baseConocimientoId, c.nivelId);
      if (vistos.has(clave)) {
        throw new BadRequestException(
          'Hay criterios repetidos: la misma base con el mismo nivel aparece más de una vez',
        );
      }
      vistos.add(clave);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.moduloVersionCriterio.deleteMany({
          where: { moduloVersionId: version.id },
        });
        if (dto.criterios.length > 0) {
          await tx.moduloVersionCriterio.createMany({
            data: dto.criterios.map((c) => ({
              moduloVersionId: version.id,
              baseConocimientoId: c.baseConocimientoId,
              nivelId: c.nivelId ?? null,
              createdBy: 'backoffice',
            })),
          });
        }

        const resolucion = await this.resolverCriterios(tx, version.id);
        const criterios = await tx.moduloVersionCriterio.findMany({
          where: { moduloVersionId: version.id },
          include: CRITERIO_INCLUDE,
        });

        // UNA fila para todo el llamado, nunca una por pregunta movida:
        // resolverCriterios() ya devuelve el resumen agregado
        // (agregadas/quitadas), así que ESO es el diff — no hace falta (ni
        // se quiere) una entrada por cada ModuloVersionPregunta tocada.
        // Un guardado idempotente (0 agregadas, 0 quitadas) no genera fila.
        if (resolucion.agregadas > 0 || resolucion.quitadas > 0) {
          await this.auditarContenidoModuloVersion(
            tx,
            version.id,
            {
              preguntas: {
                antes: null,
                despues: {
                  agregadas: resolucion.agregadas,
                  quitadas: resolucion.quitadas,
                },
              },
            },
            actorIdentidad,
          );
        }

        return { version, criterios, resolucion };
      });
    } catch (err) {
      throw this.traducirErrorDeCriterio(err);
    }
  }

  // Materializa el pool de preguntas que declaran los criterios de la versión.
  // Es un UPSERT, no un replace, y ahí está toda la sutileza:
  //
  //   - pregunta que matchea y YA tiene pivot CRITERIO → no se toca. Es lo que
  //     preserva un `activa: false` puesto a mano y lo que hace que correr esto
  //     dos veces seguidas no cambie nada.
  //   - pregunta que matchea y no tiene ningún pivot → se agrega como CRITERIO.
  //   - pivot CRITERIO que ya no matchea ningún criterio → se BORRA, esté activo
  //     o desactivado. El pivot es estado derivado: sacado el criterio se queda
  //     sin ninguna razón de estar, y desactivado sería una fila
  //     invisible-pero-presente que alguien puede reactivar sin nada que la
  //     respalde. Si la pregunta igual importa, se vuelve a agregar desde el
  //     banco y queda MANUAL, que es la verdad.
  //   - pivot MANUAL → NUNCA se toca, ni para agregarlo ni para borrarlo. Misma
  //     regla que recalcular() con las Asignacion MANUAL.
  //
  // El pool sólo toma preguntas con `activa: true`: una en papelera global no
  // sirve en ningún módulo. Es literalmente el mismo filtro que
  // GET /preguntas?baseId=&nivelId=&activa=true, a propósito — el backoffice
  // previsualiza con ese endpoint y así no hace falta uno de dry-run.
  private async resolverCriterios(
    tx: Prisma.TransactionClient,
    versionId: string,
  ) {
    const criterios = await tx.moduloVersionCriterio.findMany({
      where: { moduloVersionId: versionId },
    });

    // Unión de los pools: una pregunta pedida por dos criterios entra una sola
    // vez (el pivot tiene PK compuesta, no podría duplicarse igual).
    const requeridas = new Set<string>();
    const porCriterio: {
      criterioId: string;
      baseConocimientoId: string;
      nivelId: string | null;
      preguntas: number;
    }[] = [];
    for (const c of criterios) {
      const preguntas = await tx.pregunta.findMany({
        where: {
          activa: true,
          baseConocimientoId: c.baseConocimientoId,
          // Sin nivel el criterio es "cualquier nivel de esta base", así que la
          // condición no se agrega en vez de compararse contra null (eso
          // matchearía sólo las preguntas SIN nivel).
          ...(c.nivelId ? { nivelId: c.nivelId } : {}),
        },
        select: { id: true },
      });
      preguntas.forEach((p) => requeridas.add(p.id));
      porCriterio.push({
        criterioId: c.id,
        baseConocimientoId: c.baseConocimientoId,
        nivelId: c.nivelId,
        preguntas: preguntas.length,
      });
    }

    const pivots = await tx.moduloVersionPregunta.findMany({
      where: { moduloVersionId: versionId },
    });
    const deCriterio = pivots.filter((p) => p.origen === 'CRITERIO');
    const yaDeCriterio = new Set(deCriterio.map((p) => p.preguntaId));
    const manuales = new Set(
      pivots.filter((p) => p.origen === 'MANUAL').map((p) => p.preguntaId),
    );

    const quitar = deCriterio.filter((p) => !requeridas.has(p.preguntaId));
    // Una pregunta que ya está a mano y ahora además matchea un criterio se
    // deja como está: sigue siendo MANUAL. No se puede tener las dos filas (la
    // PK es (versión, pregunta)) y pisarle el origen sería justamente "tocar una
    // MANUAL".
    const agregar = [...requeridas].filter(
      (id) => !yaDeCriterio.has(id) && !manuales.has(id),
    );

    if (quitar.length > 0) {
      await tx.moduloVersionPregunta.deleteMany({
        where: {
          moduloVersionId: versionId,
          preguntaId: { in: quitar.map((p) => p.preguntaId) },
        },
      });
    }

    if (agregar.length > 0) {
      const agg = await tx.moduloVersionPregunta.aggregate({
        where: { moduloVersionId: versionId },
        _max: { orden: true },
      });
      let siguienteOrden = agg._max.orden ?? 0;
      await tx.moduloVersionPregunta.createMany({
        data: agregar.map((preguntaId) => ({
          moduloVersionId: versionId,
          preguntaId,
          orden: (siguienteOrden += 1),
          origen: 'CRITERIO' as const,
        })),
      });
    }

    return {
      agregadas: agregar.length,
      quitadas: quitar.length,
      // Las que ya estaban por criterio y siguen matcheando: se conservan tal
      // cual (incluido su flag `activa`).
      conservadas: deCriterio.length - quitar.length,
      porCriterio,
    };
  }

  // Los rechazos de la base de datos son input inválido del cliente, no una
  // falla del servidor: salen como 400 y no como 500. Mismo criterio que
  // PreguntasService.traducirErrorDeClasificacion — acá no hace falta cubrir el
  // CHECK, porque base_conocimiento_id es NOT NULL y el caso "nivel sin base" no
  // se puede dar.
  private traducirErrorDeCriterio(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2003') {
        return new BadRequestException(
          'La base de conocimiento o el nivel no existen, o el nivel no pertenece a esa base',
        );
      }
      if (err.code === 'P2002') {
        return new BadRequestException(
          'Hay criterios repetidos: la misma base con el mismo nivel aparece más de una vez',
        );
      }
    }
    return err;
  }

  private criteriosDe(versionId: string) {
    return this.prisma.moduloVersionCriterio.findMany({
      where: { moduloVersionId: versionId },
      include: CRITERIO_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  // Descarta el BORRADOR en curso sin publicarlo. Si el módulo ya tiene un
  // ACTIVO, vuelve a ese estado (como si la edición nunca hubiera empezado).
  // Si el borrador era su única versión (el módulo nunca se publicó), no
  // tiene sentido dejar un módulo sin ninguna versión, así que se elimina el
  // módulo entero junto con el borrador.
  async cancelarBorrador(
    moduloId: string,
    actorIdentidad?: ActorIdentidad,
  ) {
    const borrador = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'BORRADOR' },
    });
    if (!borrador) {
      throw new NotFoundException(
        `El módulo ${moduloId} no tiene un borrador en curso`,
      );
    }

    const activo = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'ACTIVO' },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.moduloVersionPregunta.deleteMany({
        where: { moduloVersionId: borrador.id },
      });
      // Los criterios también cuelgan de la versión con una FK RESTRICT, así que
      // van antes que ella por el mismo motivo que los pivots.
      await tx.moduloVersionCriterio.deleteMany({
        where: { moduloVersionId: borrador.id },
      });
      await tx.moduloVersion.delete({ where: { id: borrador.id } });
      // DELETE real (no soft-delete: ModuloVersion no tiene deletedAt) —
      // `despues: null` porque la fila deja de existir de verdad, a
      // diferencia de ReglaAsignacion.remove() que sólo marca un flag.
      await this.auditarModuloVersion(
        tx,
        'DELETE',
        borrador,
        null,
        actorIdentidad,
      );

      if (!activo) {
        // Sin ACTIVO de respaldo, cancelar el único borrador se lleva el
        // módulo entero — también un DELETE real, mismo criterio de arriba.
        const moduloAntes = await tx.modulo.findUnique({
          where: { id: moduloId },
        });
        await tx.modulo.delete({ where: { id: moduloId } });
        if (moduloAntes) {
          await this.auditarModulo(tx, 'DELETE', moduloAntes, null, actorIdentidad);
        }
        return { moduloEliminado: true };
      }
      return { moduloEliminado: false };
    });
  }

  // --- Auditoría -----------------------------------------------------------

  // Si el diff da vacío, no llama a registrar() — mismo criterio que el resto
  // de las entidades auditadas (Organizacion, ReglaAsignacion, Pregunta,
  // Usuario/Vinculacion): el chequeo se hace ACÁ, testeable con AuditService
  // mockeado.
  private async auditarModulo(
    tx: Prisma.TransactionClient,
    accion: 'CREATE' | 'UPDATE' | 'DELETE',
    antes: Modulo | null,
    despues: Modulo | null,
    actorIdentidad?: ActorIdentidad,
  ) {
    const referencia = antes ?? despues;
    if (!referencia) return;

    const diff = calcularDiff(
      antes ? moduloEscalar(antes) : null,
      despues ? moduloEscalar(despues) : null,
      CAMPOS_TRAZABILIDAD_IGNORADOS,
    );
    if (!hayCambios(diff)) return;

    await this.audit.registrar(tx, {
      entidad: 'Modulo',
      entidadId: referencia.id,
      accion,
      diff,
      actor: 'backoffice',
      ...actorIdentidad,
    });
  }

  // Cambios en las columnas PROPIAS de una ModuloVersion (estado, numeración
  // pública, parámetros de examen). Para cambios de CONTENIDO (preguntas,
  // criterios) ver auditarContenidoModuloVersion — son dos cosas distintas:
  // acá antes/despues son dos filas reales, ahí es un diff armado a mano.
  private async auditarModuloVersion(
    tx: Prisma.TransactionClient,
    accion: 'CREATE' | 'UPDATE' | 'DELETE',
    antes: ModuloVersion | null,
    despues: ModuloVersion | null,
    actorIdentidad?: ActorIdentidad,
  ) {
    const referencia = antes ?? despues;
    if (!referencia) return;

    const diff = calcularDiff(
      antes ? moduloVersionEscalar(antes) : null,
      despues ? moduloVersionEscalar(despues) : null,
      CAMPOS_TRAZABILIDAD_IGNORADOS,
    );
    if (!hayCambios(diff)) return;

    await this.audit.registrar(tx, {
      entidad: 'ModuloVersion',
      entidadId: referencia.id,
      accion,
      diff,
      actor: 'backoffice',
      ...actorIdentidad,
    });
  }

  // Cambios en el CONTENIDO de una versión — qué preguntas tiene, cuáles
  // trajeron los criterios — donde la entidad que cambia de verdad
  // (ModuloVersionPregunta/ModuloVersionCriterio) no es una de las auditadas.
  // UNA fila por LLAMADO, no por fila de pivot tocada: `asignarPreguntas` con
  // 30 preguntas, o `setCriterios` con un criterio que mueve 50, generan una
  // sola entrada acá — el `diff` ya viene armado por el caller con el
  // resumen agregado (ver setCriterios/asignarPreguntas/setPreguntaActiva/
  // unassignPregunta), no se recalcula nada acá.
  private async auditarContenidoModuloVersion(
    tx: Prisma.TransactionClient,
    versionId: string,
    diff: Diff,
    actorIdentidad?: ActorIdentidad,
  ) {
    if (!hayCambios(diff)) return;

    await this.audit.registrar(tx, {
      entidad: 'ModuloVersion',
      entidadId: versionId,
      accion: 'UPDATE',
      diff,
      actor: 'backoffice',
      ...actorIdentidad,
    });
  }

  // Calcula el número público al activar el borrador.
  private async calcularNumero(
    moduloId: string,
    esNuevaLinea: boolean | undefined,
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
    if (esNuevaLinea === false) {
      return {
        anio: activo.anio,
        mayor: activo.mayor,
        menor: activo.menor + 1,
      };
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
