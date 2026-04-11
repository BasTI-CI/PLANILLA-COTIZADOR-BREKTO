import { describe, expect, it } from 'vitest'
import { seriePatrimonioUf, saldoCreditoAlMesUF } from './resumenGraficos'

describe('seriePatrimonioUf', () => {
  it('semestre 0 = precio compra; semestre 2 = escritura × (1+g)', () => {
    const pp = 3000
    const ve = 3500
    const g = 0.05
    const s = seriePatrimonioUf(pp, ve, g, 10)
    expect(s[0].patrimonioUf).toBe(pp)
    expect(s[2].patrimonioUf).toBeCloseTo(ve * 1.05, 1)
  })
})

describe('saldoCreditoAlMesUF', () => {
  it('devuelve saldo del mes pedido', () => {
    const tabla = [
      { mes: 1, saldo_uf: 90 },
      { mes: 60, saldo_uf: 42 },
    ] as unknown as import('@/types').FilaAmortizacion[]
    expect(saldoCreditoAlMesUF(tabla, 60)).toBe(42)
  })
})
