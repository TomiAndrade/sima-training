import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';
import { OrganizacionesService } from './organizaciones.service';

@Controller('organizaciones')
export class OrganizacionesController {
  constructor(private readonly organizaciones: OrganizacionesService) {}

  @Post()
  create(@Body() dto: CreateOrganizacionDto) {
    return this.organizaciones.create(dto);
  }

  @Get()
  findAll() {
    return this.organizaciones.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.organizaciones.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizacionDto,
  ) {
    return this.organizaciones.update(id, dto);
  }
}
