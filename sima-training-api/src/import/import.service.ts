import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';

// Cantidad de filas de muestra que se devuelven en el preview.
const SAMPLE_ROWS = 10;

export interface ImportPreview {
  fileName: string;
  sheetName: string;
  totalColumns: number;
  totalRows: number;
  headers: string[];
  sample: Record<string, unknown>[];
  warnings: string[];
  // Esqueleto Sprint 1: NO se persiste nada hasta cerrar el mapeo de columnas
  // cuando llegue el Excel de nómina definitivo (§3.4-d).
  persisted: false;
}

@Injectable()
export class ImportService {
  async previewUsuarios(file?: Express.Multer.File): Promise<ImportPreview> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('El archivo debe ser un .xlsx');
    }

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

    // Primera fila = encabezados (validación genérica, sin mapeo cerrado).
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

    // Filas de datos.
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
      if (!hasValue) continue; // salta filas totalmente vacías
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

  private cellToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      // Celdas con fórmula/hyperlink/rich-text de exceljs.
      const obj = value as { text?: unknown; result?: unknown };
      if (obj.text !== undefined) return String(obj.text).trim();
      if (obj.result !== undefined) return String(obj.result).trim();
      return '';
    }
    return String(value).trim();
  }
}
