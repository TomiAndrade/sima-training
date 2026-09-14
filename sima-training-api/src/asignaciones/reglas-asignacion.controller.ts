import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { actorDeIdentidad } from '../audit/actor-de-identidad';
import { Actor } from '../auth/actor.decorator';
import { IdentidadResuelta, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GESTION_NOMINA, LECTURA_BACKOFFICE } from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
import { CreateReglaAsignacionDto } from './dto/create-regla-asignacion.dto';
import { FindReglasAsignacionDto } from './dto/find-reglas-asignacion.dto';
import { UpdateReglaAsignacionDto } from './dto/update-regla-asignacion.dto';
import { ReglasAsignacionService } from './reglas-asignacion.service';

@Controller('reglas-asignacion')
export class ReglasAsignacionController {
  constructor(private readonly reglas: ReglasAsignacionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(...GESTION_NOMINA)
  create(
    @Body() dto: CreateReglaAsignacionDto,
    @Actor() actor: IdentidadResuelta,
  ) {
    return this.reglas.create(dto, 'backoffice', actorDeIdentidad(actor));
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findAll(@Query() query: FindReglasAsignacionDto) {
    return this.reglas.findAll(query);
  }

  // Edita el módulo de la regla y/o su baja lógica. Las cuatro mutaciones
  // devuelven { regla, recalculo }: tocar una regla recalcula en el acto las
  // asignaciones AUTOMATICA de la gente del centro.
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...GESTION_NOMINA)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReglaAsignacionDto,
    @Actor() actor: IdentidadResuelta,
  ) {
    return this.reglas.update(id, dto, 'backoffice', actorDeIdentidad(actor));
  }

  // Baja LÓGICA (deletedAt), no un borrado real: la fila es la única evidencia
  // de por qué alguien tuvo que rendir un módulo. Deja de listarse y de generar
  // obligaciones; volver a crear el mismo triple revive esta misma fila.
  // Sin @HttpCode: responde 200 con el resumen del recálculo, igual que
  // DELETE /modulos/:id/borrador.
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...GESTION_NOMINA)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: IdentidadResuelta,
  ) {
    return this.reglas.remove(id, 'backoffice', actorDeIdentidad(actor));
  }
}
