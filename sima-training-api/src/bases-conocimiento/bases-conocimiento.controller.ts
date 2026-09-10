import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LECTURA_BACKOFFICE, SOLO_ADMINISTRADOR } from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
import { BasesConocimientoService } from './bases-conocimiento.service';
import { CreateBaseConocimientoDto } from './dto/create-base-conocimiento.dto';
import { CreateNivelDto } from './dto/create-nivel.dto';
import { FindBasesConocimientoDto } from './dto/find-bases-conocimiento.dto';
import { ReordenarNivelesDto } from './dto/reordenar-niveles.dto';
import { UpdateBaseConocimientoDto } from './dto/update-base-conocimiento.dto';
import { UpdateNivelDto } from './dto/update-nivel.dto';

@Controller('bases-conocimiento')
export class BasesConocimientoController {
  constructor(private readonly bases: BasesConocimientoService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  create(@Body() dto: CreateBaseConocimientoDto) {
    return this.bases.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findAll(@Query() query: FindBasesConocimientoDto) {
    return this.bases.findAll(query);
  }

  // Antes de :id — si no, "orden" entraría por la ruta de detalle.
  @Put(':id/niveles/orden')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  reordenarNiveles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReordenarNivelesDto,
  ) {
    return this.bases.reordenarNiveles(id, dto);
  }

  @Post(':id/niveles')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  crearNivel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNivelDto,
  ) {
    return this.bases.crearNivel(id, dto);
  }

  @Patch(':id/niveles/:nivelId')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  actualizarNivel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nivelId', ParseUUIDPipe) nivelId: string,
    @Body() dto: UpdateNivelDto,
  ) {
    return this.bases.actualizarNivel(id, nivelId, dto);
  }

  @Delete(':id/niveles/:nivelId')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  eliminarNivel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nivelId', ParseUUIDPipe) nivelId: string,
  ) {
    return this.bases.eliminarNivel(id, nivelId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bases.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBaseConocimientoDto,
  ) {
    return this.bases.update(id, dto);
  }
}
