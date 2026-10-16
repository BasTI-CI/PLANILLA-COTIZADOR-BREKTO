import { describe, it, expect } from 'vitest'
import {
  extractStockRowsFromEdgePayload,
  mapStockItemToUnidadSupabase,
  pickNumeroUnidadFromStockRow,
} from './getStock'

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
})
