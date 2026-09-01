import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import {
  UMBRAL_APROBACION_DEFAULT,
  calcularResultado,
  esCorrecta,
} from '../sesiones/corregir';
import { LoginInvitadoDto } from './dto/login-invitado.dto';
import { RegistrarSesionInvitadoDto } from './dto/registrar-sesion-invitado.dto';
import { serializarPregunta } from './serializar-pregunta';
import { sortear } from './sorteo';
import { PREGUNTAS_POR_EXAMEN } from './tablet.service';

/**
 * Modo invitado: alguien que NO está en el sistema prueba la app dando sólo su
 * nombre. El caso real es una tablet en la oficina y alguien que pasa y quiere
 * ver de qué se trata.
 *
 * Comparte con el flujo real exactamente dos cosas, las dos a propósito:
 * `sortear()` (el examen se arma igual) y `corregir.ts` (el resultado se calcula
 * igual). **No comparte la persistencia**: escribe en `SesionInvitado`/
 * `RespuestaInvitado`, que son tablas aparte para que las rendiciones de demo no
 * puedan contaminar ningún reporte de la nómina real — ver el comentario de
 * `SesionInvitado` en el schema.
 *
 * Lo que este flujo NO hace, y no es un pendiente sino el diseño:
 *
 *   - **No toca `Asignacion`.** Un invitado no tiene obligaciones que cumplir,
 *     así que aprobar no marca nada como cumplido.
 *   - **No aplica el tope de reintentos** (`reintentos.ts`). Ese tope se cuenta
 *     por persona, y acá no hay persona: el nombre es una etiqueta sin
 *     verificar, así que contar intentos "de Juan" no significaría nada.
 *     Un invitado puede rendir las veces que quiera.
 *   - **No deduplica por `claveIdempotencia`.** Es el mecanismo del modo
 *     offline; la demo se rinde conectada.
 */
