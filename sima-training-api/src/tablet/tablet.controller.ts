import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
}
