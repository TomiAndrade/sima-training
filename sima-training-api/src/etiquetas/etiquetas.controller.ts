import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEtiquetaDto } from './dto/create-etiqueta.dto';
import { EtiquetasService } from './etiquetas.service';

@Controller('etiquetas')
export class EtiquetasController {
  constructor(private readonly etiquetas: EtiquetasService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateEtiquetaDto) {
    return this.etiquetas.create(dto);
  }

  @Get()
  findAll() {
    return this.etiquetas.findAll();
  }
}
