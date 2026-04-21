import { describe, it, expect } from 'vitest'
import { extractStockRowsFromEdgePayload } from './getStock'

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
