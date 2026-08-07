import { BadRequestException, Injectable } from '@nestjs/common';
import { RolUsuario, TipoPregunta } from '@prisma/client';
import { Workbook, Worksheet } from 'exceljs';
import { ModulosService } from '../modulos/modulos.service';
import { PreguntasService } from '../preguntas/preguntas.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ConfirmarImportPreguntasDto } from './dto/confirmar-import-preguntas.dto';
import { ConfirmarImportUsuariosDto } from './dto/confirmar-import-usuarios.dto';
import { clasificar, normalizar, RefSimilitud, toRef } from './similitud';

// Columnas del Excel → campo del modelo / datos jsonb. Header normalizado
// (sin acentos, espacios colapsados) → campo, igual criterio que
// COLUMN_MAP_PREGUNTAS. `puesto` y "centro de costo" ya NO van al jsonb: son
// insumo puro para resolver contra el catálogo real (ver previewUsuarios).
// Sin columnas "rol"/"empresa"/"email": todo usuario importado se crea como
// ALUMNO en la organización que se elige una sola vez para todo el import
// (un Excel es siempre de una sola empresa), no por fila.
// "dependencia"/"puesto de trabajo"/"apellido y nombre" son los headers
// reales del Excel de nómina de Eduardo (Sprint 07-08, Story 3): dependencia
// es el nombre de campo que usa la empresa para lo que acá es centro de
// costo, y apellido+nombre vienen en una sola columna ("APELLIDO, Nombre").
const COLUMN_MAP_USUARIOS: Record<string, string> = {
  dni: 'dni',
  nombre: 'nombre',
  apellido: 'apellido',
  'apellido y nombre': 'apellidoNombreTexto',
  legajo: 'datos_legajo',
  puesto: 'puestoTexto',
  'puesto de trabajo': 'puestoTexto',
  'centro de costo': 'centroCostoTexto',
  'centro costo': 'centroCostoTexto',
  cc: 'centroCostoTexto',
  dependencia: 'centroCostoTexto',
};

export interface UsuarioImportData {
  dni: string;
  nombre: string;
  apellido: string;
  legajo?: string;
}

// Mismo vocabulario que similitud.ts: duplicada = match exacto en el catálogo
// (se asigna automático), parecida = típeo probable (se recomienda), nueva =
// no hay nada parecido (se recomienda crear). El campo `preguntaId` de
// `similar` es el nombre genérico que ya define similitud.ts — no vale la pena
// tocar ese archivo compartido solo por naming.
export interface ClasificacionCatalogo {
  texto: string;
  estado: 'nueva' | 'duplicada' | 'parecida';
  similar?: { preguntaId: string | null; texto: string; score: number };
}

export interface FilaImportUsuario {
  index: number;
  data: UsuarioImportData;
  puesto: ClasificacionCatalogo | null;
  centroCosto: ClasificacionCatalogo | null;
  estado: 'ok' | 'error';
  errores?: string[];
}

