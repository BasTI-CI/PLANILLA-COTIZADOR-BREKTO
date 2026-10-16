import { describe, it, expect } from 'vitest'
import { MAX_COTIZACIONES, letraCotizacion } from './cotizaciones'

describe('cotizaciones', () => {
  it('MAX_COTIZACIONES es 10', () => {
    expect(MAX_COTIZACIONES).toBe(10)
  })

  it('letraCotizacion mapea índice a letra', () => {
    expect(letraCotizacion(0)).toBe('A')
    expect(letraCotizacion(3)).toBe('D')
    expect(letraCotizacion(9)).toBe('J')
  })
})
