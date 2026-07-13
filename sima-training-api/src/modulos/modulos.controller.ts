import {
  Body,
  Controller,
  Get,
  Param,
  ParseArrayPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AsignarPreguntaItemDto } from './dto/asignar-preguntas.dto';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { CrearVersionDto } from './dto/crear-version.dto';
import { TogglePreguntaDto } from './dto/toggle-pregunta.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import { ModulosService } from './modulos.service';

@Controller('modulos')
export class ModulosController {
  constructor(private readonly modulos: ModulosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateModuloDto) {
    return this.modulos.create(dto);
  }

  @Get()
  findAll() {
    return this.modulos.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.modulos.findOne(id);
  }

  @Get(':id/versiones')
  findVersiones(@Param('id', ParseUUIDPipe) id: string) {
    return this.modulos.findVersiones(id);
  }

  @Get(':id/versiones/:versionId')
  findVersionOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.modulos.findVersionOne(id, versionId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModuloDto,
  ) {
    return this.modulos.update(id, dto);
  }

  @Post(':id/versiones')
  @UseGuards(JwtAuthGuard)
  crearVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearVersionDto,
  ) {
    return this.modulos.crearVersion(id, dto.esNuevaLinea);
  }

  @Patch(':id/activar')
  @UseGuards(JwtAuthGuard)
  activar(@Param('id', ParseUUIDPipe) id: string) {
    return this.modulos.activar(id);
  }

  @Post(':id/preguntas')
  @UseGuards(JwtAuthGuard)
  asignarPreguntas(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ParseArrayPipe({ items: AsignarPreguntaItemDto }))
    items: AsignarPreguntaItemDto[],
  ) {
    return this.modulos.asignarPreguntas(id, items);
  }

  @Patch(':id/preguntas/:preguntaId')
  @UseGuards(JwtAuthGuard)
  setPreguntaActiva(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('preguntaId', ParseUUIDPipe) preguntaId: string,
    @Body() dto: TogglePreguntaDto,
  ) {
    return this.modulos.setPreguntaActiva(id, preguntaId, dto.activa);
  }
}
