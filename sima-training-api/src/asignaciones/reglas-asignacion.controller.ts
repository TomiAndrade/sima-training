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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { CreateReglaAsignacionDto } from './dto/create-regla-asignacion.dto';
import { FindReglasAsignacionDto } from './dto/find-reglas-asignacion.dto';
import { UpdateReglaAsignacionDto } from './dto/update-regla-asignacion.dto';
import { ReglasAsignacionService } from './reglas-asignacion.service';

@Controller('reglas-asignacion')
export class ReglasAsignacionController {
  constructor(private readonly reglas: ReglasAsignacionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateReglaAsignacionDto) {
    return this.reglas.create(dto);
  }

  @Get()
  @Public()
  findAll(@Query() query: FindReglasAsignacionDto) {
    return this.reglas.findAll(query);
  }

  // Edita el módulo de la regla y/o su baja lógica. Las cuatro mutaciones
  // devuelven { regla, recalculo }: tocar una regla recalcula en el acto las
  // asignaciones AUTOMATICA de la gente del centro.
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReglaAsignacionDto,
  ) {
    return this.reglas.update(id, dto);
  }

  // Baja LÓGICA (deletedAt), no un borrado real: la fila es la única evidencia
  // de por qué alguien tuvo que rendir un módulo. Deja de listarse y de generar
  // obligaciones; volver a crear el mismo triple revive esta misma fila.
  // Sin @HttpCode: responde 200 con el resumen del recálculo, igual que
  // DELETE /modulos/:id/borrador.
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reglas.remove(id);
  }
}
