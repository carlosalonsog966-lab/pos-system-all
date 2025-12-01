import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseProductCsvText, parseProductXlsxArrayBuffer } from '../importers';

describe('Importers - Productos', () => {
  it('parsea CSV de productos con validación y coerción', () => {
    const csv = `code,name,category,price,stock\nP001,Anillo Oro,Joyería,1500.50,10\nP002,Collar Plata,Joyería,800,5`;
    const result = parseProductCsvText(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toMatchObject({ code: 'P001', name: 'Anillo Oro', category: 'Joyería', price: 1500.5, stock: 10 });
    expect(result.rows[1]).toMatchObject({ code: 'P002', name: 'Collar Plata', category: 'Joyería', price: 800, stock: 5 });
  });

  it('parsea XLSX de productos desde ArrayBuffer', () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ['code', 'name', 'category', 'price', 'stock'],
      ['P003', 'Pulsera Acero', 'Joyería', 300, 20],
      ['P004', 'Aritos', 'Joyería', '120.00', '15'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = parseProductXlsxArrayBuffer(buf);
    expect(result.errors).toEqual([]);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toMatchObject({ code: 'P003', name: 'Pulsera Acero', category: 'Joyería', price: 300, stock: 20 });
    expect(result.rows[1]).toMatchObject({ code: 'P004', name: 'Aritos', category: 'Joyería', price: 120, stock: 15 });
  });

  it('reporta errores por fila con datos inválidos', () => {
    const csv = `code,name,category,price,stock\n,Pulsera,Acc,100,10\nP006,,Acc,100,-1`;
    const result = parseProductCsvText(csv);
    expect(result.rows.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('CSV:2');
    expect(result.errors[1]).toContain('CSV:3');
  });
});