@Injectable()
export class InvitadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Entrada al modo invitado: se cambia un nombre por un token.
   *
   * No valida nada contra la base porque no hay nada contra qué validar — es
   * justamente el punto del modo. El token existe igual, y no como formalidad:
   * sin él, los endpoints de examen quedarían abiertos a cualquiera que
   * descubra la URL de la API, sin haber pasado nunca por la app.
   *
   * TTL corto (30 min por default): una tablet que queda abierta en un
   * mostrador no deja una sesión de demo viva indefinidamente. Al vencer, la
   * app vuelve sola a la pantalla de inicio.
   */
  login(dto: LoginInvitadoDto) {
    const nombre = dto.nombre.trim();
    const expiresIn = (this.config.get<string>(
      'TABLET_INVITADO_JWT_EXPIRES_IN',
    ) ?? '30m') as NonNullable<JwtSignOptions['expiresIn']>;

    return {
      // El nombre va FIRMADO adentro del token (ver invitado-auth.guard.ts):
      // el POST del resultado no puede mentir sobre a nombre de quién quedó.
      access_token: this.jwt.sign({ tipo: 'invitado', nombre }, { expiresIn }),
      invitado: { nombre },
    };
  }

  /**
   * Los módulos que se ofrecen en la demo: los tildados `demoPublico` que además
   * están activos y tienen una versión publicada.
   *
   * Los tres filtros importan y ninguno sobra. `demoPublico` es la decisión de
   * contenido (a un visitante externo no se le muestra el material interno de un
   * cliente); `activo` y la versión ACTIVO son los mismos que aplica
   * `TabletService.pendientes()` — un módulo retirado o sin publicar no se puede
   * rendir por ningún camino.
   *
   * Devuelve la lista vacía sin error si no hay ninguno tildado: es un estado
   * válido (nadie configuró la demo todavía) y la app muestra su estado vacío.
   */
  async modulos() {
    const modulos = await this.prisma.modulo.findMany({
      where: {
        demoPublico: true,
        activo: true,
        versiones: { some: { estado: 'ACTIVO' } },
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        versiones: {
          where: { estado: 'ACTIVO' },
          select: { id: true, anio: true, mayor: true, menor: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return modulos.map((m) => ({
      moduloId: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      version: {
        id: m.versiones[0].id,
        anio: m.versiones[0].anio,
        mayor: m.versiones[0].mayor,
        menor: m.versiones[0].menor,
      },
    }));
  }

  /**
   * El examen de un módulo de demo. Mismo sorteo y misma serialización que el
   * flujo real — lo único que cambia es que acá no se cuentan intentos.
   *
   * El chequeo de `demoPublico` es lo que impide que un token de invitado sirva
   * para pedir el examen de CUALQUIER módulo con sólo cambiar el id en la URL.
   * Sin él, el modo invitado sería una puerta abierta al banco entero.
   */
  async examen(moduloId: string) {
    const modulo = await this.prisma.modulo.findUnique({
      where: { id: moduloId },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activo: true,
        demoPublico: true,
        versiones: {
          where: { estado: 'ACTIVO' },
          select: {
            id: true,
            anio: true,
            mayor: true,
            menor: true,
            preguntasPorExamen: true,
          },
        },
      },
    });

    // 404 y no 403 aunque el módulo exista pero no sea de demo: para un
    // invitado, un módulo que no está en la demo directamente no existe. Un 403
    // le confirmaría qué ids son válidos.
    if (!modulo || !modulo.activo || !modulo.demoPublico) {
      throw new NotFoundException(
        `El módulo ${moduloId} no está disponible en el modo demostración`,
      );
    }

    const version = modulo.versiones[0];
    if (!version) {
      throw new ConflictException(
        `El módulo ${moduloId} no tiene ninguna versión publicada para rendir`,
      );
    }

    // Mismo filtro `activa` en el pivot Y en la pregunta que TabletService: no
    // tiene sentido servir un examen nuevo con una pregunta ya desactivada.
    const pivots = await this.prisma.moduloVersionPregunta.findMany({
      where: {
        moduloVersionId: version.id,
        activa: true,
        pregunta: { activa: true },
      },
      select: {
        // Nunca se selecciona `respuestaCorrecta`, igual que en el flujo real:
        // la garantía no depende de que la serialización la descarte, depende
        // de que no esté en el objeto.
        pregunta: {
          select: {
            id: true,
            texto: true,
            tipo: true,
            imagen: true,
            opciones: true,
          },
        },
      },
    });
    if (!pivots.length) {
      throw new ConflictException(
        `El módulo ${moduloId} no tiene preguntas activas para rendir`,
      );
    }

    const elegidas = sortear(
      pivots.map((p) => p.pregunta),
      version.preguntasPorExamen ?? PREGUNTAS_POR_EXAMEN,
    );

    return {
      moduloId: modulo.id,
      moduloVersionId: version.id,
      modulo: { nombre: modulo.nombre, descripcion: modulo.descripcion },
      version: {
        anio: version.anio,
        mayor: version.mayor,
        menor: version.menor,
      },
      preguntas: elegidas.map(serializarPregunta),
    };
  }

  /**
   * Registra una rendición de demo y devuelve el resultado.
   *
   * La corrección la hace el MISMO `corregir.ts` que el flujo real. Que sea una
   * demo no significa que el cliente pueda mandar su propio puntaje: si el score
   * lo decidiera la app, el reporte de invitados no significaría nada.
   *
   * **Valida `demoPublico` también acá**, a diferencia del flujo real, donde el
   * tope de reintentos se aplica al servir y no al registrar. Esa asimetría
   * existe por el modo offline (una sesión que se sincroniza tarde no puede
   * caerse por una ventana que ya venció), y acá no hay offline: el invitado
   * rinde conectado y en el momento. Sin este chequeo, un token de invitado
   * podría sembrar filas contra cualquier versión del banco.
   */
  async rendir(nombre: string, dto: RegistrarSesionInvitadoDto) {
    const version = await this.prisma.moduloVersion.findUnique({
      where: { id: dto.moduloVersionId },
      select: {
        id: true,
        estado: true,
        umbralAprobacion: true,
        modulo: { select: { id: true, demoPublico: true } },
      },
    });
    if (!version || !version.modulo.demoPublico) {
      throw new NotFoundException(
        `La versión ${dto.moduloVersionId} no está disponible en el modo demostración`,
      );
    }
    // ARCHIVADO sí se acepta (la versión pudo archivarse entre que se sirvió el
    // examen y se mandó el resultado, y lo que se rindió se rindió). BORRADOR
    // no: es trabajo sin publicar. Mismo criterio que SesionesService.
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

    // Una sola query resuelve las dos cosas: que la pregunta pertenezca a esta
    // versión y con qué respuesta hay que corregirla. Sin `activa: true`, igual
    // que al corregir una rendición real: una baja posterior no puede invalidar
    // lo que ya se contestó.
    const pivots = await this.prisma.moduloVersionPregunta.findMany({
      where: { moduloVersionId: version.id, preguntaId: { in: preguntaIds } },
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

    const sinCorrecta = preguntaIds.filter(
      (id) => !porPregunta.get(id)?.respuestaCorrecta,
    );
    if (sinCorrecta.length) {
      throw new BadRequestException(
        `Estas preguntas no tienen respuesta correcta cargada y no se pueden corregir automáticamente: ${sinCorrecta.join(', ')}`,
      );
    }

    const correcciones = dto.respuestas.map((respuesta) => ({
      preguntaId: respuesta.preguntaId,
      respuestaDada: respuesta.respuestaDada ?? null,
      correcta: esCorrecta(
        porPregunta.get(respuesta.preguntaId)!.respuestaCorrecta!,
        respuesta.respuestaDada,
      ),
    }));

    // El umbral lo declara la versión rendida, igual que en el flujo real, y se
    // congela en la fila: el invitado ve el mismo criterio de aprobación que
    // vería un alumno rindiendo ese módulo. Una demo con un umbral distinto
    // mostraría algo que no es el producto.
    const umbralAprobacion =
      version.umbralAprobacion ?? UMBRAL_APROBACION_DEFAULT;
    const resultado = calcularResultado(
      correcciones.map((c) => c.correcta),
      umbralAprobacion,
    );

    const sesion = await this.prisma.sesionInvitado.create({
      data: {
        nombre,
        moduloVersionId: version.id,
        iniciadaEn: dto.iniciadaEn,
        finalizadaEn: dto.finalizadaEn,
        ...resultado,
        umbralAprobacion,
        respuestas: { create: correcciones },
      },
      select: {
        id: true,
        correctas: true,
        total: true,
        porcentaje: true,
        aprobada: true,
        umbralAprobacion: true,
      },
    });

    return {
      sesionId: sesion.id,
      correctas: sesion.correctas,
      total: sesion.total,
      porcentaje: sesion.porcentaje,
      aprobada: sesion.aprobada,
      umbralAprobacion: sesion.umbralAprobacion,
    };
  }
}
