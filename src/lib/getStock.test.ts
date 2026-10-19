import { describe, it, expect } from 'vitest'
import {
  extractStockRowsFromEdgePayload,
  mapStockItemToUnidadSupabase,
  pickNumeroUnidadFromStockRow,
} from './getStock'
import { validateUnidadSupabaseForMotor } from './stock/validateStockInputs'

describe('extractStockRowsFromEdgePayload', () => {
  it('prioriza payload.data', () => {
    const rows = [{ id: '1' }, { id: '2' }]
    expect(
      extractStockRowsFromEdgePayload({
        success: true,
        data: rows,
        items: [{ id: 'x' }],
      } as Record<string, unknown>)
    ).toEqual(rows)
  })

  it('usa payload.items si no hay data', () => {
    const rows = [{ id: 'a' }]
    expect(
      extractStockRowsFromEdgePayload({
        success: true,
        items: rows,
      } as Record<string, unknown>)
    ).toEqual(rows)
  })

  it('sin arrays → []', () => {
    expect(extractStockRowsFromEdgePayload({ success: true } as Record<string, unknown>)).toEqual([])
  })
})

describe('pickNumeroUnidadFromStockRow', () => {
  const casos: [Record<string, unknown>, string][] = [
    [{ id: '1', piso: 10, unidad: '1001' }, '1001'],
    [{ id: '1', torre: '12', unidad: '305' }, '305'],
    [{ id: '1', unidad_id: 4521, unidad: '305' }, '305'],
    [{ id: '1', unidad: '12' }, '12'],
    [{ id: '1', unidad: '1001', piso: 10 }, '1001'],
    [{ id: '1', nro_depto: '316' }, '316'],
    [{ id: '1', codigo: 'Proy - Inmob 316' }, '316'],
    [{ id: '1', codigo: 'Torre Norte', num_dpto: '316' }, '316'],
    [{ id: '1', codigo: 'Proy - Inmob 2024', num_dpto: '316' }, '316'],
    [{ id: '1', piso: 10 }, 'FB'],
  ]

  it.each(casos)('%j → %s', (raw, esperado) => {
    expect(pickNumeroUnidadFromStockRow(raw, 'FB')).toBe(esperado)
  })
})

describe('mapStockItemToUnidadSupabase', () => {
  it('con piso 10 y unidad 1001, el hint "10" no pisa el número', () => {
    const r = mapStockItemToUnidadSupabase({ id: '1', piso: 10, unidad: '1001' }, 'P', '10')
    expect(r?.numero).toBe('1001')
  })

  describe('descuento del stock en % 0–100 (B-03)', () => {
    const casos: [string, Record<string, unknown>, number, number][] = [
      ['23 % (Smart Vicuña 1211A)', { id: '1', precio_lista: 7021, descuento: 23 }, 1614.83, 5406.17],
      ['0,5 % no es 50 % (Surmonte 1410B)', { id: '1', precio_lista: 5204, descuento: 0.5 }, 26.02, 5177.98],
      ['15 %', { id: '1', precio_lista: 3000, descuento: 15 }, 450, 2550],
      ['0 %', { id: '1', precio_lista: 3027.27, descuento: 0 }, 0, 3027.27],
      ['string "23"', { id: '1', precio_lista: 7021, descuento: '23' }, 1614.83, 5406.17],
      ['string "0,5"', { id: '1', precio_lista: 5204, descuento: '0,5' }, 26.02, 5177.98],
    ]

    it.each(casos)('%s', (_nombre, raw, descEsperado, netoEsperado) => {
      const u = mapStockItemToUnidadSupabase(raw, 'P')!
      expect(u.descuento_uf).toBeCloseTo(descEsperado, 2)
      expect(u.precio_neto_uf).toBeCloseTo(netoEsperado, 2)
      expect(Math.abs(u.precio_lista_uf - u.descuento_uf - u.precio_neto_uf)).toBeLessThan(0.01)
      const codes = validateUnidadSupabaseForMotor(u).issues.map((i) => i.code)
      expect(codes).not.toContain('descuento_coherencia')
    })

    it('descuento_uf explícito (compat) se usa tal cual y manda sobre descuento', () => {
      const u = mapStockItemToUnidadSupabase(
        { id: '1', precio_lista: 3000, descuento_uf: 100, descuento: 15 },
        'P'
      )!
      expect(u.descuento_uf).toBeCloseTo(100, 2)
      expect(u.precio_neto_uf).toBeCloseTo(2900, 2)
    })
  })
})
