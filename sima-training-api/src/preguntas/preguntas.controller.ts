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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MAX_IMAGEN_SIZE } from '../storage/formato-imagen';
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

  // Imagen del enunciado. Sin `storage` en el interceptor: multer usa
  // memoryStorage, así que el archivo no toca el disco hasta que se valida
  // (mismo patrón que import/). Devuelve { imagen: "preguntas/<uuid>.png" },
  // la clave que después viaja en el POST /preguntas.
  @Post('imagen')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGEN_SIZE } }),
  )
  subirImagen(@UploadedFile() file?: Express.Multer.File) {
    return this.preguntas.subirImagen(file);
  }

  // La clave viaja url-encoded (contiene una /), ver preguntasApi.borrarImagen.
  @Delete('imagen/:clave')
  @UseGuards(JwtAuthGuard)
  borrarImagen(@Param('clave') clave: string) {
    return this.preguntas.borrarImagen(clave);
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
