import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { FindAllUsuariosDto } from './dto/find-all-usuarios.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuarios.create(dto);
  }

  @Get()
  @Public()
  findAll(@Query() query: FindAllUsuariosDto) {
    return this.usuarios.findAll(query);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.findOne(id);
  }

  // Historial de auditoría DE ESTA PERSONA (Vinculacion + sus pares) — no un
  // log global, por eso cuelga acá y no de un controller propio de audit/.
  // Lectura abierta, igual que el resto de los GET.
  @Get(':id/audit-log')
  @Public()
  auditLog(@Param('id', ParseIntPipe) id: number) {
    return this.audit.listarPorUsuario(id);
  }

  // Informe agregado de habilitación (Story 10): usuario + asignaciones +
  // sesiones + auditoría + veredicto, en un solo request. Lectura abierta,
  // igual que el resto de los GET.
  @Get(':id/informe')
  @Public()
  informe(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.informe(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuarios.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.usuarios.remove(id);
  }
}
