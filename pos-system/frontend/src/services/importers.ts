import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';

// Esquema de fila de importación para Productos (sin id)
export const ProductImportRowSchema = z.object({
  code: z.string().min(1, 'code requerido').transform((s) => s.trim()),
  name: z.string().min(1, 'name requerido').transform((s) => s.trim()),
  category: z.string().optional().default('').transform((s) => s.trim()),
  price: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'string' ? Number(v.replace(',', '.')) : v))
    .refine((n) => !Number.isNaN(n) && n >= 0, 'price inválido')
    .default(0),
  stock: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'string' ? Number(v) : v))
    .refine((n) => Number.isInteger(n) && n >= 0, 'stock inválido')
    .default(0),
});

export type ProductImportRow = z.infer<typeof ProductImportRowSchema>;

export interface ImportResult<T> {
  rows: T[];
  errors: string[];
}

function normalizeHeaders<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(row || {})) {
    const nk = key.trim().toLowerCase();
    normalized[nk] = (row as any)[key];
  }
  return normalized;
}

// CSV: texto con cabeceras: code,name,category,price,stock
export function parseProductCsvText(csvText: string): ImportResult<ProductImportRow> {
  const { data, errors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });
  const rows: ProductImportRow[] = [];
  const errMessages: string[] = (Array.isArray(errors) ? errors : []).map((e: any) => `CSV:${e?.row ?? '?'} ${e?.message ?? 'Error'}`);
  (Array.isArray(data) ? data : []).forEach((row: any, idx: number) => {
    try {
      const normalized = normalizeHeaders(row as Record<string, unknown>);
      const parsed = ProductImportRowSchema.parse({
        code: normalized['code'],
        name: normalized['name'],
        category: normalized['category'] ?? '',
        price: normalized['price'] ?? 0,
        stock: normalized['stock'] ?? 0,
      });
      rows.push(parsed);
    } catch (err: any) {
      errMessages.push(`CSV:${idx + 2} ${(err?.message ?? 'fila inválida')}`); // +2 por header
    }
  });
  return { rows, errors: errMessages };
}

// XLSX: primera hoja, cabeceras como en CSV
export function parseProductXlsxArrayBuffer(buffer: ArrayBuffer | Uint8Array): ImportResult<ProductImportRow> {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const rows: ProductImportRow[] = [];
  const errors: string[] = [];
  json.forEach((row: Record<string, unknown>, idx: number) => {
    try {
      const normalized = normalizeHeaders(row);
      const parsed = ProductImportRowSchema.parse({
        code: normalized['code'],
        name: normalized['name'],
        category: normalized['category'] ?? '',
        price: normalized['price'] ?? 0,
        stock: normalized['stock'] ?? 0,
      });
      rows.push(parsed);
    } catch (err: any) {
      errors.push(`XLSX:${idx + 2} ${(err?.message ?? 'fila inválida')}`);
    }
  });
  return { rows, errors };
}

// --- Extendido: esquema flexible usado por ProductsPage (SKU, costos, brand) ---
export const ProductImportFlexibleSchema = z.object({
  sku: z.string().min(1, 'SKU requerido').transform((s) => s.trim()),
  name: z.string().min(1, 'Nombre requerido').transform((s) => s.trim()),
  costPrice: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'string' ? Number(v.replace(',', '.')) : v))
    .refine((n) => !Number.isNaN(n) && n >= 0, 'Costo inválido')
    .default(0),
  retailPrice: z
    .union([z.number(), z.string()])
    .transform((v) => {
      if (v === '' || v == null) return undefined as any;
      const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
      return Number.isNaN(n) ? undefined : n;
    })
    .optional(),
  stock: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'string' ? Number(v) : v))
    .refine((n) => Number.isInteger(n) && n >= 0, 'Stock inválido')
    .default(0),
  category: z.string().optional().default('').transform((s) => s.trim() || undefined),
  brand: z.string().optional().default('').transform((s) => s.trim() || undefined),
});

export type ProductImportFlexibleRow = z.infer<typeof ProductImportFlexibleSchema> & {
  __row?: number;
  __errors?: string[];
};

function normalizeCandidateFlexible(row: Record<string, unknown>) {
  const n = normalizeHeaders(row);
  return {
    sku: (n['sku'] ?? n['code'] ?? n['codigo'] ?? n['barcode'] ?? '') as unknown,
    name: (n['name'] ?? n['nombre'] ?? '') as unknown,
    costPrice: (n['costprice'] ?? n['purchaseprice'] ?? n['costo'] ?? n['price'] ?? 0) as unknown,
    retailPrice: (n['retailprice'] ?? n['saleprice'] ?? n['precio'] ?? undefined) as unknown,
    stock: (n['stock'] ?? n['existencia'] ?? 0) as unknown,
    category: (n['category'] ?? n['categoria'] ?? '') as unknown,
    brand: (n['brand'] ?? n['marca'] ?? '') as unknown,
  } as Record<string, unknown>;
}

export function parseFlexibleCsvFile(csvText: string): ImportResult<ProductImportFlexibleRow> {
  const { data, errors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });
  const rows: ProductImportFlexibleRow[] = [];
  const errMessages: string[] = (Array.isArray(errors) ? errors : []).map((e: any) => `CSV:${e?.row ?? '?'} ${e?.message ?? 'Error'}`);
  (Array.isArray(data) ? data : []).forEach((row: any, idx: number) => {
    const candidate = normalizeCandidateFlexible(row);
    const parsed = ProductImportFlexibleSchema.safeParse(candidate);
    if (parsed.success) {
      rows.push({ ...parsed.data, __row: idx + 1 });
    } else {
      const errs = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      errMessages.push(`CSV:${idx + 2} ${errs.join('; ')}`);
    }
  });
  return { rows, errors: errMessages };
}

export function parseFlexibleXlsxBuffer(buffer: ArrayBuffer | Uint8Array): ImportResult<ProductImportFlexibleRow> {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const rows: ProductImportFlexibleRow[] = [];
  const errors: string[] = [];
  json.forEach((row: Record<string, unknown>, idx: number) => {
    const candidate = normalizeCandidateFlexible(row);
    const parsed = ProductImportFlexibleSchema.safeParse(candidate);
    if (parsed.success) {
      rows.push({ ...parsed.data, __row: idx + 1 });
    } else {
      const errs = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      errors.push(`XLSX:${idx + 2} ${errs.join('; ')}`);
    }
  });
  return { rows, errors };
}
