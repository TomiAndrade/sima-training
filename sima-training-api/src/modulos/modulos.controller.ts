import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LECTURA_BACKOFFICE, SOLO_ADMINISTRADOR } from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
import { ActivarModuloDto } from './dto/activar-modulo.dto';
import { AsignarPreguntaItemDto } from './dto/asignar-preguntas.dto';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { ParametrosExamenDto } from './dto/parametros-examen.dto';
import { SetCriteriosDto } from './dto/set-criterios.dto';
import { TogglePreguntaDto } from './dto/toggle-pregunta.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import { ModulosService } from './modulos.service';

@Controller('modulos')
export class ModulosController {
  constructor(private readonly modulos: ModulosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  create(@Body() dto: CreateModuloDto) {
    return this.modulos.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findAll() {
    return this.modulos.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.modulos.findOne(id);
  }

  @Get(':id/versiones')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findVersiones(@Param('id', ParseUUIDPipe) id: string) {
    return this.modulos.findVersiones(id);
  }

  @Get(':id/versiones/:versionId')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findVersionOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.modulos.findVersionOne(id, versionId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateModuloDto) {
    return this.modulos.update(id, dto);
  }

  @Post(':id/versiones')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  crearVersion(@Param('id', ParseUUIDPipe) id: string) {
    return this.modulos.crearVersion(id);
  }

  // esNuevaLinea (actualización/versión nueva) es obligatorio solo cuando el
  // módulo ya tiene un ACTIVO publicado; el service lo valida.
  @Patch(':id/activar')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  activar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivarModuloDto,
  ) {
    return this.modulos.activar(id, dto.esNuevaLinea);
  }

  // Descarta el borrador en curso. Si el módulo nunca se publicó (el borrador
  // era su única versión), esto elimina el módulo entero.
  @Delete(':id/borrador')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  cancelarBorrador(@Param('id', ParseUUIDPipe) id: string) {
    return this.modulos.cancelarBorrador(id);
  }

  // Set COMPLETO de criterios de la versión en edición (PUT, no PATCH: el
  // cliente manda el estado deseado y el servidor resuelve el diff, igual que
  // PUT /bases-conocimiento/:id/niveles/orden). Materializa el pool en el acto;
  // el service rechaza si la versión no es un BORRADOR.
  @Put(':id/criterios')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  setCriterios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCriteriosDto,
  ) {
    return this.modulos.setCriterios(id, dto);
  }

  // Cómo se rinde la versión en edición (cuántas preguntas, umbral, reintentos,
  // espera). PUT y no PATCH por el mismo motivo que los criterios: es el set
  // completo, y omitir un campo lo devuelve a su default global. El service
  // rechaza si la versión no es un BORRADOR.
  @Put(':id/parametros')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  setParametrosExamen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ParametrosExamenDto,
  ) {
    return this.modulos.setParametrosExamen(id, dto);
  }

  @Post(':id/preguntas')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  asignarPreguntas(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ParseArrayPipe({ items: AsignarPreguntaItemDto }))
    items: AsignarPreguntaItemDto[],
  ) {
    return this.modulos.asignarPreguntas(id, items);
  }

  @Patch(':id/preguntas/:preguntaId')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  setPreguntaActiva(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('preguntaId', ParseUUIDPipe) preguntaId: string,
    @Body() dto: TogglePreguntaDto,
  ) {
    return this.modulos.setPreguntaActiva(id, preguntaId, dto.activa);
  }

  // Unassign duro: solo sobre un BORRADOR (el service lo valida). Distinto de
  // setPreguntaActiva, que es la baja lógica y también aplica a lo publicado.
  @Delete(':id/preguntas/:preguntaId')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  unassignPregunta(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('preguntaId', ParseUUIDPipe) preguntaId: string,
  ) {
    return this.modulos.unassignPregunta(id, preguntaId);
  }
}
