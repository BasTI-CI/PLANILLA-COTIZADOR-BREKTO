import { describe, it, expect } from 'vitest'
import { precioCompraDeptoUf, precioCompraTotalUf } from './precioCompra'

describe('precioCompraDeptoUf / precioCompraTotalUf', () => {
  it('ejemplo planilla: neto post-lista 3589,2; bonif 10% → compra depto 3230,28', () => {
    const p = {
      precio_neto_uf: 3589.2,
      bono_max_pct: 0.1,
      estacionamiento_uf: 0,
      bodega_uf: 0,
    }
    expect(precioCompraDeptoUf(p)).toBeCloseTo(3230.28, 2)
    expect(precioCompraTotalUf(p)).toBeCloseTo(3230.28, 2)
  })
})
