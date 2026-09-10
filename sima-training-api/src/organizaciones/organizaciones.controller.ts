import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LECTURA_BACKOFFICE, SOLO_ADMINISTRADOR } from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';
import { OrganizacionesService } from './organizaciones.service';

@Controller('organizaciones')
export class OrganizacionesController {
  constructor(private readonly organizaciones: OrganizacionesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  create(@Body() dto: CreateOrganizacionDto) {
    return this.organizaciones.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findAll() {
    return this.organizaciones.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.organizaciones.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizacionDto,
  ) {
    return this.organizaciones.update(id, dto);
  }
}
