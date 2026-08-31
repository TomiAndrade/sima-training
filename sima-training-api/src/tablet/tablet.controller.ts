import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { LoginTabletDto } from './dto/login-tablet.dto';
import { RegistrarSesionTabletDto } from './dto/registrar-sesion-tablet.dto';
import { TabletAuthGuard, UsuarioTablet } from './tablet-auth.guard';
import { TabletService } from './tablet.service';

@Controller('tablet')
export class TabletController {
  constructor(private readonly tablet: TabletService) {}

  // PROVISIONAL sin PIN — ver el comentario de TabletService.login() y
  // docs/autenticacion-tablet.md.
  //
  // @Public() acá no es opcional: con JwtAuthGuard como guard global (Story
  // 4), esta ruta necesitaría un Bearer para poder... emitir un Bearer. Un
  // alumno arranca sin ningún token, sólo con su DNI.
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginTabletDto) {
    return this.tablet.login(dto);
  }

  // @Public() acá también es obligatorio, y por un motivo distinto al de
  // /login: el guard global (JwtAuthGuard) ahora corre en TODA ruta, y su
  // rama HS256 exige `type: 'backoffice'` (fix de seguridad de Story 4) —
  // un token de alumno (`tipo: 'alumno'`) ya NO la pasa. Sin @Public() acá,
  // el guard global rechazaría el token de tablet ANTES de que
  // TabletAuthGuard llegue a mirarlo. TabletAuthGuard sigue siendo la única
  // autoridad real sobre estas tres rutas, exactamente como antes de esta
  // story — @Public() sólo le dice al guard global "no opines acá".
  @Get('pendientes')
  @Public()
  @UseGuards(TabletAuthGuard)
  pendientes(@UsuarioTablet() usuarioId: number) {
    return this.tablet.pendientes(usuarioId);
  }

  // El CONTENIDO del examen sigue siendo el mismo para cualquiera que rinda esa
  // versión del módulo — el guard no verifica que la asignación sea suya. Pero
  // el usuarioId sí se usa ahora: es contra él que se cuentan los intentos ya
  // gastados y la espera entre uno y otro (409 si no puede rendir).
  @Get('modulos/:moduloId/examen')
  @Public()
  @UseGuards(TabletAuthGuard)
  examen(
    @UsuarioTablet() usuarioId: number,
    @Param('moduloId') moduloId: string,
  ) {
    return this.tablet.examen(usuarioId, moduloId);
  }

  // El usuarioId sale del token — NUNCA del body, ver RegistrarSesionTabletDto
  // (sin ese campo) y el comentario ahí de por qué no alcanza con "aceptarlo y
  // pisarlo": con un token cualquiera, un usuarioId en el body dejaría rendir
  // y aprobar en nombre de otra persona.
  //
  // 201 si esta llamada CREÓ la sesión, 200 si deduplicó por
  // claveIdempotencia (ver SesionesService.registrar()). Importa
  // distinguirlos: es lo que le permite al modo offline (sprint que viene)
  // saber si su reintento efectivamente hizo algo. Se descartó la alternativa
  // más simple (200 siempre + `{ duplicada }` en el body): el body es
  // exactamente lo que la pantalla de Resultado necesita pintar, y sumarle un
  // campo que sólo sirve para decidir un status HTTP lo ensucia para su único
  // consumidor real — @Res({ passthrough: true }) alcanza sin tocar eso.
  @Post('sesiones')
  @Public()
  @UseGuards(TabletAuthGuard)
  async rendir(
    @UsuarioTablet() usuarioId: number,
    @Body() dto: RegistrarSesionTabletDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { duplicada, resultado } = await this.tablet.rendir(usuarioId, dto);
    res.status(duplicada ? HttpStatus.OK : HttpStatus.CREATED);
    return resultado;
  }
}
