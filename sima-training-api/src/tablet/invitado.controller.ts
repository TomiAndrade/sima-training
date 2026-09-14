import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CorregirRespuestaDto } from './dto/corregir-respuesta.dto';
import { LoginInvitadoDto } from './dto/login-invitado.dto';
import { RegistrarSesionInvitadoDto } from './dto/registrar-sesion-invitado.dto';
import { InvitadoAuthGuard, NombreInvitado } from './invitado-auth.guard';
import { InvitadoService } from './invitado.service';

// Modo invitado de la tablet: probar la app sin estar en el sistema.
//
// Namespace propio (`/tablet/invitado/*`) y controller propio, aunque viva en el
// mismo TabletModule. Es la misma razón por la que `tablet/` no es un controller
// dentro de `sesiones/`: son dos contratos distintos con dos guards distintos, y
// tenerlos separados hace imposible que una ruta acepte el token equivocado por
// omisión.
//
// Las cuatro rutas van con @Public() por el mismo motivo que las de alumno: el
// guard global (JwtAuthGuard) sólo entiende RS256 de Auth0 y rechazaría un token
// de invitado (HS256) antes de que InvitadoAuthGuard llegue a mirarlo. @Public()
// acá significa "no opines", no "abierto": InvitadoAuthGuard es la autoridad
// real sobre las tres rutas que lo llevan.
@Controller('tablet/invitado')
export class InvitadoController {
  constructor(private readonly invitado: InvitadoService) {}

  // La única ruta genuinamente abierta del modo: se entra con un nombre y nada
  // más. Es el punto del modo invitado — no hay credencial que validar.
  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginInvitadoDto) {
    return this.invitado.login(dto);
  }

  @Get('modulos')
  @Public()
  @UseGuards(InvitadoAuthGuard)
  modulos() {
    return this.invitado.modulos();
  }

  @Get('modulos/:moduloId/examen')
  @Public()
  @UseGuards(InvitadoAuthGuard)
  examen(@Param('moduloId') moduloId: string) {
    return this.invitado.examen(moduloId);
  }

  // Espejo exacto de POST /tablet/corregir: el feedback inmediato funciona
  // igual en la demo. No recibe el nombre del invitado porque corregir no
  // depende de quién rinde (ver corregir-una.ts).
  @Post('corregir')
  @Public()
  @UseGuards(InvitadoAuthGuard)
  @HttpCode(HttpStatus.OK)
  corregir(@Body() dto: CorregirRespuestaDto) {
    return this.invitado.corregir(dto);
  }

  // El nombre sale del TOKEN, nunca del body — ver RegistrarSesionInvitadoDto
  // (que no tiene el campo) e invitado-auth.guard.ts. Mismo principio que el
  // usuarioId del flujo real: quien rinde no elige a nombre de quién queda.
  //
  // Siempre 201: acá no hay deduplicación por claveIdempotencia que distinguir
  // (ver el comentario de SesionInvitado en el schema), así que no hace falta el
  // @Res({ passthrough: true }) del endpoint real.
  @Post('sesiones')
  @Public()
  @UseGuards(InvitadoAuthGuard)
  rendir(
    @NombreInvitado() nombre: string,
    @Body() dto: RegistrarSesionInvitadoDto,
  ) {
    return this.invitado.rendir(nombre, dto);
  }
}
