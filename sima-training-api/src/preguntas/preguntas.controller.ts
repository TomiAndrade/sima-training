import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { FindAllPreguntasDto } from './dto/find-all-preguntas.dto';
import { TogglePreguntaActivaDto } from './dto/toggle-pregunta-activa.dto';
import { PreguntasService } from './preguntas.service';

@Controller('preguntas')
export class PreguntasController {
  constructor(private readonly preguntas: PreguntasService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePreguntaDto) {
    return this.preguntas.create(dto);
  }

  @Get()
  findAll(@Query() query: FindAllPreguntasDto) {
    return this.preguntas.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.preguntas.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  setActiva(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TogglePreguntaActivaDto,
  ) {
    return this.preguntas.setActiva(id, dto.activa);
  }
}
