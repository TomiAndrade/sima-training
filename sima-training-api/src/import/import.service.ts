import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ClasificacionAlumno,
  RolUsuario,
  TipoOrganizacion,
  TipoPregunta,
} from '@prisma/client';
import { Workbook } from 'exceljs';
import { ModulosService } from '../modulos/modulos.service';
import { PreguntasService } from '../preguntas/preguntas.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmarImportPreguntasDto } from './dto/confirmar-import-preguntas.dto';
import {
  clasificar,
  normalizar,
  RefSimilitud,
  toRef,
} from './similitud';

const SAMPLE_ROWS = 10;

// Tipo de organización → clasificación del alumno (mismo mapeo que el form del
// backoffice). Sin organización → INVITADO.
const CLASIF_POR_TIPO: Record<TipoOrganizacion, ClasificacionAlumno> = {
  INTERNA: ClasificacionAlumno.SIMA,
  CLIENTE: ClasificacionAlumno.CLIENTE,
  SUBCONTRATISTA: ClasificacionAlumno.SUBCONTRATISTA,
};

// Columnas del Excel → campo del modelo / datos jsonb.
// Las columnas "datos_*" se guardan en el jsonb con la clave que sigue al prefijo.
const COLUMN_MAP: Record<string, string> = {
  dni: 'dni',
  nombre: 'nombre',
  apellido: 'apellido',
  email: 'email',
  empresa: 'empresa',
  // Campos extra de nómina → datos jsonb
  legajo: 'datos_legajo',
  puesto: 'datos_puesto',
  sector: 'datos_sector',
};

export interface ImportPreview {
  fileName: string;
  sheetName: string;
  totalColumns: number;
  totalRows: number;
  headers: string[];
  sample: Record<string, unknown>[];
  warnings: string[];
  persisted: false;
}

export interface ImportError {
  row: number;
  dni?: string;
  motivo: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: ImportError[];
}

// --- Import de preguntas ---

// Encabezado del Excel (normalizado) → campo. Se usa `normalizar` para el match
// así "opcion_a", "Opción A" y "opción a" caen todos en el mismo campo.
const COLUMN_MAP_PREGUNTAS: Record<string, string> = {
  enunciado: 'texto',
  texto: 'texto',
  pregunta: 'texto',
  tipo: 'tipo',
  'opcion a': 'opcion_a',
  'opcion b': 'opcion_b',
  'opcion c': 'opcion_c',
  'opcion d': 'opcion_d',
  'respuesta correcta': 'respuestaCorrecta',
  respuesta: 'respuestaCorrecta',
  correcta: 'respuestaCorrecta',
  puntaje: 'puntajeMax',
  'puntaje maximo': 'puntajeMax',
  puntos: 'puntajeMax',
  imagen: 'imagen',
};

// Valor de la columna "tipo" (normalizado) → enum TipoPregunta.
const TIPO_MAP: Record<string, TipoPregunta> = {
  'v f': TipoPregunta.VERDADERO_FALSO,
  vf: TipoPregunta.VERDADERO_FALSO,
  'verdadero falso': TipoPregunta.VERDADERO_FALSO,
  multiple: TipoPregunta.OPCION_MULTIPLE,
  'opcion multiple': TipoPregunta.OPCION_MULTIPLE,
  imagen: TipoPregunta.OPCIONES_IMAGEN,
  'opciones imagen': TipoPregunta.OPCIONES_IMAGEN,
  'opciones con imagen': TipoPregunta.OPCIONES_IMAGEN,
  'texto libre': TipoPregunta.TEXTO_LIBRE,
};

export interface PreguntaImportData {
  texto: string;
  tipo: TipoPregunta;
  opciones?: string[];
  respuestaCorrecta?: string;
  puntajeMax?: number;
  imagen?: string;
}

export interface FilaImportPregunta {
  index: number;
  data: PreguntaImportData;
  estado: 'nueva' | 'duplicada' | 'parecida' | 'error';
  similar?: { preguntaId: string | null; texto: string; score: number };
  errores?: string[];
}

export interface ImportPreguntasPreview {
  fileName: string;
  sheetName: string;
  totalRows: number;
  headers: string[];
  warnings: string[];
  filas: FilaImportPregunta[];
}

