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
import { LoginTabletDto } from './dto/login-tablet.dto';
import { TabletAuthGuard, UsuarioTablet } from './tablet-auth.guard';
import { TabletService } from './tablet.service';

@Controller('tablet')
export class TabletController {
  constructor(private readonly tablet: TabletService) {}

  // PROVISIONAL sin PIN — ver el comentario de TabletService.login() y
  // docs/autenticacion-tablet.md.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginTabletDto) {
    return this.tablet.login(dto);
  }

  @Get('pendientes')
  @UseGuards(TabletAuthGuard)
  pendientes(@UsuarioTablet() usuarioId: number) {
    return this.tablet.pendientes(usuarioId);
  }

  // TabletAuthGuard exige un alumno autenticado, pero el usuarioId no se usa
  // para personalizar la respuesta: el contenido del examen es el mismo para
  // cualquiera que rinda esa versión del módulo. El guard acá es sólo "hace
  // falta estar logueado en la tablet", no "es tuyo".
  @Get('modulos/:moduloId/examen')
  @UseGuards(TabletAuthGuard)
  examen(@Param('moduloId') moduloId: string) {
    return this.tablet.examen(moduloId);
  }
}