export interface ImportUsuariosPreview {
  fileName: string;
  sheetName: string;
  totalRows: number;
  headers: string[];
  warnings: string[];
  filas: FilaImportUsuario[];
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
    private readonly usuarios: UsuariosService,
  ) {}

  async previewUsuarios(
    file?: Express.Multer.File,
  ): Promise<ImportUsuariosPreview> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('El archivo debe ser un .xlsx');
    }

    const { sheet, headers, warnings } = await this.parseSheet(
      file,
      COLUMN_MAP_USUARIOS,
      'dni',
    );

    const colIdx: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = COLUMN_MAP_USUARIOS[normalizar(h)];
      if (key) colIdx[key] = i;
    });
    if (
      colIdx['nombre'] === undefined &&
      colIdx['apellido'] === undefined &&
      colIdx['apellidoNombreTexto'] === undefined
    ) {
      warnings.push('No se encontró la columna "nombre"/"apellido"');
    }
    if (colIdx['puestoTexto'] === undefined) {
      warnings.push('No se encontró la columna "puesto"');
    }
    if (colIdx['centroCostoTexto'] === undefined) {
      warnings.push('No se encontró la columna "centro de costo"');
    }

    // Bancos de catálogo (solo activos) para clasificar puesto/centro de
    // costo por fila, mismo mecanismo que previewPreguntas usa contra el
    // banco de preguntas.
    const [puestos, centros] = await Promise.all([
      this.prisma.puesto.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
      }),
      this.prisma.centroCosto.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
      }),
    ]);
    const refsPuesto: RefSimilitud[] = puestos.map((p) =>
      toRef(p.nombre, p.id),
    );
    const refsCentro: RefSimilitud[] = centros.map((c) =>
      toRef(c.nombre, c.id),
    );

    const getCol = (row: ReturnType<typeof sheet.getRow>, field: string) => {
      const idx = colIdx[field];
      return idx === undefined
        ? ''
        : this.cellToString(row.getCell(idx + 1).value);
    };

    const filas: FilaImportUsuario[] = [];
    const dnisVistos = new Set<string>();
    let totalRows = 0;

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);

      let hasValue = false;
      headers.forEach((_, i) => {
        if (this.cellToString(row.getCell(i + 1).value)) hasValue = true;
      });
      if (!hasValue) continue;
      totalRows++;

      const dni = getCol(row, 'dni');
      let nombre = getCol(row, 'nombre');
      let apellido = getCol(row, 'apellido');
      const apellidoNombreTexto = getCol(row, 'apellidoNombreTexto');
      if ((!nombre || !apellido) && apellidoNombreTexto) {
        // Header combinado del Excel real ("APELLIDO Y NOMBRE": "OSE, Miriam
        // Cristina"). Se parte en la primera coma nada más, por si algún
        // archivo futuro trajera más de una — no se vio ningún caso así en
        // las 264 filas reales verificadas.
        const comaIdx = apellidoNombreTexto.indexOf(',');
        if (comaIdx !== -1) {
          apellido = apellido || apellidoNombreTexto.slice(0, comaIdx).trim();
          nombre = nombre || apellidoNombreTexto.slice(comaIdx + 1).trim();
        } else if (!apellido) {
          apellido = apellidoNombreTexto.trim();
        }
      }
      const legajo = getCol(row, 'datos_legajo') || undefined;
      const puestoTexto = getCol(row, 'puestoTexto');
      const centroCostoTexto = getCol(row, 'centroCostoTexto');

      const errores: string[] = [];
      if (!dni) errores.push('Falta el DNI');
      if (!nombre) errores.push('Falta el nombre');
      if (!apellido) errores.push('Falta el apellido');
      if (!puestoTexto) errores.push('Falta el puesto');
      if (!centroCostoTexto) errores.push('Falta el centro de costo');

      if (dni) {
        if (dnisVistos.has(dni)) {
          errores.push('DNI duplicado en el archivo');
        } else {
          dnisVistos.add(dni);
          const existente = await this.prisma.usuario.findUnique({
            where: { dni },
            select: { deletedAt: true },
          });
          if (existente && existente.deletedAt === null) {
            errores.push('DNI duplicado (ya existe un usuario activo)');
          }
        }
      }

      // Clasificar SOLO contra el catálogo real — a diferencia de
      // previewPreguntas (que empuja cada fila válida de vuelta a `refs` para
      // detectar duplicados intra-archivo), acá NO se empuja nada: dos filas
      // con el mismo puesto nuevo ("Soldador" x2) deben salir ambas 'nueva'
      // de forma independiente, no 'duplicada' entre sí (el catálogo real
      // todavía no tiene "Soldador"). El dedupe de creación de catálogo
      // nuevo repetido queda del lado del frontend, agrupando por texto.
      const puesto = puestoTexto
        ? this.clasificarCatalogo(puestoTexto, refsPuesto)
        : null;
      const centroCosto = centroCostoTexto
        ? this.clasificarCatalogo(centroCostoTexto, refsCentro)
        : null;

      filas.push({
        index: r,
        data: { dni, nombre, apellido, legajo },
        puesto,
        centroCosto,
        estado: errores.length ? 'error' : 'ok',
        ...(errores.length ? { errores } : {}),
      });
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

  private clasificarCatalogo(
    texto: string,
    refs: RefSimilitud[],
  ): ClasificacionCatalogo {
    const { estado, similar } = clasificar(texto, refs);
    return { texto, estado, similar };
  }

  async confirmarUsuarios(
    dto: ConfirmarImportUsuariosDto,
  ): Promise<ImportResult> {
    const errors: ImportError[] = [];
    let created = 0;
    let skipped = 0;
    const dnisVistos = new Set<string>();

    for (const [i, fila] of dto.usuarios.entries()) {
      const row = fila.filaIndex ?? i + 2;

      if (dnisVistos.has(fila.dni)) {
        skipped++;
        errors.push({
          row,
          dni: fila.dni,
          motivo: 'DNI duplicado en el archivo',
        });
        continue;
      }
      dnisVistos.add(fila.dni);

      const datos: Record<string, string> = {};
      if (fila.legajo) datos['legajo'] = fila.legajo;

      // El alta pasa por UsuariosService: así el import comparte con el ABM
      // manual la validación de la matriz tipo-de-organización ↔ rol, la
      // validación de que puestoId/centroCostoId existan de verdad, el
      // revive del DNI dado de baja, y el recálculo de asignaciones
      // automáticas (se dispara solo porque `pares` no viene vacío).
      try {
        await this.usuarios.create(
          {
            nombre: fila.nombre,
            apellido: fila.apellido,
            dni: fila.dni,
            datos,
            vinculacion: {
              organizacionId: dto.organizacionId,
              rol: RolUsuario.ALUMNO,
              pares: [
                { puestoId: fila.puestoId, centroCostoId: fila.centroCostoId },
              ],
            },
          },
          'import',
        );
        created++;
      } catch (err) {
        skipped++;
        errors.push({
          row,
          dni: fila.dni,
          motivo: err instanceof Error ? err.message : 'Error al crear',
        });
      }
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
        tipo === TipoPregunta.OPCION_MULTIPLE ||
        tipo === TipoPregunta.OPCIONES_IMAGEN
      ) {
        if (opciones.length < 2) {
          errores.push('Requiere al menos 2 opciones');
        } else if (respuestaCorrecta && !opciones.includes(respuestaCorrecta)) {
          // Mismo chequeo que hace PreguntasService.create al confirmar. Se
          // adelanta acá para que la fila se marque en el preview y se pueda
          // destildar, en vez de que el confirm falle a mitad de la importación.
          errores.push(
            'La respuesta correcta no coincide con ninguna de las opciones',
          );
        }
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

  // Un Excel puede traer varias hojas (ej. el de nómina de Eduardo: "Listado
  // de Puestos" + "Nómina de personal") — tomar siempre worksheets[0] leería
  // la hoja equivocada. Si se pasan columnMap + campoRequerido, elige la
  // primera hoja cuyo header row (normalizado) resuelva ese campo; si
  // ninguna lo tiene, cae a la primera hoja igual que antes (con warning
  // sólo si había más de una hoja entre las que elegir).
  private async parseSheet(
    file: Express.Multer.File,
    columnMap?: Record<string, string>,
    campoRequerido?: string,
  ) {
    const workbook = new Workbook();
    try {
      const buffer = file.buffer as unknown as Parameters<
        typeof workbook.xlsx.load
      >[0];
      await workbook.xlsx.load(buffer);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel');
    }

    const hojas = workbook.worksheets.filter((s) => s.rowCount > 0);
    if (hojas.length === 0) {
      throw new BadRequestException('El archivo no tiene hojas o está vacío');
    }

    let sheet = hojas[0];
    let usadoFallback = false;
    if (columnMap && campoRequerido) {
      const encontrada = hojas.find((s) =>
        this.headerRowValues(s).some(
          (h) => columnMap[normalizar(h)] === campoRequerido,
        ),
      );
      if (encontrada) {
        sheet = encontrada;
      } else if (hojas.length > 1) {
        usadoFallback = true;
      }
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

    if (usadoFallback) {
      warnings.push(
        `Ninguna hoja tiene la columna requerida; se usó la primera hoja ("${sheet.name}")`,
      );
    }

    return { sheet, headers, warnings };
  }

  private headerRowValues(sheet: Worksheet): string[] {
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = this.cellToString(cell.value);
    });
    return headers;
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