export interface ImportPreguntasResult {
  created: number;
  errors: { texto: string; motivo: string }[];
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preguntas: PreguntasService,
    private readonly modulos: ModulosService,
  ) {}

  async previewUsuarios(file?: Express.Multer.File): Promise<ImportPreview> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('El archivo debe ser un .xlsx');
    }

    const { sheet, headers, warnings } = await this.parseSheet(file);

    const dataRows: Record<string, unknown>[] = [];
    let totalRows = 0;
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const obj: Record<string, unknown> = {};
      let hasValue = false;
      headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1);
        const value = this.cellToString(cell.value);
        obj[header] = value;
        if (value) hasValue = true;
      });
      if (!hasValue) continue;
      totalRows++;
      if (dataRows.length < SAMPLE_ROWS) {
        dataRows.push(obj);
      }
    }

    if (totalRows === 0) {
      warnings.push('El archivo no tiene filas de datos (solo encabezados)');
    }

    return {
      fileName: file.originalname,
      sheetName: sheet.name,
      totalColumns: headers.length,
      totalRows,
      headers,
      sample: dataRows,
      warnings,
      persisted: false,
    };
  }

  async confirmarUsuarios(
    file?: Express.Multer.File,
    defaultOrganizacionId?: number,
  ): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('El archivo debe ser un .xlsx');
    }

    const { sheet, headers } = await this.parseSheet(file);

    // Cargar todas las organizaciones para resolver "Empresa" → id y su tipo.
    const orgs = await this.prisma.organizacion.findMany({
      select: { id: true, nombre: true, tipo: true },
    });
    const orgByName = new Map(
      orgs.map((o) => [o.nombre.toLowerCase().trim(), o.id]),
    );
    const tipoPorOrgId = new Map(orgs.map((o) => [o.id, o.tipo]));

    // Índices de columnas mapeadas (case-insensitive).
    const colIdx: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = COLUMN_MAP[h.toLowerCase().trim()];
      if (key) colIdx[key] = i;
    });

    const errors: ImportError[] = [];
    let created = 0;
    let skipped = 0;

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);

      const getCol = (field: string): string => {
        const idx = colIdx[field];
        if (idx === undefined) return '';
        return this.cellToString(row.getCell(idx + 1).value);
      };

      // Verificar fila vacía.
      let hasValue = false;
      headers.forEach((_, i) => {
        if (this.cellToString(row.getCell(i + 1).value)) hasValue = true;
      });
      if (!hasValue) continue;

      const dni = getCol('dni');
      const nombre = getCol('nombre');
      const apellido = getCol('apellido');
      const email = getCol('email') || undefined;
      const empresaNombre = getCol('empresa');

      // Campos obligatorios.
      if (!dni || !nombre || !apellido) {
        skipped++;
        errors.push({
          row: r,
          dni: dni || undefined,
          motivo: 'Faltan campos obligatorios (DNI, Nombre o Apellido)',
        });
        continue;
      }

      // DNI existente: si está activo es duplicado real (se saltea); si está
      // dado de baja se reactiva (revive) más abajo en vez de crear uno nuevo.
      const existente = await this.prisma.usuario.findUnique({
        where: { dni },
        select: { id: true, deletedAt: true },
      });
      if (existente && existente.deletedAt === null) {
        skipped++;
        errors.push({ row: r, dni, motivo: 'DNI duplicado' });
        continue;
      }

      // Resolver organización.
      let organizacionId: number | null = null;
      if (empresaNombre) {
        organizacionId =
          orgByName.get(empresaNombre.toLowerCase().trim()) ?? null;
      }
      if (!organizacionId && defaultOrganizacionId) {
        organizacionId = defaultOrganizacionId;
      }

      // Clasificación derivada del tipo de la organización (editable luego en
      // el backoffice). Sin organización → INVITADO.
      const tipoOrg = organizacionId ? tipoPorOrgId.get(organizacionId) : null;
      const clasificacion = tipoOrg
        ? CLASIF_POR_TIPO[tipoOrg]
        : ClasificacionAlumno.INVITADO;

      // Campos de nómina (datos_*) + columnas no mapeadas → jsonb.
      const mappedKeys = new Set(Object.values(colIdx));
      const datos: Record<string, string> = {};
      const legajo = getCol('datos_legajo');
      const puesto = getCol('datos_puesto');
      const sector = getCol('datos_sector');
      if (legajo) datos['legajo'] = legajo;
      if (puesto) datos['puesto'] = puesto;
      if (sector) datos['sector'] = sector;
      headers.forEach((h, i) => {
        if (!mappedKeys.has(i)) {
          const val = this.cellToString(row.getCell(i + 1).value);
          if (val) datos[h] = val;
        }
      });

      if (existente) {
        // Reactivar la fila dada de baja con los datos nuevos.
        await this.prisma.usuario.update({
          where: { id: existente.id },
          data: {
            nombre,
            apellido,
            rol: RolUsuario.ALUMNO,
            clasificacion,
            email: email ?? null,
            organizacionId: organizacionId ?? null,
            datos,
            deletedAt: null,
            updatedBy: 'import',
          },
        });
      } else {
        await this.prisma.usuario.create({
          data: {
            nombre,
            apellido,
            dni,
            rol: RolUsuario.ALUMNO,
            clasificacion,
            ...(email ? { email } : {}),
            ...(organizacionId ? { organizacionId } : {}),
            datos,
            createdBy: 'import',
          },
        });
      }
      created++;
    }

    return { created, skipped, errors };
  }

  async previewPreguntas(
    file?: Express.Multer.File,
  ): Promise<ImportPreguntasPreview> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('El archivo debe ser un .xlsx');
    }

    const { sheet, headers, warnings } = await this.parseSheet(file);

    // Índices de columnas mapeadas (header normalizado → campo).
    const colIdx: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = COLUMN_MAP_PREGUNTAS[normalizar(h)];
      if (key) colIdx[key] = i;
    });
    if (colIdx['texto'] === undefined) {
      warnings.push(
        'No se encontró la columna de enunciado (esperada: "enunciado" o "texto")',
      );
    }
    if (colIdx['tipo'] === undefined) {
      warnings.push('No se encontró la columna "tipo"');
    }

    // Banco existente para comparar: todas las preguntas (activas y en papelera),
    // con sus trigramas precalculados una sola vez.
    const banco = await this.prisma.pregunta.findMany({
      select: { id: true, texto: true },
    });
    const refs: RefSimilitud[] = banco.map((p) => toRef(p.texto, p.id));

    const filas: FilaImportPregunta[] = [];
    let totalRows = 0;

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const getCol = (field: string): string => {
        const idx = colIdx[field];
        if (idx === undefined) return '';
        return this.cellToString(row.getCell(idx + 1).value);
      };

      // Fila vacía → se ignora.
      let hasValue = false;
      headers.forEach((_, i) => {
        if (this.cellToString(row.getCell(i + 1).value)) hasValue = true;
      });
      if (!hasValue) continue;
      totalRows++;

      const texto = getCol('texto');
      const tipoRaw = getCol('tipo');
      const opciones = ['opcion_a', 'opcion_b', 'opcion_c', 'opcion_d']
        .map((c) => getCol(c))
        .filter(Boolean);
      const respuestaCorrecta = getCol('respuestaCorrecta') || undefined;
      const imagen = getCol('imagen') || undefined;
      const puntajeRaw = getCol('puntajeMax');
      const puntajeMax = puntajeRaw ? Number(puntajeRaw) : undefined;

      const tipo = TIPO_MAP[normalizar(tipoRaw)];
      const data: PreguntaImportData = {
        texto,
        tipo,
        ...(opciones.length ? { opciones } : {}),
        ...(respuestaCorrecta ? { respuestaCorrecta } : {}),
        ...(puntajeMax !== undefined && !Number.isNaN(puntajeMax)
          ? { puntajeMax }
          : {}),
        ...(imagen ? { imagen } : {}),
      };

      // Validaciones de fila.
      const errores: string[] = [];
      if (!texto) errores.push('Falta el enunciado');
      if (!tipoRaw) errores.push('Falta el tipo');
      else if (!tipo) errores.push(`Tipo no reconocido: "${tipoRaw}"`);
      if (
        (tipo === TipoPregunta.OPCION_MULTIPLE ||
          tipo === TipoPregunta.OPCIONES_IMAGEN) &&
        opciones.length < 2
      ) {
        errores.push('Requiere al menos 2 opciones');
      }

      if (errores.length) {
        filas.push({ index: r, data, estado: 'error', errores });
        continue;
      }

      // Clasificación de similitud contra el banco + las filas ya válidas del
      // mismo archivo (para detectar duplicados internos).
      const { estado, similar } = clasificar(texto, refs);
      filas.push({ index: r, data, estado, similar });
      refs.push(toRef(texto, null));
    }

    if (totalRows === 0) {
      warnings.push('El archivo no tiene filas de datos (solo encabezados)');
    }

    return {
      fileName: file.originalname,
      sheetName: sheet.name,
      totalRows,
      headers,
      warnings,
      filas,
    };
  }

  async confirmarPreguntas(
    dto: ConfirmarImportPreguntasDto,
  ): Promise<ImportPreguntasResult> {
    const errors: { texto: string; motivo: string }[] = [];
    const creadasIds: string[] = [];

    for (const p of dto.preguntas) {
      try {
        const creada = await this.preguntas.create(p);
        creadasIds.push(creada.id);
      } catch (err) {
        errors.push({
          texto: p.texto,
          motivo: err instanceof Error ? err.message : 'Error al crear',
        });
      }
    }

    if (dto.moduloId && creadasIds.length) {
      try {
        await this.modulos.asignarPreguntas(
          dto.moduloId,
          creadasIds.map((preguntaId, i) => ({
            preguntaId,
            orden: i + 1,
            obligatoria: true,
          })),
        );
      } catch (err) {
        errors.push({
          texto: '(asignación al módulo)',
          motivo: err instanceof Error ? err.message : 'Error al asignar',
        });
      }
    }

    return { created: creadasIds.length, errors };
  }

  private async parseSheet(file: Express.Multer.File) {
    const workbook = new Workbook();
    try {
      const buffer = file.buffer as unknown as Parameters<
        typeof workbook.xlsx.load
      >[0];
      await workbook.xlsx.load(buffer);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount === 0) {
      throw new BadRequestException('El archivo no tiene hojas o está vacío');
    }

    const warnings: string[] = [];
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const value = this.cellToString(cell.value);
      headers[colNumber - 1] = value || `columna_${colNumber}`;
      if (!value) {
        warnings.push(`La columna ${colNumber} no tiene encabezado`);
      }
    });

    if (headers.length === 0) {
      throw new BadRequestException('La primera fila (encabezados) está vacía');
    }

    return { sheet, headers, warnings };
  }

  private cellToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      const obj = value as { text?: unknown; result?: unknown };
      if (obj.text !== undefined) return String(obj.text).trim();
      if (obj.result !== undefined) return String(obj.result).trim();
      return '';
    }
    return String(value).trim();
  }
}
