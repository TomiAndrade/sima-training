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
import { CentrosCostoService } from './centros-costo.service';
import { CreateCentroCostoDto } from './dto/create-centro-costo.dto';
import { FindCentrosCostoDto } from './dto/find-centros-costo.dto';
import { UpdateCentroCostoDto } from './dto/update-centro-costo.dto';

@Controller('centros-costo')
export class CentrosCostoController {
  constructor(private readonly centrosCosto: CentrosCostoService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCentroCostoDto) {
    return this.centrosCosto.create(dto);
  }

  @Get()
  findAll(@Query() query: FindCentrosCostoDto) {
    return this.centrosCosto.findAll(query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCentroCostoDto,
  ) {
    return this.centrosCosto.update(id, dto);
  }
}
