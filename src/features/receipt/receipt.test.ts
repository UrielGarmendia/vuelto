import { describe, expect, it } from 'vitest';
import { newMeta } from '../../db/db';
import type { Account, Category } from '../../db/types';
import type { ParseContext } from '../copilot/parse';
import { fitSize } from './compress';
import { draftFromReceipt, receiptDate, receiptMerchant, receiptTotal } from './receipt';

// What OCR makes of a supermarket ticket (made up, with the usual noise).
const COTO = `COTO C.I.C.S.A.
CUIT 30-54808315-6
Av. Rivadavia 1234 - CABA
IVA RESPONSABLE INSCRIPTO
TIQUE FACTURA B Nro 0012-00034567
Fecha 14/11/26 Hora 18:32
LECHE ENTERA 1L        1.250,00
PAN LACTAL             2.380,50
YERBA 1KG              4.999,99
SUBTOTAL               8.630,49
DESCUENTO               -630,49
TOTAL $                8.000,00
TARJETA VISA DEBITO   8.000,00`;

const YPF = `YPF
Estacion de servicio Libertador
CUIT 30-12345678-9
Fecha: 03-11-2026
NAFTA SUPER 40,5 L
IMPORTE TOTAL 35.640,00
EFECTIVO`;

const cat = (name: string): Category => ({
  ...newMeta(0),
  id: name,
  name,
  type: 'expense',
  icon: 'x',
  color: '#000',
  order: 0,
  archived: 0,
});
const acc = (name: string, kind: Account['kind']): Account => ({
  ...newMeta(0),
  id: name,
  name,
  kind,
  currency: 'ARS',
  initialBalanceCents: 0,
  color: '#000',
  order: 0,
  archived: 0,
});
const ctx: ParseContext = {
  categories: [cat('Supermercado'), cat('Nafta')],
  accounts: [acc('Efectivo', 'cash'), acc('Banco', 'bank'), acc('Tarjeta de crédito', 'credit')],
  rules: [],
  today: '2026-11-16',
  defaultAccountId: 'Banco',
};

describe('receipt reading', () => {
  it('finds the total on the TOTAL line, not the subtotal', () => {
    expect(receiptTotal(COTO)).toBe(8000);
    expect(receiptTotal(YPF)).toBe(35_640);
    expect(receiptTotal('ALGO 1.234,50\nOTRO 99,90')).toBe(1234.5);
    expect(receiptTotal('sin montos')).toBeUndefined();
  });

  it('reads the date, rejecting future or very old ones', () => {
    expect(receiptDate(COTO, '2026-11-16')).toBe('2026-11-14');
    expect(receiptDate(YPF, '2026-11-16')).toBe('2026-11-03');
    expect(receiptDate('Fecha 20/12/26', '2026-11-16')).toBeUndefined();
    expect(receiptDate('Fecha 01/01/20', '2026-11-16')).toBeUndefined();
    expect(receiptDate('31/02/26', '2026-11-16')).toBeUndefined();
  });

  it('takes the shop from the top, skipping fiscal headers', () => {
    expect(receiptMerchant(COTO)).toBe('Coto C.i.c.s.a.');
    expect(receiptMerchant(YPF)).toBe('Ypf');
    expect(receiptMerchant('CUIT 30-1\nFACTURA B\nKiosco El Sol')).toBe('Kiosco El Sol');
  });

  it('suggests a complete expense with category and account from the dictionary', () => {
    expect(draftFromReceipt(COTO, ctx)).toMatchObject({
      type: 'expense',
      amountCents: 800_000,
      date: '2026-11-14',
      categoryId: 'Supermercado',
      accountId: 'Tarjeta de crédito',
      missing: [],
    });
    expect(draftFromReceipt(YPF, ctx)).toMatchObject({
      amountCents: 3_564_000,
      categoryId: 'Nafta',
      accountId: 'Efectivo',
    });
  });

  it('flags a receipt it could not read', () => {
    const d = draftFromReceipt('borroso ilegible', ctx);
    expect(d.missing).toContain('amount');
    expect(d.confidence).toBeLessThan(0.7);
    expect(d.date).toBe('2026-11-16');
  });
});

describe('fitSize', () => {
  it('shrinks the longer side to 1600 and never enlarges', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(1200, 4000)).toEqual({ width: 480, height: 1600 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
