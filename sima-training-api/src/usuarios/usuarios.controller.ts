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
import { Actor } from '../auth/actor.decorator';
import { IdentidadResuelta, JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  GESTION_NOMINA,
  LECTURA_BACKOFFICE,
  SOLO_ADMINISTRADOR,
} from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
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
  @Roles(...SOLO_ADMINISTRADOR)
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuarios.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findAll(@Query() query: FindAllUsuariosDto) {
    return this.usuarios.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.findOne(id);
  }

  // Historial de auditoría DE ESTA PERSONA (Vinculacion + sus pares) — no un
  // log global, por eso cuelga acá y no de un controller propio de audit/.
  @Get(':id/audit-log')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  auditLog(@Param('id', ParseIntPipe) id: number) {
    return this.audit.listarPorUsuario(id);
  }

  // Informe agregado de habilitación (Story 10): usuario + asignaciones +
  // sesiones + auditoría + veredicto, en un solo request.
  @Get(':id/informe')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  informe(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.informe(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...GESTION_NOMINA)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
    @Actor() actor: IdentidadResuelta,
  ) {
    // El 3er parámetro (`actor`, el string de updatedBy/AuditLog) queda en su
    // default; lo que se manda es el ROL de quien hace el cambio, que es otra
    // cosa: es lo que impide que un COORDINADOR se auto-ascienda tocando
    // `vinculacion.rol` en el body. Ver UsuariosService.update().
    return this.usuarios.update(id, dto, undefined, actor.rol);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...GESTION_NOMINA)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.usuarios.remove(id);
  }
}
