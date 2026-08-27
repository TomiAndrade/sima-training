import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  UMBRAL_APROBACION_DEFAULT,
  calcularResultado,
  esCorrecta,
} from './corregir';
import { RegistrarSesionDto } from './dto/registrar-sesion.dto';

@Injectable()
export class SesionesService {
  constructor(private readonly prisma: PrismaService) {}

  // Registra UN intento de rendición: corrige, persiste la Sesion con sus Respuesta
  // y —sólo si aprobó— completa Asignacion.moduloVersionId.
  //
  // Todo en una transacción: una sesión sin sus respuestas no significa nada, y la
  // asignación no puede quedar marcada como cumplida por una sesión que no se guardó.
  //
  // No llama a recalcular(): aprobar no crea ni revoca ninguna asignación. La vigente
  // sigue vigente (la regla la sigue pidiendo) y recalcular() ya la trata bien — no
  // la re-crea porque está cubierta, y no la revoca porque sigue requerida. Lo que
  // cambia es que a partir de ahora modulosAprobados() la cuenta como aprobada.
  //
  // `duplicada` (Story 5, Commit 4): true si esta llamada NO creó una sesión nueva
  // sino que devolvió una ya existente por claveIdempotencia. Es lo que necesita
  // TabletController para decidir 200 (deduplicó) vs 201 (creó) sin volver a
  // consultar nada — el booleano sale del mismo control de flujo que ya distingue
  // "existía"/"se crea", no es una query nueva ni una segunda fuente de verdad. Se
  // adjunta con Object.assign (in place) y no con un spread a un objeto nuevo, a
  // propósito: así la sesión devuelta en un dedupe sigue siendo la MISMA referencia
  // que la primera vez, que es lo que ya fijan los specs de idempotencia con toBe().
  async registrar(dto: RegistrarSesionDto, actor = 'tablet') {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Idempotencia (Story 5): la app manda la misma claveIdempotencia si
        // reintenta un envío que ya se guardó (offline). Se busca ANTES de
        // cualquier validación: un reintento tiene que devolver lo que se
        // guardó la primera vez aunque el estado haya cambiado después (ej.
        // la versión pasó a BORRADOR), no volver a validar contra el estado
        // actual.
        if (dto.claveIdempotencia) {
          const existente = await tx.sesion.findUnique({
            where: { claveIdempotencia: dto.claveIdempotencia },
            include: { respuestas: true },
          });
          if (existente) {
            // La clave la genera el CLIENTE, no el servidor: sin este
            // chequeo, una clave ajena (repetida entre dispositivos o
            // adivinada) devolvería la sesión de otra persona con todas sus
            // respuestas.
            if (existente.usuarioId !== dto.usuarioId) {
              throw new ConflictException(
                'La clave de idempotencia pertenece a una sesión de otra persona',
              );
            }
            return Object.assign(existente, { duplicada: true });
          }
        }

        const sesion = await this.crearSesion(tx, dto, actor);
        return Object.assign(sesion, { duplicada: false });
      });
    } catch (err) {
      // Backstop de carrera: dos requests concurrentes con la misma clave
      // pueden pasar juntos el findUnique de arriba (ninguno la ve todavía) y
      // chocar recién acá, contra el índice único. Tiene que estar FUERA del
      // $transaction: una vez que Postgres aborta la transacción no se
      // pueden correr más queries adentro.
      if (dto.claveIdempotencia && this.esConflictoDeClaveIdempotencia(err)) {
        const existente = await this.prisma.sesion.findUnique({
          where: { claveIdempotencia: dto.claveIdempotencia },
          include: { respuestas: true },
        });
        if (existente) return Object.assign(existente, { duplicada: true });
      }
      throw err;
    }
  }

  // Todas las sesiones de una persona (aprobadas y no), más recientes primero
  // — a diferencia de modulosAprobados()/aprobacionesPorModulo() de
  // AsignacionesService, que sólo miran las aprobadas para decidir cobertura.
  // El informe de usuario (Story 10) necesita "qué rindió", no "qué aprobó".
  // Sin paginación, mismo criterio que AuditService.listarPorUsuario(): decenas
  // de filas por persona, no cientos.
  async listarPorUsuario(usuarioId: number) {
    return this.prisma.sesion.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      include: {
        moduloVersion: {
          select: {
            moduloId: true,
            modulo: { select: { nombre: true } },
            anio: true,
            mayor: true,
            menor: true,
          },
        },
      },
    });
  }

  /**
   * UN intento con TODO su detalle: qué se preguntó, qué contestó la persona y
   * si estuvo bien. Es lo que consume "Ver intento" en la hoja de vida.
   *
   * Distinto de `listarPorUsuario()`, que devuelve la lista de intentos con su
   * score pero SIN las respuestas: acá se paga el include completo porque se
   * pide de a una sesión, no de a todas las de una persona.
   *
   * **Devuelve `Respuesta.correcta` y `Pregunta.respuestaCorrecta` por
   * separado, y no son lo mismo.** `correcta` es la corrección CONGELADA al
   * momento de rendir; `respuestaCorrecta` se lee viva del banco. Hoy coinciden
   * siempre (no hay endpoint que edite una pregunta), pero el ✓/✗ de la
   * pantalla tiene que salir de `correcta` — si algún día se corrige una
   * pregunta, el intento tiene que seguir diciendo lo que se decidió entonces.
   * Mismo criterio que el `umbralAprobacion` congelado en la fila.
   *
   * **No filtra por `Pregunta.activa`**, igual que `crearSesion()`: una
   * pregunta mandada a papelera después no puede desaparecer de un intento ya
   * rendido.
   */
  async detalle(id: string) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { id },
      include: {
        usuario: {
          select: { id: true, nombre: true, apellido: true, dni: true },
        },
        moduloVersion: {
          select: {
            id: true,
            moduloId: true,
            estado: true,
            anio: true,
            mayor: true,
            menor: true,
            modulo: { select: { nombre: true } },
          },
        },
        respuestas: {
          // Aproximación al orden en que se rindieron: el `create` anidado
          // inserta en el orden del array del DTO, que es el orden en que la
          // tablet mostró las preguntas. Prisma no lo GARANTIZA, así que esto
          // es "lo más cercano disponible" y no el orden exacto — no hay otra
          // columna que lo registre.
          orderBy: { createdAt: 'asc' },
          include: {
            pregunta: {
              select: {
                id: true,
                texto: true,
                tipo: true,
                opciones: true,
                respuestaCorrecta: true,
                imagen: true,
                activa: true,
                baseConocimientoId: true,
                base: { select: { id: true, nombre: true } },
                nivel: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión ${id} no encontrada`);
    }
    return sesion;
  }

  private esConflictoDeClaveIdempotencia(
    err: unknown,
  ): err is Prisma.PrismaClientKnownRequestError {
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== 'P2002'
    ) {
      return false;
    }
    const target = err.meta?.target;
    return Array.isArray(target)
      ? target.includes('clave_idempotencia')
      : typeof target === 'string' && target.includes('clave_idempotencia');
  }

  private async crearSesion(
    tx: Prisma.TransactionClient,
    dto: RegistrarSesionDto,
    actor: string,
  ) {
    const usuario = await tx.usuario.findFirst({
      where: { id: dto.usuarioId, deletedAt: null },
      select: { id: true },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);
    }

    const version = await tx.moduloVersion.findUnique({
      where: { id: dto.moduloVersionId },
      select: {
        id: true,
        moduloId: true,
        estado: true,
        umbralAprobacion: true,
      },
    });
    if (!version) {
      throw new NotFoundException(
        `La versión de módulo ${dto.moduloVersionId} no existe`,
      );
    }
    // ARCHIVADO sí se acepta: una sesión sincronizada tarde (modo offline) puede
    // corresponder a una versión que se archivó mientras tanto, y lo que se rindió
    // se rindió. Un BORRADOR, en cambio, es trabajo en curso sin publicar —
    // rendirlo sería certificar contra algo que nadie aprobó todavía (el modo beta
    // del Sprint 3 sigue sin implementar).
    if (version.estado === 'BORRADOR') {
      throw new ConflictException(
        'No se puede rendir un BORRADOR: la versión todavía no está publicada',
      );
    }

    if (dto.iniciadaEn && dto.iniciadaEn > dto.finalizadaEn) {
      throw new BadRequestException(
        'iniciadaEn no puede ser posterior a finalizadaEn',
      );
    }

    const preguntaIds = dto.respuestas.map((r) => r.preguntaId);
    if (new Set(preguntaIds).size !== preguntaIds.length) {
      throw new BadRequestException(
        'Hay preguntas repetidas: cada pregunta se contesta una sola vez por intento',
      );
    }

    // Una sola query resuelve las dos cosas: que la pregunta PERTENEZCA a esta
    // versión y con qué respuesta hay que corregirla.
    //
    // No se exige `activa: true` en el pivot ni en la pregunta: desactivar una
    // pregunta o mandarla a papelera DESPUÉS no puede invalidar una rendición ya
    // hecha (y con el modo offline el intento puede ser anterior a la baja).
    const pivots = await tx.moduloVersionPregunta.findMany({
      where: {
        moduloVersionId: version.id,
        preguntaId: { in: preguntaIds },
      },
      select: {
        preguntaId: true,
        pregunta: { select: { respuestaCorrecta: true } },
      },
    });
    const porPregunta = new Map(pivots.map((p) => [p.preguntaId, p.pregunta]));

    const ajenas = preguntaIds.filter((id) => !porPregunta.has(id));
    if (ajenas.length) {
      throw new BadRequestException(
        `Estas preguntas no pertenecen a la versión que se rindió: ${ajenas.join(', ')}`,
      );
    }

    // Una pregunta sin respuestaCorrecta no se puede corregir sola (hoy sólo
    // podría pasar con TEXTO_LIBRE, que está en el enum pero no lo usa ningún
    // módulo). Se rechaza en vez de contarla como incorrecta: puntuar 0 en
    // silencio le baja el score a alguien por un dato faltante nuestro. La
    // corrección manual necesitaría `Respuesta.correcta` nullable y un corrector
    // — no entra en esta story.
    const sinCorrecta = preguntaIds.filter(
      (id) => !porPregunta.get(id)?.respuestaCorrecta,
    );
    if (sinCorrecta.length) {
      throw new BadRequestException(
        `Estas preguntas no tienen respuesta correcta cargada y no se pueden corregir automáticamente: ${sinCorrecta.join(', ')}`,
      );
    }

    // La asignación que se viene a cumplir. Si el cliente no la mandó, se resuelve
    // la vigente de ese (usuario, módulo) — a lo sumo hay una, lo garantiza el
    // índice parcial asignaciones_usuario_modulo_vigente.
    const asignacion = await this.resolverAsignacion(tx, dto, version.moduloId);

    const correcciones = dto.respuestas.map((respuesta) => ({
      preguntaId: respuesta.preguntaId,
      respuestaDada: respuesta.respuestaDada ?? null,
      correcta: esCorrecta(
        // El filtro de sinCorrecta de arriba ya garantiza que no es null.
        porPregunta.get(respuesta.preguntaId)!.respuestaCorrecta!,
        respuesta.respuestaDada,
      ),
    }));

    // El umbral lo declara la VERSIÓN que se rindió, y `null` cae al default
    // global (las versiones publicadas antes de que la columna existiera). Se
    // lee de la versión y no del módulo a propósito: es el umbral con el que se
    // publicó ESTE examen, así que una sesión sincronizada tarde contra una
    // versión ya archivada se corrige con la regla que tenía cuando se rindió.
    //
    // Igual que siempre, el valor se congela abajo en Sesion.umbralAprobacion:
    // subirlo mañana no reescribe los certificados ya emitidos.
    const umbralAprobacion =
      version.umbralAprobacion ?? UMBRAL_APROBACION_DEFAULT;
    const resultado = calcularResultado(
      correcciones.map((c) => c.correcta),
      umbralAprobacion,
    );

    const sesion = await tx.sesion.create({
      data: {
        usuarioId: dto.usuarioId,
        moduloVersionId: version.id,
        asignacionId: asignacion?.id ?? null,
        claveIdempotencia: dto.claveIdempotencia ?? null,
        iniciadaEn: dto.iniciadaEn,
        finalizadaEn: dto.finalizadaEn,
        ...resultado,
        umbralAprobacion,
        createdBy: actor,
        respuestas: { create: correcciones },
      },
      include: { respuestas: true },
    });

    // Sólo al APROBAR: el campo significa "con qué versión se cumplió esta
    // obligación", no "con cuál se intentó" (eso ya lo guarda cada Sesion). Un
    // intento desaprobado lo deja como estaba; una aprobación posterior sobre una
    // versión más nueva lo pisa. La asignación NO se revoca: sigue vigente porque
    // la regla la sigue pidiendo, y "pendiente" pasa a ser vigente-sin-aprobar.
    if (resultado.aprobada && asignacion) {
      await tx.asignacion.update({
        where: { id: asignacion.id },
        data: { moduloVersionId: version.id, updatedBy: actor },
      });
    }

    return sesion;
  }

  private async resolverAsignacion(
    tx: Prisma.TransactionClient,
    dto: RegistrarSesionDto,
    moduloId: string,
  ) {
    if (!dto.asignacionId) {
      // Rendir sin asignación vigente es válido (la sesión vale igual y cuenta como
      // aprobación): por eso esto puede devolver null en vez de tirar.
      return tx.asignacion.findFirst({
        where: { usuarioId: dto.usuarioId, moduloId, revocadaAt: null },
        select: { id: true },
      });
    }

    const asignacion = await tx.asignacion.findUnique({
      where: { id: dto.asignacionId },
      select: {
        id: true,
        usuarioId: true,
        moduloId: true,
        revocadaAt: true,
      },
    });
    if (!asignacion) {
      throw new NotFoundException(
        `Asignación ${dto.asignacionId} no encontrada`,
      );
    }
    if (asignacion.usuarioId !== dto.usuarioId) {
      throw new BadRequestException(
        `La asignación ${dto.asignacionId} es de otra persona`,
      );
    }
    if (asignacion.moduloId !== moduloId) {
      throw new BadRequestException(
        `La asignación ${dto.asignacionId} es de otro módulo que el de la versión rendida`,
      );
    }
    if (asignacion.revocadaAt) {
      throw new ConflictException(
        `La asignación ${dto.asignacionId} está revocada`,
      );
    }
    return { id: asignacion.id };
  }
}
